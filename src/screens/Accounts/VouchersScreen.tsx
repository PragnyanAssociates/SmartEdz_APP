import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList,
    SafeAreaView, Alert, ActivityIndicator, Platform, Modal
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native';
import apiClient from '../../api/client';
import * as Animatable from 'react-native-animatable';

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
    blue: '#1E88E5'
};

type VoucherType = 'Debit' | 'Credit';
interface ParticularRow { description: string; amount: string; }
interface RecentVoucher { id: number; voucher_no: string; head_of_account: string; sub_head: string | null; account_type: string; total_amount: number; }

const headOfAccountOptions = [ 'Fee', 'Salaries', 'Donations', 'Utilities/Bills', 'Transport', 'Assets', 'Government Grants/Aids', 'Investments', 'Staff Welfare', 'Student Welfare', 'Repairs', 'Security/CCTV', 'Kitchen', 'Maintenance', 'Laboratories/Library', 'Miscellaneous' ];
const accountTypeOptions = ['UPI', 'Bank', 'Cheque', 'Cash', 'Kind', 'Others'];
const transactionContextOptions = ['Opening Balance', 'Cash'];

const formatCurrency = (amount: number | string) => { const num = Number(amount) || 0; return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num); };
const numberToWords = (num: number): string => { if (num === 0) return 'Zero'; const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']; const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']; const convert = (n: number): string => { if (n === 0) return ''; if (n < 20) return units[n]; if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : ''); if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : ''); if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : ''); if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : ''); return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : ''); }; return convert(Math.floor(num)).trim(); };

const VouchersScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const route = useRoute();
    const voucherId = route.params?.voucherId;

    const [mode, setMode] = useState(voucherId ? 'edit' : 'create');
    const [isLoading, setIsLoading] = useState(!!voucherId);
    const [voucherType, setVoucherType] = useState<VoucherType>('Debit');
    const [voucherNo, setVoucherNo] = useState<string>('Loading...');
    const [voucherDate, setVoucherDate] = useState<string>(new Date().toLocaleDateString('en-GB'));
    const [nameTitle, setNameTitle] = useState('');
    const [phoneNo, setPhoneNo] = useState('');
    const [headOfAccount, setHeadOfAccount] = useState<string>('');
    const [subHead, setSubHead] = useState('');
    const [accountType, setAccountType] = useState<string>('UPI');
    const [transactionContextValue, setTransactionContextValue] = useState<string>('Opening Balance');
    const [particulars, setParticulars] = useState<ParticularRow[]>([{ description: '', amount: '' }]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [amountInWords, setAmountInWords] = useState('Zero Rupees Only');
    const [attachment, setAttachment] = useState<ImagePickerResponse | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [recentVouchers, setRecentVouchers] = useState<RecentVoucher[]>([]);
    const [isLoadingRecent, setIsLoadingRecent] = useState(false);
    const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
    const [isAttachmentRemoved, setIsAttachmentRemoved] = useState(false);

    const fetchVoucherDetails = useCallback(async (id) => { setIsLoading(true); try { const response = await apiClient.get(`/vouchers/details/${id}`); const data = response.data; setVoucherType(data.voucher_type); setVoucherNo(data.voucher_no); setVoucherDate(new Date(data.voucher_date).toLocaleDateString('en-GB')); setNameTitle(data.name_title || ''); setPhoneNo(data.phone_no || ''); setHeadOfAccount(data.head_of_account); setSubHead(data.sub_head || ''); setAccountType(data.account_type); setTransactionContextValue(data.transaction_context_value); setParticulars(data.particulars.map(p => ({ description: p.description, amount: String(p.amount) }))); setExistingAttachmentUrl(data.attachment_url); } catch (error) { Alert.alert("Error", "Failed to load voucher details for editing.", [{ text: "OK", onPress: () => navigation.goBack() }]); } finally { setIsLoading(false); } }, [navigation]);
    const fetchNextVoucherNumber = useCallback(async () => { try { const response = await apiClient.get('/vouchers/next-number'); setVoucherNo(response.data.nextVoucherNo); } catch (error) { setVoucherNo('VCH-Error'); Alert.alert('Error', 'Could not fetch the next voucher number.'); } }, []);
    const fetchRecentVouchers = useCallback(async () => { setIsLoadingRecent(true); try { const response = await apiClient.get('/vouchers/list?limit=5'); setRecentVouchers(response.data); } catch (error) { console.error("Failed to fetch recent vouchers:", error); } finally { setIsLoadingRecent(false); } }, []);
    
    const initializeCreateMode = useCallback(() => { setMode('create'); setVoucherType('Debit'); setVoucherDate(new Date().toLocaleDateString('en-GB')); setNameTitle(''); setPhoneNo(''); setHeadOfAccount(''); setSubHead(''); setAccountType('UPI'); setTransactionContextValue('Opening Balance'); setParticulars([{ description: '', amount: '' }]); setAttachment(null); setExistingAttachmentUrl(null); setIsAttachmentRemoved(false); fetchNextVoucherNumber(); fetchRecentVouchers(); }, [fetchNextVoucherNumber, fetchRecentVouchers]);

    useEffect(() => { if (isFocused) { const currentVoucherId = route.params?.voucherId; if (currentVoucherId) { setMode('edit'); fetchVoucherDetails(currentVoucherId); } else { initializeCreateMode(); } } }, [isFocused, route.params?.voucherId, fetchVoucherDetails, initializeCreateMode]);
    useEffect(() => { const total = particulars.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0); setTotalAmount(total); }, [particulars]);
    useEffect(() => { setAmountInWords(`${numberToWords(totalAmount)} Rupees Only`); }, [totalAmount]);

    const handleAddRow = () => setParticulars([...particulars, { description: '', amount: '' }]);
    const handleRemoveRow = (index: number) => { if (particulars.length > 1) setParticulars(particulars.filter((_, i) => i !== index)); };
    const handleParticularChange = (index: number, field: keyof ParticularRow, value: string) => { const newParticulars = [...particulars]; newParticulars[index][field] = value; setParticulars(newParticulars); };
    const handleChooseFile = () => { launchImageLibrary({ mediaType: 'photo' }, (response) => { if (response.didCancel || response.errorCode) return; setAttachment(response); setExistingAttachmentUrl(null); setIsAttachmentRemoved(false); }); };
    const handleRemoveExistingAttachment = () => { setExistingAttachmentUrl(null); setIsAttachmentRemoved(true); };
    const handleCancel = () => Alert.alert("Confirm Cancel", "Are you sure you want to clear the form?", [{ text: "No", style: "cancel" }, { text: "Yes", style: "destructive", onPress: initializeCreateMode }]);

    const handleSave = async () => {
        const validParticulars = particulars.filter(p => p.description.trim() !== '' && !isNaN(parseFloat(p.amount)) && parseFloat(p.amount) > 0);
        if (!headOfAccount) return Alert.alert('Validation Error', 'Please select a "Head of A/C".');
        if (!transactionContextValue) return Alert.alert('Validation Error', 'Please select a source/destination for the transaction.');
        if (validParticulars.length === 0 && totalAmount !== 0) return Alert.alert('Validation Error', 'Please add at least one valid particular if the amount is not zero.');

        setIsSaving(true);
        const formData = new FormData();
        formData.append('voucherType', voucherType); formData.append('name_title', nameTitle); formData.append('phoneNo', phoneNo); formData.append('headOfAccount', headOfAccount); formData.append('subHead', subHead); formData.append('accountType', accountType); formData.append('transaction_context_type', voucherType === 'Debit' ? 'Deduction From' : 'Adding to'); formData.append('transaction_context_value', transactionContextValue); formData.append('totalAmount', totalAmount.toFixed(2)); formData.append('amountInWords', amountInWords); formData.append('particulars', JSON.stringify(validParticulars));
        const dateParts = voucherDate.split('/'); const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; formData.append('voucherDate', isoDate);
        if (mode === 'create') formData.append('voucherNo', voucherNo);
        if (attachment?.assets?.[0]) formData.append('attachment', { uri: Platform.OS === 'android' ? attachment.assets[0].uri : attachment.assets[0].uri!.replace('file://', ''), type: attachment.assets[0].type, name: attachment.assets[0].fileName });
        if (isAttachmentRemoved) formData.append('removeAttachment', 'true');

        try {
            let response;
            if (mode === 'edit') {
                response = await apiClient.put(`/vouchers/update/${voucherId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert('Success', response.data.message || 'Voucher updated successfully!', [{ text: 'OK', onPress: () => navigation.navigate('RegistersScreen') }]);
            } else {
                response = await apiClient.post('/vouchers/create', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert('Success', response.data.message, [{ text: 'OK', onPress: initializeCreateMode }]);
            }
        } catch (error: any) { Alert.alert('Error', error.response?.data?.message || 'An error occurred while saving.'); } 
        finally { setIsSaving(false); }
    };
    
    const getFilenameFromUrl = (url: string | null) => { if (!url) return 'Upload Proof'; return url.split('/').pop(); };
    const renderRecentVoucherItem = ({ item, index }: { item: RecentVoucher, index: number }) => ( <View style={styles.recentVoucherRow}><Text style={styles.recentVoucherCellSNo}>{index + 1}</Text><Text style={styles.recentVoucherCell}>{item.voucher_no}</Text><Text style={styles.recentVoucherCell} numberOfLines={1}>{item.head_of_account}</Text><Text style={styles.recentVoucherCellAmount}>₹{formatCurrency(item.total_amount)}</Text></View> );

    if (isLoading) { return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>; }

    let uploadButtonText = 'Upload Proof';
    if (attachment?.assets?.[0]?.fileName) uploadButtonText = attachment.assets[0].fileName; else if (existingAttachmentUrl) uploadButtonText = getFilenameFromUrl(existingAttachmentUrl);
    const transactionContextLabel = voucherType === 'Debit' ? 'Deduction From*:' : 'Adding to*:';

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
                        <MaterialCommunityIcons name="receipt" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>{mode === 'edit' ? `Edit Voucher` : 'Vouchers'}</Text>
                        <Text style={styles.headerSubtitle}>{voucherNo}</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                {/* Type Toggles */}
                <View style={styles.tabContainer}>
                    {(['Debit', 'Credit'] as VoucherType[]).map(type => (
                        <TouchableOpacity key={type} style={[styles.tab, voucherType === type && styles.activeTab]} onPress={() => setVoucherType(type)}>
                            <Text style={[styles.tabText, voucherType === type && styles.activeTabText]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Animatable.View animation="fadeInUp" duration={500} style={styles.voucherCard}>
                    <Text style={styles.schoolTitle}>Vivekananda Public School</Text>
                    <Text style={styles.voucherTitle}>{voucherType} Voucher</Text>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoText}>No: {voucherNo}</Text>
                        <Text style={styles.infoText}>Date: {voucherDate}</Text>
                    </View>

                    <View style={styles.formRow}>
                        <Text style={styles.label}>{transactionContextLabel}</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker selectedValue={transactionContextValue} onValueChange={(itemValue) => setTransactionContextValue(itemValue)}>
                                {transactionContextOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                            </Picker>
                        </View>
                    </View>
                    
                    <Text style={styles.label}>Name/Title:</Text><TextInput style={styles.input} value={nameTitle} onChangeText={setNameTitle} />
                    <Text style={styles.label}>Phone No:</Text><TextInput style={styles.input} value={phoneNo} onChangeText={setPhoneNo} keyboardType="phone-pad"/>
                    
                    <Text style={styles.label}>Head of A/C*:</Text>
                    <View style={styles.pickerWrapper}>
                        <Picker selectedValue={headOfAccount} onValueChange={(itemValue) => setHeadOfAccount(itemValue)}>
                            <Picker.Item label="Select Head of A/C" value="" />
                            {headOfAccountOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                        </Picker>
                    </View>

                    <Text style={styles.label}>Sub Head:</Text><TextInput style={styles.input} value={subHead} onChangeText={setSubHead} />
                    
                    <Text style={styles.label}>Account Type:</Text>
                     <View style={styles.pickerWrapper}>
                        <Picker selectedValue={accountType} onValueChange={(itemValue) => setAccountType(itemValue)}>
                            {accountTypeOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                        </Picker>
                    </View>

                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderText}>Particulars</Text>
                            <Text style={[styles.tableHeaderText, { flex: 0.5, textAlign: 'right' }]}>Amount</Text>
                        </View>
                        {particulars.map((row, index) => (
                            <View key={index} style={styles.tableRow}>
                                <TextInput style={[styles.tableInput, styles.descriptionInput]} placeholder="Description" value={row.description} onChangeText={(val) => handleParticularChange(index, 'description', val)} />
                                <TextInput style={[styles.tableInput, styles.amountInput]} placeholder="0.00" value={row.amount} onChangeText={(val) => handleParticularChange(index, 'amount', val)} keyboardType="numeric" />
                                {particulars.length > 1 && (<TouchableOpacity onPress={() => handleRemoveRow(index)} style={styles.removeButton}><MaterialIcons name="remove-circle-outline" size={22} color="#d9534f" /></TouchableOpacity>)}
                            </View>
                        ))}
                        <TouchableOpacity style={styles.addRowButton} onPress={handleAddRow}><MaterialIcons name="add-circle-outline" size={20} color={COLORS.blue} /><Text style={styles.addRowText}>Add Row</Text></TouchableOpacity>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalText}>Total:</Text>
                            <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
                        </View>
                    </View>

                    <View style={styles.wordsContainer}><Text style={styles.wordsLabel}>Amount in Words:</Text><Text style={styles.wordsText}>{amountInWords}</Text></View>
                    
                    <View style={styles.uploadContainer}>
                         <TouchableOpacity style={styles.uploadButton} onPress={handleChooseFile}>
                            <MaterialIcons name="cloud-upload" size={24} color={COLORS.blue} />
                            <Text style={styles.uploadText} numberOfLines={1}>{uploadButtonText}</Text>
                        </TouchableOpacity>
                        {existingAttachmentUrl && !attachment && (
                            <TouchableOpacity style={styles.removeAttachmentButton} onPress={handleRemoveExistingAttachment}>
                                <MaterialIcons name="close" size={22} color={COLORS.danger} />
                            </TouchableOpacity>
                        )}
                    </View>
                </Animatable.View>

                <View style={styles.buttonRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={handleSave} disabled={isSaving}>{isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Voucher</Text>}</TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={handleCancel}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                </View>
                
                {mode === 'create' && (
                    <View style={styles.recentVouchersContainer}>
                        <Text style={styles.recentVouchersTitle}>Recent Vouchers</Text>
                        <View style={styles.recentVouchersTable}>
                            <View style={[styles.recentVoucherRow, styles.recentVoucherHeader]}>
                                <Text style={[styles.recentVoucherCellSNo, styles.recentVoucherHeaderText]}>#</Text>
                                <Text style={[styles.recentVoucherCell, styles.recentVoucherHeaderText]}>VCH No</Text>
                                <Text style={[styles.recentVoucherCell, styles.recentVoucherHeaderText]}>Head</Text>
                                <Text style={[styles.recentVoucherCellAmount, styles.recentVoucherHeaderText]}>Amount</Text>
                            </View>
                            {isLoadingRecent ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} /> : <FlatList data={recentVouchers} renderItem={renderRecentVoucherItem} keyExtractor={(item) => item.id.toString()} ListEmptyComponent={<Text style={styles.noDataText}>No recent vouchers found.</Text>} />}
                        </View>
                        <TouchableOpacity style={styles.viewMoreButton} onPress={() => navigation.navigate('RegistersScreen')}>
                            <Text style={styles.viewMoreText}>View Full Register</Text>
                            <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
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

    scrollContainer: { padding: 15, paddingBottom: 30 },
    
    // Tabs
    tabContainer: { flexDirection: 'row', marginBottom: 15, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', elevation: 1 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f5f5f5' },
    activeTab: { backgroundColor: COLORS.primary },
    tabText: { fontWeight: 'bold', color: '#6c757d', fontSize: 14 },
    activeTabText: { color: '#FFF' },

    // Form
    voucherCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
    schoolTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: COLORS.primary },
    managedBy: { fontSize: 11, color: '#6c757d', textAlign: 'center', marginBottom: 10 },
    voucherTitle: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginVertical: 8, textTransform: 'uppercase', color: '#333' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 5, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 6 },
    infoText: { fontSize: 13, color: COLORS.textMain, fontWeight: '600' },
    
    formRow: { marginBottom: 10 },
    label: { fontSize: 13, fontWeight: 'bold', color: COLORS.textSub, marginBottom: 4, marginTop: 8 },
    input: { borderWidth: 1, borderColor: '#DDD', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#FAFAFA', fontSize: 14, color: COLORS.textMain },
    pickerWrapper: { borderWidth: 1, borderColor: '#DDD', borderRadius: 6, backgroundColor: '#FAFAFA' },
    
    // Table
    table: { borderWidth: 1, borderColor: '#EEE', borderRadius: 6, marginTop: 15, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F5F5F5', padding: 10, borderBottomWidth: 1, borderColor: '#EEE' },
    tableHeaderText: { fontWeight: 'bold', flex: 1, fontSize: 13, color: COLORS.textSub },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 5, borderBottomWidth: 1, borderColor: '#EEE' },
    tableInput: { height: 40, paddingHorizontal: 10, fontSize: 13, color: COLORS.textMain },
    descriptionInput: { flex: 1 },
    amountInput: { flex: 0.4, textAlign: 'right' },
    removeButton: { paddingLeft: 5 },
    addRowButton: { flexDirection: 'row', alignItems: 'center', padding: 10, justifyContent: 'center', backgroundColor: '#f9f9f9' },
    addRowText: { color: COLORS.blue, marginLeft: 5, fontWeight: 'bold', fontSize: 13 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#F5F5F5', borderTopWidth: 1, borderColor: '#EEE' },
    totalText: { fontWeight: 'bold', fontSize: 14, color: COLORS.textMain },
    totalAmount: { fontWeight: 'bold', fontSize: 14, color: COLORS.textMain },
    
    wordsContainer: { marginTop: 10, padding: 10, backgroundColor: '#F9F9F9', borderRadius: 6 },
    wordsLabel: { fontWeight: 'bold', color: COLORS.textSub, fontSize: 12 },
    wordsText: { fontSize: 13, color: COLORS.textMain, marginTop: 2 },
    
    uploadContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
    uploadButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderWidth: 1, borderColor: COLORS.blue, borderStyle: 'dashed', borderRadius: 8, backgroundColor: '#E3F2FD' },
    uploadText: { marginLeft: 10, color: COLORS.blue, flex: 1, fontSize: 13 },
    removeAttachmentButton: { marginLeft: 10, padding: 5 },
    
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    actionButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
    saveButton: { backgroundColor: COLORS.success, marginRight: 8 },
    cancelButton: { backgroundColor: '#FFB74D', marginLeft: 8 },
    buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
    
    recentVouchersContainer: { marginTop: 20, backgroundColor: '#FFF', borderRadius: 12, padding: 15, elevation: 2 },
    recentVouchersTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: COLORS.textMain },
    recentVouchersTable: { borderWidth: 1, borderColor: '#EEE', borderRadius: 6 },
    recentVoucherRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', alignItems: 'center' },
    recentVoucherHeader: { backgroundColor: '#F5F5F5' },
    recentVoucherHeaderText: { fontWeight: 'bold', color: COLORS.textSub, fontSize: 12 },
    recentVoucherCellSNo: { width: 30, fontSize: 12 },
    recentVoucherCell: { flex: 1, paddingHorizontal: 4, fontSize: 12 },
    recentVoucherCellAmount: { width: 80, textAlign: 'right', fontWeight: 'bold', fontSize: 12 },
    noDataText: { textAlign: 'center', padding: 15, color: '#999', fontSize: 13 },
    
    viewMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blue, paddingVertical: 10, borderRadius: 8, marginTop: 15 },
    viewMoreText: { color: '#FFF', fontWeight: 'bold', marginRight: 5, fontSize: 13 },
});

export default VouchersScreen;