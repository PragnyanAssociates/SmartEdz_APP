import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    ActivityIndicator, Alert, ScrollView, Platform, PermissionsAndroid
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { PieChart } from 'react-native-svg-charts';
import { Text as SvgText } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import apiClient from '../../api/client';

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    success: '#43A047',
    danger: '#E53935',
    blue: '#1E88E5',
    warning: '#F59E0B'
};

// --- Helper: Format Currency ---
const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

const ReportsScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const viewShotRef = useRef(null);

    const [reportData, setReportData] = useState({ debit: 0, credit: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [activePeriod, setActivePeriod] = useState('daily');
    const [displayDate, setDisplayDate] = useState('');
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState('start');

    const reportColors = {
        debit: COLORS.danger,
        credit: COLORS.success,
    };

    const fetchReportData = useCallback(async () => {
        if (activePeriod === 'custom' && (!dateRange.start || !dateRange.end)) {
            setReportData({ debit: 0, credit: 0 });
            return;
        }

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

    useEffect(() => {
        const getFormattedDate = (date) => date.toLocaleDateString('en-GB');
        if (activePeriod === 'daily') {
            setDisplayDate(getFormattedDate(new Date()));
        } else if (activePeriod === 'monthly') {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            setDisplayDate(`${getFormattedDate(startOfMonth)} - ${getFormattedDate(endOfMonth)}`);
        } else if (activePeriod === 'overall') {
            setDisplayDate('Overall Report');
        } else if (activePeriod === 'custom' && dateRange.start && dateRange.end) {
            const formatDate = (isoDate) => {
                const [y, m, d] = isoDate.split('-');
                return `${d}/${m}/${y}`;
            }
            setDisplayDate(`${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`);
        } else {
            setDisplayDate('');
        }
    }, [activePeriod, dateRange]);

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
        hideDatePicker();
        if (datePickerMode === 'start') {
            setDateRange(prev => ({ ...prev, start: formattedDate, end: null }));
        } else {
            setDateRange(prev => ({ ...prev, end: formattedDate }));
        }
        setActivePeriod('custom');
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
    
    const grossTotal = Number(reportData.debit) + Number(reportData.credit);
    const netTotal = Number(reportData.credit) - Number(reportData.debit);

    const downloadReport = async () => {
        if (!(await requestStoragePermission())) {
            Alert.alert("Permission Denied", "Storage permission is required to download reports.");
            return;
        }
        try {
            const imageUri = await viewShotRef.current.capture();
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 0; }
                        .report-container { width: 100%; max-width: 800px; margin: auto; padding: 20px; box-sizing: border-box; }
                        .header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                        .school-name { font-size: 24px; font-weight: bold; }
                        .managed-by { font-size: 14px; color: #777; }
                        .report-title { font-size: 20px; font-weight: bold; margin: 20px 0; }
                        .chart-container { text-align: center; margin: 20px 0; }
                        .chart-container img { max-width: 90%; height: auto; max-height: 40vh; object-fit: contain; }
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
                        <div class="report-title">${displayDate} Financial Report</div>
                        <div class="chart-container">
                            <img src="${imageUri}" alt="Financial Report Chart"/>
                        </div>
                        <table class="summary-table">
                            <tr><td class="label">Debit</td><td class="amount">- ₹${formatCurrency(reportData.debit)}</td></tr>
                            <tr><td class="label">Credit</td><td class="amount">+ ₹${formatCurrency(reportData.credit)}</td></tr>
                            <tr class="total-row"><td class="label">Total Amount</td><td class="amount">₹${formatCurrency(netTotal)}</td></tr>
                        </table>
                    </div>
                </body>
                </html>
            `;
            
            const options = { 
                html: htmlContent, 
                fileName: `Financial_Report_${displayDate.replace(/ /g, '_').replace(/\//g, '-')}`, 
                directory: 'Download'
            };
            const file = await RNHTMLtoPDF.convert(options);
            const destinationPath = `${RNFS.DownloadDirectoryPath}/${file.fileName}.pdf`;
            await RNFS.moveFile(file.filePath, destinationPath);
            Alert.alert("Success", `Report saved to your Downloads folder.`);
        } catch (error) {
            console.error("PDF Generation Error:", error);
            Alert.alert("Error", "Failed to generate or save the report.");
        }
    };

    const pieData = [
        { key: 'debit', value: Number(reportData.debit), svg: { fill: reportColors.debit } },
        { key: 'credit', value: Number(reportData.credit), svg: { fill: reportColors.credit } },
    ].filter(item => item.value > 0);

    const Labels = ({ slices }) => {
        return slices.map((slice, index) => {
            const { pieCentroid, data } = slice;
            if (data.value === 0 || grossTotal === 0) return null;
            const percentage = (data.value / grossTotal) * 100;
            if (percentage < 5) return null;
            return (
                <SvgText
                    key={index}
                    x={pieCentroid[0]}
                    y={pieCentroid[1]}
                    fill={'white'}
                    textAnchor={'middle'}
                    alignmentBaseline={'middle'}
                    fontSize={16}
                    fontWeight={'bold'}
                >
                    {`${percentage.toFixed(0)}%`}
                </SvgText>
            );
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    {/* Back Button */}
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>

                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="chart-pie" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Financial Reports</Text>
                        <Text style={styles.headerSubtitle}>Summary & Analytics</Text>
                    </View>
                </View>
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
                            <MaterialIcons name="calendar-today" size={16} color={COLORS.textSub} />
                            <Text style={styles.dateText}>{dateRange.start ? dateRange.start.split('-').reverse().join('/') : 'From Date'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('end')}>
                            <MaterialIcons name="calendar-today" size={16} color={COLORS.textSub} />
                            <Text style={styles.dateText}>{dateRange.end ? dateRange.end.split('-').reverse().join('/') : 'To Date'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {isLoading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1, marginTop: 50 }} /> : (
                    <>
                        <View style={styles.reportCard}>
                            <View style={styles.reportHeader}>
                                <Text style={styles.schoolName}>Vivekananda Public School</Text>
                                <Text style={styles.managedBy}>Managed by Vivekananda Education Center</Text>
                            </View>

                            <Text style={styles.reportDateDisplay}>{displayDate}</Text>

                            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9, result: 'data-uri' }}>
                                <View style={styles.chartContainer}>
                                    {grossTotal > 0 && pieData.length > 0 ? (
                                        <PieChart
                                            style={{ height: 250, width: 250 }}
                                            data={pieData}
                                            innerRadius={'30%'}
                                            padAngle={0.02}
                                        >
                                            <Labels />
                                        </PieChart>
                                    ) : (
                                        <Text style={styles.noDataText}>No data available for this period.</Text>
                                    )}
                                </View>
                            </ViewShot>

                            <View style={styles.legendContainer}>
                                {Object.keys(reportColors).map(key => {
                                    const isDebit = key === 'debit';
                                    const isIncome = key === 'credit';
                                    const hasValue = Number(reportData[key]) > 0;
                                    return (
                                        <View key={key} style={styles.legendItem}>
                                            <View style={styles.legendLabelContainer}>
                                                <View style={[styles.legendColor, { backgroundColor: reportColors[key] }]} />
                                                <Text style={styles.legendLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}:</Text>
                                            </View>
                                            <View style={styles.legendAmountContainer}>
                                                {isDebit && hasValue && <Text style={styles.debitSymbol}>- </Text>}
                                                {isIncome && hasValue && <Text style={styles.creditSymbol}>+ </Text>}
                                                <Text style={styles.legendAmount}>₹{formatCurrency(reportData[key])}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Total Amount</Text>
                                <Text style={styles.totalAmount}>₹{formatCurrency(netTotal)}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.downloadButton} onPress={downloadReport}>
                            <MaterialIcons name="download" size={20} color="#FFF" />
                            <Text style={styles.downloadButtonText}>Download Report</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>

            <DateTimePickerModal isVisible={isDatePickerVisible} mode="date" onConfirm={handleConfirmDate} onCancel={hideDatePicker} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: COLORS.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 4,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
    headerSubtitle: { fontSize: 13, color: COLORS.textSub },

    scrollContent: { padding: 15 },
    
    // Filters
    filterContainer: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, elevation: 2, marginBottom: 20 },
    segmentControl: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 8, marginBottom: 12 },
    segmentButton: { flex: 1, paddingVertical: 10, borderRadius: 7 },
    segmentActive: { backgroundColor: COLORS.primary },
    segmentText: { textAlign: 'center', fontWeight: '600', color: COLORS.textMain },
    segmentTextActive: { color: '#FFFFFF' },
    dateRangeContainer: { flexDirection: 'row', alignItems: 'center' },
    dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 10, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: COLORS.border },
    dateText: { marginLeft: 8, color: COLORS.textMain },
    
    // Report Card
    reportCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    reportHeader: { alignItems: 'center' },
    schoolName: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain },
    managedBy: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
    reportDateDisplay: { textAlign: 'center', fontSize: 14, fontWeight: '500', color: COLORS.textSub, marginTop: 10 },
    chartContainer: { alignItems: 'center', justifyContent: 'center', minHeight: 250, marginVertical: 15, backgroundColor: 'white' },
    noDataText: { fontSize: 16, color: COLORS.textSub },
    legendContainer: { marginTop: 20, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    legendLabelContainer: { flexDirection: 'row', alignItems: 'center' },
    legendColor: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
    legendLabel: { fontSize: 16, color: COLORS.textSub },
    legendAmountContainer: { flexDirection: 'row', alignItems: 'center' },
    legendAmount: { fontSize: 16, fontWeight: '600', color: COLORS.textMain },
    debitSymbol: { fontSize: 16, fontWeight: 'bold', color: COLORS.danger },
    creditSymbol: { fontSize: 16, fontWeight: 'bold', color: COLORS.success },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 2, borderTopColor: '#333', paddingHorizontal: 10 },
    totalLabel: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
    totalAmount: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
    downloadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blue, paddingVertical: 15, borderRadius: 8, marginTop: 25 },
    downloadButtonText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
});

export default ReportsScreen;