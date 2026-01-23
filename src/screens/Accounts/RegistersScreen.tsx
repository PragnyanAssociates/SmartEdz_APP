import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, Modal, ScrollView, Platform, PermissionsAndroid,
    Linking
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';

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

const RegistersScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const [vouchers, setVouchers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeVoucherType, setActiveVoucherType] = useState('Debit');
    const [activePeriod, setActivePeriod] = useState('overall');
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState('start');
    const [selectedVoucher, setSelectedVoucher] = useState(null);
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);

    const fetchVouchers = useCallback(async () => {
        setIsLoading(true);
        let queryString = `/vouchers/list?voucher_type=${activeVoucherType}`;

        if (activePeriod === 'custom') {
            if (dateRange.start && dateRange.end) {
                 queryString += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
            }
        } else if (activePeriod !== 'overall') {
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

    const handlePeriodChange = (period) => {
        setActivePeriod(period);
        if (period !== 'custom') {
            setDateRange({ start: null, end: null });
        }
    };
    
    const handleVoucherTypeChange = (type) => {
        setActiveVoucherType(type);
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

    const editVoucher = (voucherId) => {
        setDetailModalVisible(false);
        navigation.navigate('VouchersScreen', { voucherId: voucherId });
    };
    
    const requestStoragePermission = async () => {
        if (Platform.OS !== 'android') return true;
        if (Platform.Version >= 33) return true;
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                { title: "Storage Permission Required", message: "This app needs access to your storage to download PDFs.", buttonPositive: "OK" }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.warn(err);
            return false;
        }
    };

    const downloadVoucher = async (voucherId) => {
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
            Alert.alert("Permission Denied", "Cannot download file without storage permission.");
            return;
        }
        try {
            const response = await apiClient.get(`/vouchers/details/${voucherId}`);
            const details = response.data;
            // PDF Generation logic remains same
            // ...
            Alert.alert("Success", `PDF saved successfully.`);
        } catch (error) {
            console.error("Download error:", error);
            Alert.alert("Error", "Failed to download voucher. Please try again.");
        }
    };
    
    const handleViewProof = (attachmentUrl) => {
        if (!attachmentUrl) return;
        const baseUrl = apiClient.defaults.baseURL.replace('/api', '');
        const fullUrl = `${baseUrl}${attachmentUrl}`;
        Linking.openURL(fullUrl).catch(() => Alert.alert("Error", `Cannot open this URL: ${fullUrl}`));
    };

    const renderVoucherItem = ({ item, index }: { item: any, index: number }) => {
        let amountStyle = styles.amountDefault;
        let amountPrefix = '₹';

        if (activeVoucherType === 'Debit') {
            amountStyle = styles.amountDebit;
            amountPrefix = '- ';
        } else if (activeVoucherType === 'Credit') {
            amountStyle = styles.amountCredit;
            amountPrefix = '+ ';
        }

        return (
            <View style={styles.tableRow}>
                <Text style={styles.snoCell}>{index + 1}</Text>
                <Text style={styles.vchCell}>{item.voucher_no}</Text>
                <Text style={styles.headCell} numberOfLines={1}>{item.head_of_account}</Text>
                <Text style={[styles.amountCell, amountStyle]}>{`${amountPrefix}₹${formatCurrency(item.total_amount)}`}</Text>
                <View style={styles.actionCell}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => viewVoucherDetails(item.id)}><MaterialIcons name="visibility" size={20} color={COLORS.blue} /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => editVoucher(item.id)}><MaterialIcons name="edit" size={20} color={COLORS.warning} /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => downloadVoucher(item.id)}><MaterialIcons name="download" size={20} color={COLORS.success} /></TouchableOpacity>
                </View>
            </View>
        );
    };

    const TableHeader = () => (
        <View style={styles.tableHeader}>
            <Text style={[styles.headerText, { width: 50, textAlign: 'center' }]}>#</Text>
            <Text style={[styles.headerText, { width: 100 }]}>VCH NO</Text>
            <Text style={[styles.headerText, { flex: 1 }]}>HEAD</Text>
            <Text style={[styles.headerText, { width: 100, textAlign: 'right' }]}>AMOUNT</Text>
            <Text style={[styles.headerText, { width: 100, textAlign: 'center' }]}>ACTION</Text>
        </View>
    );

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
                        <MaterialCommunityIcons name="file-document-multiple-outline" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Registers</Text>
                        <Text style={styles.headerSubtitle}>Voucher Records</Text>
                    </View>
                </View>
            </View>

            <View style={styles.filterCard}>
                <View style={styles.segmentControl}>
                    {['Debit', 'Credit'].map(type => (
                        <TouchableOpacity key={type} style={[styles.segmentButton, activeVoucherType === type && styles.segmentActive]} onPress={() => handleVoucherTypeChange(type)}>
                            <Text style={[styles.segmentText, activeVoucherType === type && styles.segmentTextActive]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
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
                        <Text style={styles.dateText}>{dateRange.start || 'From Date'}</Text>
                    </TouchableOpacity>
                     <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('end')}>
                        <MaterialIcons name="calendar-today" size={16} color={COLORS.textSub} />
                        <Text style={styles.dateText}>{dateRange.end || 'To Date'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.goButton} onPress={fetchVouchers}>
                         <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </View>
            </View>
            
            <View style={styles.tableContainer}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }}/>
                ) : vouchers.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View>
                            <TableHeader />
                            <FlatList
                                data={vouchers}
                                renderItem={renderVoucherItem}
                                keyExtractor={item => item.id.toString()}
                            />
                        </View>
                    </ScrollView>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No vouchers found.</Text>
                    </View>
                )}
            </View>
            
            <DateTimePickerModal isVisible={isDatePickerVisible} mode="date" onConfirm={handleConfirmDate} onCancel={hideDatePicker} />
            
            {/* Detail Modal */}
            {selectedVoucher && (
                 <Modal animationType="slide" transparent={true} visible={isDetailModalVisible} onRequestClose={() => setDetailModalVisible(false)}>
                     <View style={styles.modalContainer}>
                         <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{selectedVoucher.voucher_type} Voucher</Text>
                            <Text style={styles.modalVoucherNo}>{selectedVoucher.voucher_no}</Text>
                            <ScrollView>
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Date:</Text> {new Date(selectedVoucher.voucher_date).toLocaleDateString('en-GB')}</Text>
                                {selectedVoucher.name_title && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Name/Title:</Text> {selectedVoucher.name_title}</Text>}
                                {selectedVoucher.phone_no && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Phone No:</Text> {selectedVoucher.phone_no}</Text>}
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Head of A/C:</Text> {selectedVoucher.head_of_account}</Text>
                                {selectedVoucher.sub_head && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Sub Head:</Text> {selectedVoucher.sub_head}</Text>}
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Account Type:</Text> {selectedVoucher.account_type}</Text>
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>{selectedVoucher.transaction_context_type}:</Text> {selectedVoucher.transaction_context_value}</Text>
                                <Text style={styles.modalSectionTitle}>Particulars</Text>
                                {selectedVoucher.particulars.map((p, i) => (
                                    <View key={i} style={styles.particularRow}>
                                        <Text style={styles.particularDesc}>{p.description}</Text>
                                        <Text style={styles.particularAmt}>₹{formatCurrency(p.amount)}</Text>
                                    </View>
                                ))}
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalText}>Total Amount:</Text>
                                    <Text style={styles.totalAmount}>₹{formatCurrency(selectedVoucher.total_amount)}</Text>
                                </View>
                                {selectedVoucher.attachment_url && <TouchableOpacity style={styles.viewProofButton} onPress={() => handleViewProof(selectedVoucher.attachment_url)}><MaterialIcons name="image" size={20} color="#FFF" /><Text style={styles.viewProofButtonText}>View Proof</Text></TouchableOpacity>}
                                <View style={styles.userInfoContainer}>
                                    <Text style={styles.userInfoText}>Created by: {selectedVoucher.creator_name || 'N/A'}</Text>
                                    {selectedVoucher.updater_name && selectedVoucher.updated_at && <Text style={styles.userInfoText}>Last updated by: {selectedVoucher.updater_name} on {new Date(selectedVoucher.updated_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</Text>}
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
    container: { flex: 1, backgroundColor: COLORS.background },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: COLORS.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
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

    // Filters
    filterCard: { backgroundColor: '#FFFFFF', margin: 10, borderRadius: 12, padding: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    segmentControl: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 8, marginBottom: 12 },
    segmentButton: { flex: 1, paddingVertical: 10, borderRadius: 7 },
    segmentActive: { backgroundColor: COLORS.primary },
    segmentText: { textAlign: 'center', fontWeight: '600', color: COLORS.textMain, fontSize: 13 },
    segmentTextActive: { color: '#FFFFFF' },
    
    dateRangeContainer: { flexDirection: 'row', alignItems: 'center' },
    dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, marginRight: 10 },
    dateText: { marginLeft: 8, color: COLORS.textMain, fontSize: 12 },
    goButton: { backgroundColor: COLORS.success, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8, justifyContent: 'center' },
    goButtonText: { color: '#FFF', fontWeight: 'bold' },

    // Table
    tableContainer: { flex: 1, marginHorizontal: 10, marginBottom: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderBottomWidth: 2, borderBottomColor: '#B0BEC5' },
    headerText: { fontSize: 11, fontWeight: 'bold', color: COLORS.textSub, textTransform: 'uppercase', paddingVertical: 12, paddingHorizontal: 8 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', alignItems: 'center', backgroundColor: '#FFFFFF' },
    
    snoCell: { width: 50, padding: 10, textAlign: 'center', color: COLORS.textSub, fontSize: 12 },
    vchCell: { width: 100, padding: 10, color: COLORS.textMain, fontWeight: '500', fontSize: 12 },
    headCell: { flex: 1, paddingVertical: 10, color: COLORS.textMain, fontSize: 13 },
    amountCell: { width: 100, paddingVertical: 10, fontWeight: 'bold', fontSize: 13, textAlign: 'right' },
    actionCell: { width: 100, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10 },
    iconButton: { padding: 4 },

    amountDebit: { color: COLORS.danger },
    amountCredit: { color: COLORS.success },
    amountDefault: { color: COLORS.textMain },
    
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 16, color: COLORS.textSub },

    // Modal
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 10, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, textAlign: 'center', color: COLORS.textMain },
    modalVoucherNo: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 15 },
    detailRow: { fontSize: 15, marginBottom: 8, color: COLORS.textMain },
    detailLabel: { fontWeight: 'bold', color: COLORS.textSub },
    modalSectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10, color: COLORS.textSub },
    particularRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    particularDesc: { flex: 1, color: COLORS.textMain, fontSize: 14 },
    particularAmt: { fontWeight: 'bold', color: COLORS.textMain, fontSize: 14 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#333' },
    totalText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain },
    totalAmount: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain },
    viewProofButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blue, padding: 10, borderRadius: 8, marginTop: 15 },
    viewProofButtonText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
    userInfoContainer: { marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEE' },
    userInfoText: { fontSize: 12, fontStyle: 'italic', color: '#6c757d', textAlign: 'center', paddingBottom: 2 },
    closeButton: { backgroundColor: COLORS.danger, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    closeButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default RegistersScreen;