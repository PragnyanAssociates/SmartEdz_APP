import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
    Image, Modal, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'react-native-image-picker'; 
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// --- TYPES ---
interface FeeSchedule {
    id: number;
    title: string;
    total_amount: number;
    due_date: string;
    allow_installments: number;
}

interface InstallmentDetail {
    id: number;
    installment_number: number;
    amount: number;
    due_date: string;
    status: 'unpaid' | 'pending' | 'paid' | 'rejected';
}

const StudentFeeScreen = () => {
    const { user } = useAuth();
    const [feeList, setFeeList] = useState<FeeSchedule[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Submission Modal State
    const [isSubmitModalVisible, setSubmitModalVisible] = useState(false);
    const [selectedFee, setSelectedFee] = useState<FeeSchedule | null>(null);
    
    // Logic State
    const [paymentMode, setPaymentMode] = useState<'one_time' | 'installment'>('one_time');
    const [imageUri, setImageUri] = useState('');
    
    // Installment Logic
    const [installments, setInstallments] = useState<InstallmentDetail[]>([]);
    const [selectedInstNumber, setSelectedInstNumber] = useState<number | null>(null); 
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        if (user?.class_group) {
            fetchMyFees(user.class_group);
        }
    }, [user]);

    // --- TRIGGER FETCH WHEN MODE CHANGES ---
    useEffect(() => {
        if (isSubmitModalVisible && selectedFee && paymentMode === 'installment') {
            fetchFeeDetails(selectedFee.id);
        }
    }, [paymentMode, isSubmitModalVisible]);

    // --- API CALLS ---

    const fetchMyFees = async (className: string) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/fees/list/${className}`);
            setFeeList(res.data);
        } catch (error) { Alert.alert("Error", "Failed to fetch fees"); }
        finally { setLoading(false); }
    };

    const fetchFeeDetails = async (feeId: number) => {
        setLoadingDetails(true);
        try {
            const res = await apiClient.get('/student/fee-details', {
                params: { fee_schedule_id: feeId, student_id: user?.id }
            });
            setInstallments(res.data.installments);
        } catch (e) { 
            console.error(e);
            Alert.alert("Error", "Could not load installments.");
        }
        finally { setLoadingDetails(false); }
    };

    // --- ACTIONS ---

    const openPayModal = (fee: FeeSchedule) => {
        setSelectedFee(fee);
        setPaymentMode('one_time'); // Reset to default
        setImageUri('');
        setSelectedInstNumber(null);
        setInstallments([]); 
        setSubmitModalVisible(true);
    };

    const handleSelectImage = () => {
        ImagePicker.launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (response) => {
            if (response.assets && response.assets.length > 0) {
                setImageUri(response.assets[0].uri || '');
            }
        });
    };

    const handleSubmitProof = async () => {
        if (!imageUri || !selectedFee) return Alert.alert("Required", "Please select an image");
        
        if (paymentMode === 'installment' && selectedInstNumber === null) {
            return Alert.alert("Required", "Please select which installment you are paying.");
        }

        // Mocking Image Upload
        const mockUrl = "https://via.placeholder.com/300?text=Payment+Proof";

        try {
            await apiClient.post('/fees/submit', {
                fee_schedule_id: selectedFee.id,
                student_id: user?.id,
                payment_mode: paymentMode,
                screenshot_url: mockUrl,
                installment_number: paymentMode === 'installment' ? selectedInstNumber : 0
            });
            setSubmitModalVisible(false);
            Alert.alert("Success", "Proof submitted successfully. Waiting for verification.");
            // Refresh list
            fetchMyFees(user?.class_group || '');
        } catch (error) { Alert.alert("Error", "Submission failed"); }
    };

    // --- DATE FORMATTER (DD/MM/YYYY) ---
    const formatDate = (dateStr: string) => {
        if(!dateStr) return "-";
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // --- RENDERERS ---

    const renderFeeItem = ({ item }: { item: FeeSchedule }) => (
        <View style={styles.feeCard}>
            <View style={styles.feeHeader}>
                <Text style={styles.feeTitle}>{item.title}</Text>
                <Text style={styles.feeAmount}>₹{item.total_amount.toLocaleString()}</Text>
            </View>
            <View style={styles.feeDetails}>
                <Text style={styles.feeDate}>Due Date: {formatDate(item.due_date)}</Text>
                {item.allow_installments === 1 && (
                    <Text style={styles.installmentText}>Installments Allowed</Text>
                )}
            </View>
            
            <TouchableOpacity style={styles.payBtn} onPress={() => openPayModal(item)}>
                <Icon name="cloud-upload" size={20} color="#FFF" style={{marginRight: 8}} />
                <Text style={styles.payBtnText}>Submit Payment Proof</Text>
            </TouchableOpacity>
        </View>
    );

    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}><Icon name="account-balance-wallet" size={28} color="#008080" /></View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>My Fees</Text>
                    <Text style={styles.headerSubtitle}>Class: {user?.class_group}</Text>
                </View>
            </View>

            {loading ? <ActivityIndicator size="large" color="#008080" style={{marginTop: 50}} /> : (
                <FlatList
                    data={feeList}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderFeeItem}
                    contentContainerStyle={{padding: 10}}
                    ListEmptyComponent={<Text style={styles.emptyText}>No fees assigned to you yet.</Text>}
                />
            )}

            {/* --- SUBMISSION MODAL --- */}
            <Modal visible={isSubmitModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Upload Payment Proof</Text>
                        
                        <View style={styles.infoBox}>
                            <Text style={styles.infoText}>Fee: {selectedFee?.title}</Text>
                            <Text style={[styles.infoText, {fontWeight: 'bold'}]}>Total: ₹{selectedFee?.total_amount.toLocaleString()}</Text>
                        </View>

                        <Text style={styles.label}>Select Payment Type:</Text>
                        <View style={styles.pickerBox}>
                            <Picker 
                                selectedValue={paymentMode} 
                                onValueChange={(v) => setPaymentMode(v)}
                                enabled={selectedFee?.allow_installments === 1}
                            >
                                <Picker.Item label="One Time Payment" value="one_time" />
                                {selectedFee?.allow_installments === 1 && <Picker.Item label="Installment" value="installment" />}
                            </Picker>
                        </View>

                        {/* --- INSTALLMENT SELECTION AREA --- */}
                        {paymentMode === 'installment' && (
                            <ScrollView style={styles.scrollArea}>
                                {loadingDetails ? (
                                    <ActivityIndicator color="#008080" style={{marginTop: 20}} />
                                ) : (
                                    <>
                                        {/* UNPAID LIST */}
                                        <Text style={styles.sectionHeader}>Select Installment to Pay:</Text>
                                        
                                        {installments.length === 0 && <Text style={{textAlign:'center', color:'#999', marginVertical:10}}>No installment details found.</Text>}

                                        {installments.filter(i => i.status !== 'paid').map((inst, index) => {
                                            const isPending = inst.status === 'pending';
                                            const isSelected = selectedInstNumber === inst.installment_number;

                                            return (
                                                <TouchableOpacity 
                                                    key={index} 
                                                    style={[
                                                        styles.instRow, 
                                                        isSelected && styles.instRowSelected,
                                                        isPending && styles.instRowDisabled
                                                    ]}
                                                    onPress={() => {
                                                        if (!isPending) setSelectedInstNumber(inst.installment_number);
                                                    }}
                                                    disabled={isPending}
                                                >
                                                    <View style={{flex: 1}}>
                                                        <Text style={styles.instTitle}>{getOrdinal(inst.installment_number)} Installment</Text>
                                                        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                                                            {/* Checkbox Visual */}
                                                            <View style={styles.checkbox}>
                                                                {isPending ? (
                                                                    <Icon name="access-time" size={20} color="#F39C12" />
                                                                ) : isSelected ? (
                                                                    <Icon name="check-box" size={24} color="#008080" />
                                                                ) : (
                                                                    <Icon name="check-box-outline-blank" size={24} color="#777" />
                                                                )}
                                                            </View>
                                                            <Text style={styles.instAmount}>₹{inst.amount.toLocaleString()}</Text>
                                                        </View>
                                                        <Text style={styles.instDate}>Due Date: {formatDate(inst.due_date)}</Text>
                                                    </View>
                                                    
                                                    {isPending && <Text style={[styles.statusBadge, {color:'#F39C12'}]}>PENDING</Text>}
                                                </TouchableOpacity>
                                            )
                                        })}

                                        {/* PAYMENT HISTORY (PAID) */}
                                        {installments.some(i => i.status === 'paid') && (
                                            <View style={styles.historyContainer}>
                                                <Text style={styles.sectionHeader}>Payment History (Paid)</Text>
                                                {installments.filter(i => i.status === 'paid').map((inst, index) => (
                                                    <View key={index} style={[styles.instRow, styles.instRowPaid]}>
                                                        <View style={{flex: 1}}>
                                                            <Text style={[styles.instTitle, {color: '#888'}]}>{getOrdinal(inst.installment_number)} Installment</Text>
                                                            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                                                                <Icon name="check-box" size={24} color="#2ECC71" />
                                                                <Text style={[styles.instAmount, {color: '#888'}]}> ₹{inst.amount.toLocaleString()}</Text>
                                                            </View>
                                                            <Text style={styles.instDate}>Due Date: {formatDate(inst.due_date)}</Text>
                                                        </View>
                                                        <Text style={[styles.statusBadge, {color:'#2ECC71'}]}>PAID</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </>
                                )}
                            </ScrollView>
                        )}

                        <TouchableOpacity style={styles.uploadBox} onPress={handleSelectImage}>
                            {imageUri ? (
                                <Image source={{uri: imageUri}} style={{width: '100%', height: '100%', resizeMode: 'cover', borderRadius: 8}} />
                            ) : (
                                <>
                                    <Icon name="add-photo-alternate" size={40} color="#ccc" />
                                    <Text style={{color: '#999', marginTop: 5}}>Tap to upload proof</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10}}>
                            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setSubmitModalVisible(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={handleSubmitProof}>
                                <Text style={styles.submitText}>Submit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' },
    headerCard: { backgroundColor: '#FFF', padding: 15, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 3 },
    headerIconContainer: { backgroundColor: '#E0F2F1', borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    headerSubtitle: { fontSize: 13, color: '#666' },

    feeCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 15, elevation: 2, marginHorizontal: 10 },
    feeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    feeTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50' },
    feeAmount: { fontSize: 18, fontWeight: 'bold', color: '#27AE60' },
    feeDetails: { marginBottom: 15 },
    feeDate: { color: '#7F8C8D', fontSize: 13 },
    installmentText: { color: '#2980B9', fontSize: 12, fontWeight: '500', marginTop: 2 },
    
    payBtn: { backgroundColor: '#008080', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 8 },
    payBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
    emptyText: { textAlign: 'center', marginTop: 30, color: '#999' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#FFF', width: '90%', borderRadius: 12, padding: 20, maxHeight: '85%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080', marginBottom: 15, textAlign: 'center' },
    infoBox: { backgroundColor: '#F0F2F5', padding: 10, borderRadius: 8, marginBottom: 15 },
    infoText: { fontSize: 14, color: '#333', marginBottom: 2 },
    label: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 5 },
    pickerBox: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, marginBottom: 10 },
    
    scrollArea: { maxHeight: 300, marginBottom: 10 },
    sectionHeader: { fontSize: 13, fontWeight: 'bold', color: '#555', marginTop: 10, marginBottom: 5 },
    
    // New Installment Row Style
    instRow: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', 
        marginBottom: 8, backgroundColor: '#FFF', elevation: 1 
    },
    instRowSelected: { borderColor: '#008080', backgroundColor: '#E0F2F1' },
    instRowDisabled: { backgroundColor: '#F9F9F9', opacity: 0.8 },
    instRowPaid: { backgroundColor: '#F0FFF4', borderColor: '#C6F6D5' },
    
    instTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
    checkbox: { marginRight: 8 },
    instAmount: { fontSize: 15, fontWeight: 'bold', color: '#2C3E50' },
    instDate: { fontSize: 12, color: '#777', marginTop: 4, fontStyle: 'italic' },
    statusBadge: { fontSize: 11, fontWeight: 'bold', textAlign: 'right' },

    historyContainer: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 5 },

    uploadBox: { height: 120, borderWidth: 1, borderColor: '#DDD', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginBottom: 15, marginTop: 5 },
    
    modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    submitBtn: { backgroundColor: '#008080', marginLeft: 5 },
    cancelBtn: { backgroundColor: '#FFF', marginRight: 5, borderWidth: 1, borderColor: '#DDD' },
    submitText: { color: '#FFF', fontWeight: 'bold' },
    cancelText: { color: '#777', fontWeight: 'bold' },
});

export default StudentFeeScreen;