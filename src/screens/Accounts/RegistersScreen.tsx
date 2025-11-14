// Filename: screens/RegistersScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, Modal, ScrollView
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import DateTimePickerModal from "react-native-modal-datetime-picker";


const RegistersScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    // State
    const [vouchers, setVouchers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeVoucherType, setActiveVoucherType] = useState('Debit');
    const [activePeriod, setActivePeriod] = useState('overall'); // daily, monthly, overall, custom
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState('start'); // 'start' or 'end'
    const [selectedVoucher, setSelectedVoucher] = useState(null);
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);


    const fetchVouchers = useCallback(async () => {
        setIsLoading(true);
        let queryString = `/vouchers/list?voucher_type=${activeVoucherType}`;

        if (activePeriod === 'custom') {
            if (dateRange.start && dateRange.end) {
                 queryString += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
            }
        } else {
             queryString += `&period=${activePeriod}`;
        }

        try {
            const response = await apiClient.get(queryString);
            setVouchers(response.data);
        } catch (error) {
            console.error("Error fetching registers:", error);
            Alert.alert("Error", "Could not fetch voucher data.");
        } finally {
            setIsLoading(false);
        }
    }, [activeVoucherType, activePeriod, dateRange]);

    useEffect(() => {
        if (isFocused) {
            fetchVouchers();
        }
    }, [isFocused, fetchVouchers]);

    // Handlers
    const handlePeriodChange = (period) => {
        setActivePeriod(period);
        // Automatically clear custom date range if a preset period is chosen
        if (period !== 'custom') {
            setDateRange({ start: null, end: null });
        }
    };
    
    const handleVoucherTypeChange = (type) => {
        setActiveVoucherType(type);
    }

    const showDatePicker = (mode) => {
        setDatePickerMode(mode);
        setDatePickerVisibility(true);
        setActivePeriod('custom'); // Switch to custom mode when picker is opened
    };

    const hideDatePicker = () => setDatePickerVisibility(false);

    const handleConfirmDate = (date) => {
        const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
        if (datePickerMode === 'start') {
            setDateRange(prev => ({ ...prev, start: formattedDate, end: prev.end }));
        } else {
            setDateRange(prev => ({ ...prev, start: prev.start, end: formattedDate }));
        }
        hideDatePicker();
    };
    
    const viewVoucherDetails = async (voucherId) => {
        try {
            const response = await apiClient.get(`/vouchers/details/${voucherId}`);
            setSelectedVoucher(response.data);
            setDetailModalVisible(true);
        } catch (error) {
            Alert.alert("Error", "Could not fetch voucher details.");
        }
    };

    const downloadVoucher = (voucher) => {
        Alert.alert("Download", `Download functionality for ${voucher.voucher_no} is not yet implemented.`);
    };

    // Render Item for FlatList
    const renderVoucherItem = ({ item, index }: { item: any, index: number }) => (
        <View style={styles.tableRow}>
            <Text style={[styles.tableCell, {width: 40}]}>{index + 1}</Text>
            <Text style={[styles.tableCell, {width: 90}]}>{item.voucher_no}</Text>
            <Text style={[styles.tableCell, {flex: 1}]} numberOfLines={1}>{item.head_of_account}</Text>
            <Text style={[styles.tableCell, {width: 90, textAlign: 'right'}]}>₹{item.total_amount}</Text>
            <View style={[styles.tableCell, {width: 70, flexDirection: 'row', justifyContent: 'space-around'}]}>
                <TouchableOpacity onPress={() => viewVoucherDetails(item.id)}><MaterialIcons name="visibility" size={22} color="#0275d8" /></TouchableOpacity>
                <TouchableOpacity onPress={() => downloadVoucher(item)}><MaterialIcons name="download" size={22} color="#5cb85c" /></TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Registers</Text>
            </View>

            <View style={styles.filterContainer}>
                <View style={styles.tabContainer}>
                    {['Debit', 'Credit', 'Deposit'].map(type => (
                        <TouchableOpacity key={type} style={[styles.tab, activeVoucherType === type && styles.activeTab]} onPress={() => handleVoucherTypeChange(type)}>
                            <Text style={[styles.tabText, activeVoucherType === type && styles.activeTabText]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.tabContainer}>
                    {['Daily', 'Monthly', 'Overall'].map(p => (
                        <TouchableOpacity key={p} style={[styles.tab, activePeriod === p.toLowerCase() && styles.activeTab]} onPress={() => handlePeriodChange(p.toLowerCase())}>
                            <Text style={[styles.tabText, activePeriod === p.toLowerCase() && styles.activeTabText]}>{p}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                 <View style={styles.dateRangeContainer}>
                    <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('start')}>
                        <MaterialIcons name="calendar-today" size={16} color="#333" />
                        <Text style={styles.dateText}>{dateRange.start || 'From Date'}</Text>
                    </TouchableOpacity>
                     <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('end')}>
                        <MaterialIcons name="calendar-today" size={16} color="#333" />
                        <Text style={styles.dateText}>{dateRange.end || 'To Date'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.goButton} onPress={fetchVouchers}>
                         <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </View>
            </View>
            
            <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableHeaderText, {width: 40}]}>S.No</Text>
                    <Text style={[styles.tableHeaderText, {width: 90}]}>VCH No</Text>
                    <Text style={[styles.tableHeaderText, {flex: 1}]}>Head</Text>
                    <Text style={[styles.tableHeaderText, {width: 90, textAlign: 'right'}]}>Amount</Text>
                    <Text style={[styles.tableHeaderText, {width: 70, textAlign: 'center'}]}>Actions</Text>
                </View>
                {isLoading ? (
                    <ActivityIndicator size="large" color="#0275d8" style={{ marginTop: 50 }}/>
                ) : (
                    <FlatList
                        data={vouchers}
                        renderItem={renderVoucherItem}
                        keyExtractor={item => item.id.toString()}
                        ListEmptyComponent={<Text style={styles.noDataText}>No vouchers found for the selected filters.</Text>}
                    />
                )}
            </View>
            
            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmDate}
                onCancel={hideDatePicker}
            />

            {selectedVoucher && (
                 <Modal
                    animationType="slide"
                    transparent={true}
                    visible={isDetailModalVisible}
                    onRequestClose={() => setDetailModalVisible(false)}
                 >
                     <View style={styles.modalContainer}>
                         <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{selectedVoucher.voucher_type} Voucher</Text>
                            <Text style={styles.modalVoucherNo}>{selectedVoucher.voucher_no}</Text>
                            <ScrollView>
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Date:</Text> {new Date(selectedVoucher.voucher_date).toLocaleDateString('en-GB')}</Text>
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Head of A/C:</Text> {selectedVoucher.head_of_account}</Text>
                                {selectedVoucher.sub_head && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Sub Head:</Text> {selectedVoucher.sub_head}</Text>}
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Account Type:</Text> {selectedVoucher.account_type}</Text>
                                <Text style={styles.modalSectionTitle}>Particulars</Text>
                                {selectedVoucher.particulars.map((p, i) => (
                                    <View key={i} style={styles.particularRow}>
                                        <Text style={styles.particularDesc}>{p.description}</Text>
                                        <Text style={styles.particularAmt}>₹{p.amount}</Text>
                                    </View>
                                ))}
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalText}>Total Amount:</Text>
                                    <Text style={styles.totalAmount}>₹{selectedVoucher.total_amount}</Text>
                                </View>
                            </ScrollView>
                            <TouchableOpacity style={styles.closeButton} onPress={() => setDetailModalVisible(false)}>
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                         </View>
                     </View>
                 </Modal>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#DDD', elevation: 2 },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
    filterContainer: { padding: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0'},
    tabContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
    tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#DDD' },
    activeTab: { backgroundColor: '#0275d8', borderColor: '#0275d8' },
    tabText: { fontWeight: 'bold', color: '#555' },
    activeTabText: { color: '#FFF' },
    dateRangeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E9ECEF', padding: 10, borderRadius: 6, flex: 1, marginHorizontal: 4 },
    dateText: { marginLeft: 8, color: '#495057' },
    goButton: { backgroundColor: '#5cb85c', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginLeft: 4, elevation: 2},
    goButtonText: { color: '#FFF', fontWeight: 'bold'},
    table: { flex: 1, margin: 12, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#DEE2E6', overflow: 'hidden' },
    tableHeader: { backgroundColor: '#F8F9FA', borderBottomWidth: 2, borderColor: '#DEE2E6' },
    tableRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE', alignItems: 'center' },
    tableHeaderText: { fontWeight: 'bold', color: '#495057' },
    tableCell: { paddingHorizontal: 4, color: '#333' },
    noDataText: { textAlign: 'center', marginTop: 50, color: '#6c757d', fontSize: 16 },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 10, padding: 20, elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, textAlign: 'center', color: '#1A202C' },
    modalVoucherNo: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 15 },
    detailRow: { fontSize: 16, marginBottom: 8 },
    detailLabel: { fontWeight: 'bold', color: '#4A5568' },
    modalSectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 5, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10 },
    particularRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5},
    particularDesc: { flex: 1, color: '#4A5568' },
    particularAmt: { fontWeight: 'bold', color: '#1A202C' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#333' },
    totalText: { fontSize: 16, fontWeight: 'bold', color: '#1A202C' },
    totalAmount: { fontSize: 16, fontWeight: 'bold', color: '#1A202C' },
    closeButton: { backgroundColor: '#d9534f', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    closeButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default RegistersScreen;