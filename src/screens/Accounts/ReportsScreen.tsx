import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    ActivityIndicator, Alert, ScrollView, Platform, PermissionsAndroid
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { VictoryPie } from 'victory-native';
import Svg from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import apiClient from '../../api/client';

const ReportsScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const viewShotRef = useRef(null);

    const [reportData, setReportData] = useState({ debit: 0, credit: 0, deposit: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [activePeriod, setActivePeriod] = useState('overall');
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState('start');

    // Define consistent colors for the report
    const reportColors = {
        debit: '#d9534f',   // Red
        credit: '#5cb85c',  // Green
        deposit: '#0275d8' // Blue
    };

    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        let queryString = '/reports/summary?';

        if (activePeriod === 'custom' && dateRange.start && dateRange.end) {
            queryString += `startDate=${dateRange.start}&endDate=${dateRange.end}`;
        } else {
            queryString += `period=${activePeriod}`;
        }

        try {
            const response = await apiClient.get(queryString);
            setReportData(response.data);
        } catch (error) {
            Alert.alert("Error", "Could not fetch report data.");
        } finally {
            setIsLoading(false);
        }
    }, [activePeriod, dateRange]);

    useEffect(() => {
        if (isFocused) {
            fetchReportData();
        }
    }, [isFocused, fetchReportData]);

    const handlePeriodChange = (period) => {
        setActivePeriod(period);
        setDateRange({ start: null, end: null });
    };

    const showDatePicker = (mode) => {
        setDatePickerMode(mode);
        setDatePickerVisibility(true);
    };

    const hideDatePicker = () => setDatePickerVisibility(false);

    const handleConfirmDate = (date) => {
        const formattedDate = date.toISOString().split('T')[0];
        if (datePickerMode === 'start') {
            setDateRange(prev => ({ ...prev, start: formattedDate }));
        } else {
            setDateRange(prev => ({ ...prev, end: formattedDate }));
        }
        setActivePeriod('custom');
        hideDatePicker();
        // Automatically fetch data after date selection
        fetchReportData(); 
    };
    
    const requestStoragePermission = async () => {
        if (Platform.OS !== 'android' || Platform.Version >= 33) return true;
        try {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            return false;
        }
    };

    const downloadReport = async () => {
        if (!(await requestStoragePermission())) {
            Alert.alert("Permission Denied", "Storage permission is required to download reports.");
            return;
        }
        try {
            const imageUri = await viewShotRef.current.capture();
            const totalAmount = Number(reportData.debit) + Number(reportData.credit) + Number(reportData.deposit);
            const periodTitle = activePeriod === 'custom' 
                ? `${dateRange.start} to ${dateRange.end}`
                : activePeriod.charAt(0).toUpperCase() + activePeriod.slice(1);
            
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; }
                        .report-container { width: 100%; max-width: 700px; margin: auto; padding: 20px; border: 1px solid #eee; }
                        .header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                        .school-name { font-size: 24px; font-weight: bold; }
                        .managed-by { font-size: 14px; color: #777; }
                        .report-title { font-size: 20px; font-weight: bold; margin: 20px 0; }
                        .chart-container { text-align: center; margin: 30px 0; }
                        .chart-container img { max-width: 90%; height: auto; }
                        .summary-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        .summary-table td { padding: 12px 5px; border-bottom: 1px solid #eee; }
                        .summary-table .label { font-weight: 500; }
                        .summary-table .amount { text-align: right; font-weight: bold; }
                        .total-row .label, .total-row .amount { font-weight: bold; font-size: 16px; border-top: 2px solid #333; }
                    </style>
                </head>
                <body>
                    <div class="report-container">
                        <div class="header">
                            <div class="school-name">Vivekanand Public School</div>
                            <div class="managed-by">Managed by Vivekananda Education Center</div>
                        </div>
                        <div class="report-title">${periodTitle} Financial Report</div>
                        <div class="chart-container">
                            <img src="${imageUri}" alt="Financial Report Chart"/>
                        </div>
                        <table class="summary-table">
                            <tr><td class="label">Debit</td><td class="amount">₹${Number(reportData.debit).toFixed(2)}</td></tr>
                            <tr><td class="label">Credit</td><td class="amount">₹${Number(reportData.credit).toFixed(2)}</td></tr>
                            <tr><td class="label">Deposit</td><td class="amount">₹${Number(reportData.deposit).toFixed(2)}</td></tr>
                            <tr class="total-row"><td class="label">Total Amount</td><td class="amount">₹${totalAmount.toFixed(2)}</td></tr>
                        </table>
                    </div>
                </body>
                </html>
            `;
            
            const options = { html: htmlContent, fileName: `Financial_Report_${periodTitle}`, directory: 'Documents' };
            const file = await RNHTMLtoPDF.convert(options);
            const destinationPath = `${RNFS.DownloadDirectoryPath}/${file.fileName}.pdf`;
            await RNFS.moveFile(file.filePath, destinationPath);
            Alert.alert("Success", `Report saved to your Downloads folder.`);

        } catch (error) {
            console.error("PDF Generation Error:", error);
            Alert.alert("Error", "Failed to generate or save the report.");
        }
    };
    
    const totalAmount = Number(reportData.debit) + Number(reportData.credit) + Number(reportData.deposit);
    const chartData = [
        { x: 'Debit', y: Number(reportData.debit) },
        { x: 'Credit', y: Number(reportData.credit) },
        { x: 'Deposit', y: Number(reportData.deposit) },
    ].filter(item => item.y > 0); // Filter out zero values to prevent chart errors

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Reports</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.filterContainer}>
                    <View style={styles.segmentControl}>
                        {['Daily', 'Monthly', 'Overall'].map(p => (
                            <TouchableOpacity key={p} style={[styles.segmentButton, activePeriod === p.toLowerCase() && styles.segmentActive]} onPress={() => handlePeriodChange(p.toLowerCase())}>
                                <Text style={[styles.segmentText, activePeriod === p.toLowerCase() && styles.segmentTextActive]}>{p}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.dateRangeContainer}>
                        <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('start')}>
                            <MaterialIcons name="calendar-today" size={16} color="#546E7A" />
                            <Text style={styles.dateText}>{dateRange.start || 'From Date'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('end')}>
                            <MaterialIcons name="calendar-today" size={16} color="#546E7A" />
                            <Text style={styles.dateText}>{dateRange.end || 'To Date'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {isLoading ? <ActivityIndicator size="large" color="#007AFF" style={{ flex: 1, marginTop: 50 }} /> : (
                    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
                        <View style={styles.reportCard}>
                            <View style={styles.reportHeader}>
                                <Text style={styles.schoolName}>Vivekanand Public School</Text>
                                <Text style={styles.managedBy}>Managed by Vivekananda Education Center</Text>
                                <View style={styles.dateChip}><Text style={styles.dateChipText}>{new Date().toLocaleDateString('en-GB')}</Text></View>
                            </View>

                            <View style={styles.chartContainer}>
                                {totalAmount > 0 ? (
                                    <Svg>
                                        <VictoryPie
                                            data={chartData}
                                            width={300}
                                            height={300}
                                            colorScale={[reportColors.debit, reportColors.credit, reportColors.deposit]}
                                            innerRadius={50}
                                            padAngle={2}
                                            style={{ labels: { fill: "white", fontSize: 16, fontWeight: "bold" } }}
                                            labelRadius={({ innerRadius }) => innerRadius + 60 }
                                            labels={({ datum }) => `${((datum.y / totalAmount) * 100).toFixed(1)}%`}
                                        />
                                    </Svg>
                                ) : (
                                    <Text style={styles.noDataText}>No data available for this period.</Text>
                                )}
                            </View>

                            <View style={styles.legendContainer}>
                                {Object.keys(reportColors).map(key => (
                                    <View key={key} style={styles.legendItem}>
                                        <View style={[styles.legendColor, { backgroundColor: reportColors[key] }]} />
                                        <Text style={styles.legendLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}:</Text>
                                        <Text style={styles.legendAmount}>₹{Number(reportData[key]).toFixed(2)}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Total Amount</Text>
                                <Text style={styles.totalAmount}>₹{totalAmount.toFixed(2)}</Text>
                            </View>

                            <TouchableOpacity style={styles.downloadButton} onPress={downloadReport}>
                                <MaterialIcons name="download" size={20} color="#FFF" />
                                <Text style={styles.downloadButtonText}>Download Report</Text>
                            </TouchableOpacity>
                        </View>
                    </ViewShot>
                )}
            </ScrollView>

            <DateTimePickerModal isVisible={isDatePickerVisible} mode="date" onConfirm={handleConfirmDate} onCancel={hideDatePicker} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F4F8' },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#CFD8DC' },
    backButton: { padding: 5, marginRight: 15 },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#263238' },
    scrollContent: { padding: 15 },
    filterContainer: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, elevation: 2, marginBottom: 20 },
    segmentControl: { flexDirection: 'row', backgroundColor: '#ECEFF1', borderRadius: 8, marginBottom: 12 },
    segmentButton: { flex: 1, paddingVertical: 10, borderRadius: 7 },
    segmentActive: { backgroundColor: '#007AFF' },
    segmentText: { textAlign: 'center', fontWeight: '600', color: '#37474F' },
    segmentTextActive: { color: '#FFFFFF' },
    dateRangeContainer: { flexDirection: 'row', alignItems: 'center' },
    dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 10, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#DEE2E6' },
    dateText: { marginLeft: 8, color: '#37474F' },
    reportCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    reportHeader: { alignItems: 'center', marginBottom: 20 },
    schoolName: { fontSize: 22, fontWeight: 'bold', color: '#263238' },
    managedBy: { fontSize: 13, color: '#6c757d', marginTop: 2 },
    dateChip: { position: 'absolute', top: -10, right: -10, backgroundColor: '#E9ECEF', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
    dateChipText: { fontSize: 12, color: '#495057' },
    chartContainer: { alignItems: 'center', justifyContent: 'center', height: 250, marginVertical: 15 },
    noDataText: { fontSize: 16, color: '#78909C' },
    legendContainer: { marginTop: 20, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    legendColor: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
    legendLabel: { fontSize: 16, color: '#495057', flex: 1 },
    legendAmount: { fontSize: 16, fontWeight: '600', color: '#263238' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 2, borderTopColor: '#333', paddingHorizontal: 10 },
    totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#263238' },
    totalAmount: { fontSize: 18, fontWeight: 'bold', color: '#263238' },
    downloadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', paddingVertical: 15, borderRadius: 8, marginTop: 25 },
    downloadButtonText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
});

export default ReportsScreen;