import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
    Image, Modal, Alert, ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'react-native-image-picker'; 
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface FeeSchedule {
    id: number;
    title: string;
    total_amount: number;
    due_date: string;
    allow_installments: number;
}

const StudentFeeScreen = () => {
    const { user } = useAuth();
    const [feeList, setFeeList] = useState<FeeSchedule[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Submission Modal State
    const [isSubmitModalVisible, setSubmitModalVisible] = useState(false);
    const [selectedFee, setSelectedFee] = useState<FeeSchedule | null>(null);
    const [submissionData, setSubmissionData] = useState({ mode: 'one_time', imageUri: '' });

    useEffect(() => {
        if (user?.class_group) {
            fetchMyFees(user.class_group);
        }
    }, [user]);

    const fetchMyFees = async (className: string) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/fees/list/${className}`);
            setFeeList(res.data);
        } catch (error) { Alert.alert("Error", "Failed to fetch fees"); }
        finally { setLoading(false); }
    };

    const handleSelectImage = () => {
        ImagePicker.launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (response) => {
            if (response.assets && response.assets.length > 0) {
                setSubmissionData({ ...submissionData, imageUri: response.assets[0].uri || '' });
            }
        });
    };

    const handleSubmitProof = async () => {
        if (!submissionData.imageUri || !selectedFee) return Alert.alert("Required", "Please select an image");
        
        // Mocking Image Upload: In production, upload to AWS/Cloudinary and get URL
        const mockUrl = "https://via.placeholder.com/300?text=Payment+Proof";

        try {
            await apiClient.post('/fees/submit', {
                fee_schedule_id: selectedFee.id,
                student_id: user?.id,
                payment_mode: submissionData.mode,
                screenshot_url: mockUrl 
            });
            setSubmitModalVisible(false);
            setSubmissionData({ mode: 'one_time', imageUri: '' });
            Alert.alert("Success", "Proof submitted successfully. Waiting for Admin verification.");
        } catch (error) { Alert.alert("Error", "Submission failed"); }
    };

    const renderFeeItem = ({ item }: { item: FeeSchedule }) => (
        <View style={styles.feeCard}>
            <View style={styles.feeHeader}>
                <Text style={styles.feeTitle}>{item.title}</Text>
                <Text style={styles.feeAmount}>₹{item.total_amount}</Text>
            </View>
            <View style={styles.feeDetails}>
                <Text style={styles.feeDate}>Due Date: {new Date(item.due_date).toDateString()}</Text>
                {item.allow_installments === 1 && (
                    <Text style={styles.installmentText}>Installments Allowed</Text>
                )}
            </View>
            
            <TouchableOpacity 
                style={styles.payBtn}
                onPress={() => {
                    setSelectedFee(item);
                    setSubmitModalVisible(true);
                }}
            >
                <Icon name="cloud-upload" size={20} color="#FFF" style={{marginRight: 8}} />
                <Text style={styles.payBtnText}>Submit Payment Proof</Text>
            </TouchableOpacity>
        </View>
    );

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

            {/* Submission Modal */}
            <Modal visible={isSubmitModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Upload Payment Proof</Text>
                        
                        <View style={styles.infoBox}>
                            <Text style={styles.infoText}>Fee: {selectedFee?.title}</Text>
                            <Text style={styles.infoText}>Total: ₹{selectedFee?.total_amount}</Text>
                        </View>

                        <Text style={styles.label}>Select Payment Type:</Text>
                        <View style={styles.pickerBox}>
                            <Picker 
                                selectedValue={submissionData.mode} 
                                onValueChange={(v) => setSubmissionData({...submissionData, mode: v})}
                                enabled={selectedFee?.allow_installments === 1}
                            >
                                <Picker.Item label="One Time Payment" value="one_time" />
                                {selectedFee?.allow_installments === 1 && <Picker.Item label="Installment" value="installment" />}
                            </Picker>
                        </View>
                        {selectedFee?.allow_installments === 0 && <Text style={styles.hintText}>* Installments not allowed for this fee</Text>}

                        <TouchableOpacity style={styles.uploadBox} onPress={handleSelectImage}>
                            {submissionData.imageUri ? (
                                <Image source={{uri: submissionData.imageUri}} style={{width: '100%', height: '100%', resizeMode: 'cover', borderRadius: 8}} />
                            ) : (
                                <>
                                    <Icon name="add-photo-alternate" size={40} color="#ccc" />
                                    <Text style={{color: '#999', marginTop: 5}}>Tap to select screenshot</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSubmitProof}>
                            <Text style={styles.btnText}>Submit</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setSubmitModalVisible(false)}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
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

    feeCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 15, elevation: 2 },
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
    modalContent: { backgroundColor: '#FFF', width: '90%', borderRadius: 12, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080', marginBottom: 15, textAlign: 'center' },
    infoBox: { backgroundColor: '#F0F2F5', padding: 10, borderRadius: 8, marginBottom: 15 },
    infoText: { fontSize: 14, color: '#333', marginBottom: 2 },
    label: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 5 },
    pickerBox: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, marginBottom: 5 },
    hintText: { fontSize: 11, color: '#E74C3C', marginBottom: 10 },
    uploadBox: { height: 150, borderWidth: 1, borderColor: '#DDD', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginBottom: 20 },
    
    saveBtn: { backgroundColor: '#008080', padding: 12, borderRadius: 8, alignItems: 'center' },
    btnText: { color: '#FFF', fontWeight: 'bold' },
    cancelBtn: { padding: 10, alignItems: 'center', marginTop: 5 },
    cancelText: { color: '#777' },
});

export default StudentFeeScreen;