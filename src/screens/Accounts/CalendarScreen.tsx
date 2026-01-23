import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    Linking,
    Dimensions
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    success: '#439da0',
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

// --- Helper: Get Local Date String ---
const getLocalDateString = () => {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

const CalendarScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    // Use local date to ensure current day is accurate
    const [selectedDate, setSelectedDate] = useState(getLocalDateString());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [vouchers, setVouchers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // State for modal and selected voucher details
    const [selectedVoucher, setSelectedVoucher] = useState(null);
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);

    // Fetch vouchers for the currently selected date
    const fetchVouchersForDate = useCallback(async (date) => {
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/vouchers/list`, {
                params: { date: date }
            });
            setVouchers(response.data);
        } catch (error) {
            console.error("Error fetching vouchers for the selected date:", error);
            Alert.alert("Error", "Could not fetch voucher data for this date.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isFocused) {
            fetchVouchersForDate(selectedDate);
        }
    }, [isFocused, selectedDate, fetchVouchersForDate]);

    // Fetch full details for a specific voucher
    const viewVoucherDetails = async (voucherId) => {
        try {
            const response = await apiClient.get(`/vouchers/details/${voucherId}`);
            setSelectedVoucher(response.data);
            setDetailModalVisible(true);
        } catch (error) {
            Alert.alert("Error", "Could not fetch voucher details.");
        }
    };
    
    const handleViewProof = (attachmentUrl) => {
        if (!attachmentUrl) return;
        const baseUrl = apiClient.defaults.baseURL.replace('/api', '');
        const fullUrl = `${baseUrl}${attachmentUrl}`;
        Linking.openURL(fullUrl).catch(() => Alert.alert("Error", `Cannot open this URL: ${fullUrl}`));
    };

    const handleDayPress = (day) => {
        setSelectedDate(day.dateString);
    };

    const changeMonth = (monthOffset) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + monthOffset);
        setCurrentMonth(newDate);
    };
    
    const markedDates = useMemo(() => ({
        [selectedDate]: {
            selected: true,
            disableTouchEvent: true,
            customStyles: {
                container: { backgroundColor: COLORS.primary, borderRadius: 8 }, // Changed to Teal
                text: { color: 'white', fontWeight: 'bold' },
            },
        },
    }), [selectedDate]);
    
    const renderVoucherItem = ({ item, index }) => {
        let amountStyle, amountPrefix;

        switch (item.voucher_type) {
            case 'Debit':
                amountStyle = styles.amountDebit;
                amountPrefix = '- ';
                break;
            case 'Credit':
            case 'Deposit':
                amountStyle = styles.amountCredit;
                amountPrefix = '+ ';
                break;
            default:
                amountStyle = styles.amountDefault;
                amountPrefix = '';
                break;
        }

        return (
            <TouchableOpacity style={styles.tableRow} onPress={() => viewVoucherDetails(item.id)}>
                <View style={styles.rowLeft}>
                    <View style={styles.snoBadge}>
                        <Text style={styles.snoText}>{index + 1}</Text>
                    </View>
                    <View style={styles.rowTextContent}>
                        <Text style={styles.vchText}>VCH: {item.voucher_no}</Text>
                        <Text style={styles.headText} numberOfLines={1}>{item.head_of_account}</Text>
                    </View>
                </View>
                <View style={styles.rowRight}>
                    <Text style={[styles.amountText, amountStyle]}>
                        {`${amountPrefix}₹${formatCurrency(item.total_amount)}`}
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color={COLORS.border} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>

                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="calendar-month" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Calendar</Text>
                        <Text style={styles.headerSubtitle}>Daily Transactions</Text>
                    </View>
                </View>
            </View>

            <View style={styles.mainContent}>
                {/* --- CALENDAR CARD --- */}
                <View style={styles.calendarCard}>
                    <View style={styles.calendarHeaderBar}>
                        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrowButton}>
                            <MaterialIcons name="chevron-left" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.monthTitle}>
                            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </Text>
                        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.arrowButton}>
                            <MaterialIcons name="chevron-right" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <Calendar
                        key={currentMonth.toISOString()}
                        current={currentMonth.toISOString().split('T')[0]}
                        onDayPress={handleDayPress}
                        markingType={'custom'}
                        markedDates={markedDates}
                        hideArrows={true}
                        onMonthChange={(month) => setCurrentMonth(new Date(month.dateString))}
                        theme={{
                            calendarBackground: '#FFFFFF',
                            textSectionTitleColor: COLORS.textSub,
                            todayTextColor: COLORS.danger,
                            dayTextColor: COLORS.textMain,
                            textDisabledColor: '#D3D3D3',
                            monthTextColor: 'transparent', // Hidden because we use custom header
                            textDayFontWeight: '500',
                            textDayHeaderFontWeight: '600',
                            textDayFontSize: 14,
                            textDayHeaderFontSize: 12,
                        }}
                    />
                </View>

                {/* --- ENTRIES LIST CARD --- */}
                <View style={[styles.entriesCard]}>
                    <Text style={styles.entriesTitle}>
                        Entries for {new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                    
                    {isLoading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }}/>
                    ) : vouchers.length > 0 ? (
                        <FlatList 
                            data={vouchers} 
                            renderItem={renderVoucherItem} 
                            keyExtractor={(item) => item.id.toString()}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{paddingBottom: 20}}
                        />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <MaterialIcons name="event-busy" size={50} color={COLORS.border} />
                            <Text style={styles.emptyText}>No entries found for this date.</Text>
                        </View>
                    )}
                </View>
            </View>
            
            {/* --- MODAL FOR VOUCHER DETAILS --- */}
            {selectedVoucher && (
                 <Modal animationType="slide" transparent={true} visible={isDetailModalVisible} onRequestClose={() => setDetailModalVisible(false)}>
                     <View style={styles.modalOverlay}>
                         <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{selectedVoucher.voucher_type} Voucher</Text>
                                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                                    <MaterialIcons name="close" size={24} color={COLORS.textSub} />
                                </TouchableOpacity>
                            </View>
                            
                            <Text style={styles.modalVoucherNo}>#{selectedVoucher.voucher_no}</Text>
                            
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.detailBlock}>
                                    <DetailItem label="Date" value={new Date(selectedVoucher.voucher_date).toLocaleDateString('en-GB')} />
                                    {selectedVoucher.name_title && <DetailItem label="Name" value={selectedVoucher.name_title} />}
                                    {selectedVoucher.phone_no && <DetailItem label="Phone" value={selectedVoucher.phone_no} />}
                                    <DetailItem label="Head" value={selectedVoucher.head_of_account} />
                                    {selectedVoucher.sub_head && <DetailItem label="Sub Head" value={selectedVoucher.sub_head} />}
                                    <DetailItem label="Type" value={selectedVoucher.account_type} />
                                    <DetailItem label={selectedVoucher.transaction_context_type} value={selectedVoucher.transaction_context_value} />
                                </View>

                                <Text style={styles.sectionHeader}>Particulars</Text>
                                {selectedVoucher.particulars.map((p, i) => (
                                    <View key={i} style={styles.particularRow}>
                                        <Text style={styles.particularDesc}>{p.description}</Text>
                                        <Text style={styles.particularAmt}>₹{formatCurrency(p.amount)}</Text>
                                    </View>
                                ))}

                                <View style={styles.totalRow}>
                                    <Text style={styles.totalText}>Total Amount</Text>
                                    <Text style={styles.totalAmount}>₹{formatCurrency(selectedVoucher.total_amount)}</Text>
                                </View>
                                
                                {selectedVoucher.attachment_url && (
                                    <TouchableOpacity style={styles.viewProofButton} onPress={() => handleViewProof(selectedVoucher.attachment_url)}>
                                        <MaterialCommunityIcons name="paperclip" size={20} color="#FFF" />
                                        <Text style={styles.viewProofButtonText}>View Attachment</Text>
                                    </TouchableOpacity>
                                )}
                                
                                <View style={styles.userInfoContainer}>
                                    <Text style={styles.userInfoText}>Created by: {selectedVoucher.creator_name || 'N/A'}</Text>
                                    {selectedVoucher.updater_name && (
                                        <Text style={styles.userInfoText}>Updated: {selectedVoucher.updater_name} ({new Date(selectedVoucher.updated_at).toLocaleDateString()})</Text>
                                    )}
                                </View>
                            </ScrollView>
                         </View>
                     </View>
                 </Modal>
            )}
        </SafeAreaView>
    );
};

// Helper component for Modal Details
const DetailItem = ({ label, value }) => (
    <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}:</Text>
        <Text style={styles.detailValue}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    
    // --- Header Style ---
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
    backButton: { marginRight: 10, padding: 4 },
    headerIconContainer: {
        backgroundColor: '#E0F2F1',
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

    mainContent: { flex: 1, paddingHorizontal: 10 },

    // --- Calendar Card ---
    calendarCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    calendarHeaderBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.primary, // Teal
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    monthTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    arrowButton: { padding: 5 },

    // --- Entries List Card ---
    entriesCard: {
        flex: 1,
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    entriesTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 8 },
    
    // List Item
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0'
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    snoBadge: {
        backgroundColor: '#F5F5F5',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10
    },
    snoText: { fontSize: 12, color: COLORS.textSub, fontWeight: 'bold' },
    rowTextContent: { flex: 1 },
    vchText: { fontSize: 12, color: COLORS.textSub, marginBottom: 2 },
    headText: { fontSize: 14, color: COLORS.textMain, fontWeight: '500' },
    
    rowRight: { flexDirection: 'row', alignItems: 'center' },
    amountText: { fontSize: 14, fontWeight: 'bold', marginRight: 5 },
    amountDebit: { color: COLORS.danger },
    amountCredit: { color: COLORS.success },
    amountDefault: { color: COLORS.textMain },
    
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    emptyText: { fontSize: 15, color: COLORS.textSub, marginTop: 10 },

    // --- Modal Styles ---
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { 
        backgroundColor: '#FFF', 
        borderTopLeftRadius: 20, 
        borderTopRightRadius: 20, 
        padding: 20, 
        maxHeight: '85%',
        elevation: 10
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain },
    modalVoucherNo: { fontSize: 16, color: COLORS.primary, fontWeight: '600', marginBottom: 20 },
    
    detailBlock: { backgroundColor: '#F9FAFB', padding: 15, borderRadius: 10, marginBottom: 15 },
    detailRow: { flexDirection: 'row', marginBottom: 8 },
    detailLabel: { width: 100, fontSize: 14, color: COLORS.textSub, fontWeight: '600' },
    detailValue: { flex: 1, fontSize: 14, color: COLORS.textMain },
    
    sectionHeader: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 10, marginTop: 5 },
    particularRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    particularDesc: { flex: 1, fontSize: 14, color: '#444' },
    particularAmt: { fontWeight: 'bold', color: COLORS.textMain },
    
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: COLORS.border },
    totalText: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
    totalAmount: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    
    viewProofButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blue, padding: 12, borderRadius: 8, marginTop: 20 },
    viewProofButtonText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
    
    userInfoContainer: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#EEE', alignItems: 'center' },
    userInfoText: { fontSize: 12, color: '#90A4AE', marginBottom: 4 },
});

export default CalendarScreen;