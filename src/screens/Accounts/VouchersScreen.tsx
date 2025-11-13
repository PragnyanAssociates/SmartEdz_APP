import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    SafeAreaView, Alert, ActivityIndicator, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// Assuming you have a configured apiClient like in previous examples
import apiClient from '../../api/client';

type VoucherType = 'Debit' | 'Credit' | 'Deposit';
interface ParticularRow {
    description: string;
    amount: string;
}

// Helper function to convert number to words (simple version)
const numberToWords = (num: number): string => {
    // This is a basic implementation. For a full-featured version, a library might be better.
    if (num === 0) return 'Zero';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convert = (n: number): string => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 1000)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
        return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    };
    return convert(num).trim();
};


const VouchersScreen = () => {
    const [voucherType, setVoucherType] = useState<VoucherType>('Debit');
    const [headOfAccount, setHeadOfAccount] = useState('');
    const [subHead, setSubHead] = useState('');
    const [accountType, setAccountType] = useState('Savings');
    const [particulars, setParticulars] = useState<ParticularRow[]>([{ description: '', amount: '' }]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [amountInWords, setAmountInWords] = useState('Zero Rupees Only');
    const [attachment, setAttachment] = useState<ImagePickerResponse | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Calculate total whenever particulars change
    useEffect(() => {
        const total = particulars.reduce((sum, item) => {
            const amount = parseFloat(item.amount);
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
        setTotalAmount(total);
    }, [particulars]);

    // Convert total to words whenever it changes
    useEffect(() => {
        setAmountInWords(`${numberToWords(Math.floor(totalAmount))} Rupees Only`);
    }, [totalAmount]);

    const handleAddRow = () => {
        setParticulars([...particulars, { description: '', amount: '' }]);
    };

    const handleRemoveRow = (index: number) => {
        const newParticulars = [...particulars];
        newParticulars.splice(index, 1);
        setParticulars(newParticulars);
    };

    const handleParticularChange = (index: number, field: keyof ParticularRow, value: string) => {
        const newParticulars = [...particulars];
        newParticulars[index][field] = value;
        setParticulars(newParticulars);
    };

    const handleChooseFile = () => {
        launchImageLibrary({ mediaType: 'photo' }, (response) => {
            if (response.didCancel) {
                console.log('User cancelled image picker');
            } else if (response.errorCode) {
                console.log('ImagePicker Error: ', response.errorMessage);
            } else {
                setAttachment(response);
            }
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        const formData = new FormData();

        formData.append('voucherType', voucherType);
        formData.append('voucherNo', `VCH-${Date.now()}`); // Example voucher number
        formData.append('voucherDate', new Date().toISOString().split('T')[0]);
        formData.append('headOfAccount', headOfAccount);
        formData.append('subHead', subHead);
        formData.append('accountType', accountType);
        formData.append('totalAmount', totalAmount.toFixed(2));
        formData.append('amountInWords', amountInWords);
        
        // Filter out empty rows before sending
        const validParticulars = particulars.filter(p => p.description.trim() !== '' && parseFloat(p.amount) > 0);
        formData.append('particulars', JSON.stringify(validParticulars));

        if (attachment?.assets?.[0]) {
            formData.append('attachment', {
                uri: Platform.OS === 'android' ? attachment.assets[0].uri : attachment.assets[0].uri!.replace('file://', ''),
                type: attachment.assets[0].type,
                name: attachment.assets[0].fileName,
            });
        }
        
        try {
            // Replace with your actual API call
            // await apiClient.post('/vouchers/create', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            console.log("Form Data to be Sent:", formData);
            Alert.alert('Success', 'Voucher saved successfully!');
            // Reset form here if needed
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save voucher.');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {/* Voucher Type Tabs */}
                <View style={styles.tabContainer}>
                    {(['Debit', 'Credit', 'Deposit'] as VoucherType[]).map(type => (
                        <TouchableOpacity
                            key={type}
                            style={[styles.tab, voucherType === type && styles.activeTab]}
                            onPress={() => setVoucherType(type)}
                        >
                            <Text style={[styles.tabText, voucherType === type && styles.activeTabText]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Voucher Card */}
                <View style={styles.voucherCard}>
                    <Text style={styles.schoolTitle}>Vivekananda Public School</Text>
                    <Text style={styles.managedBy}>Managed By Vivekananda Education Center</Text>
                    <Text style={styles.voucherTitle}>{voucherType} Voucher</Text>

                    <TextInput style={styles.input} placeholder="Head of A/C" value={headOfAccount} onChangeText={setHeadOfAccount} />
                    <TextInput style={styles.input} placeholder="Sub Head" value={subHead} onChangeText={setSubHead} />
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={accountType} onValueChange={(itemValue) => setAccountType(itemValue)}>
                            <Picker.Item label="Savings Account" value="Savings" />
                            <Picker.Item label="Current Account" value="Current" />
                            <Picker.Item label="Cash Account" value="Cash" />
                        </Picker>
                    </View>

                    {/* Particulars Table */}
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderText}>Particulars / Description</Text>
                            <Text style={styles.tableHeaderText}>Amount (Rs)</Text>
                        </View>
                        {particulars.map((row, index) => (
                            <View key={index} style={styles.tableRow}>
                                <TextInput
                                    style={[styles.tableInput, styles.descriptionInput]}
                                    placeholder="Enter Description"
                                    value={row.description}
                                    onChangeText={(val) => handleParticularChange(index, 'description', val)}
                                />
                                <TextInput
                                    style={[styles.tableInput, styles.amountInput]}
                                    placeholder="0.00"
                                    value={row.amount}
                                    onChangeText={(val) => handleParticularChange(index, 'amount', val)}
                                    keyboardType="numeric"
                                />
                                {particulars.length > 1 && (
                                     <TouchableOpacity onPress={() => handleRemoveRow(index)} style={styles.removeButton}>
                                        <MaterialIcons name="remove-circle-outline" size={22} color="#d9534f" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                         <TouchableOpacity style={styles.addRowButton} onPress={handleAddRow}>
                            <MaterialIcons name="add-circle-outline" size={22} color="#0275d8" />
                            <Text style={styles.addRowText}>Add Row</Text>
                        </TouchableOpacity>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalText}>Total:</Text>
                            <Text style={styles.totalAmount}>{totalAmount.toFixed(2)}</Text>
                        </View>
                    </View>

                    <View style={styles.wordsContainer}>
                        <Text style={styles.wordsLabel}>Total Amount in Words:</Text>
                        <Text style={styles.wordsText}>{amountInWords}</Text>
                    </View>
                    
                     {/* Upload Section */}
                    <TouchableOpacity style={styles.uploadButton} onPress={handleChooseFile}>
                        <MaterialIcons name="cloud-upload" size={24} color="#5bc0de" />
                        <Text style={styles.uploadText}>{attachment?.assets?.[0]?.fileName || 'Upload Proof'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={handleSave} disabled={isSaving}>
                        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.cancelButton]}>
                        <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
                 <TouchableOpacity style={[styles.actionButton, styles.downloadButton]}>
                    <Text style={styles.buttonText}>Download</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
};

// --- STYLES ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#E9ECEF' },
    scrollContainer: { padding: 16 },
    tabContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
    tab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#FFF' },
    activeTab: { backgroundColor: '#0275d8' },
    tabText: { fontWeight: 'bold', color: '#0275d8' },
    activeTabText: { color: '#FFF' },
    voucherCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, elevation: 3 },
    schoolTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
    managedBy: { fontSize: 12, color: '#6c757d', textAlign: 'center', marginBottom: 10 },
    voucherTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginVertical: 16, textTransform: 'uppercase' },
    input: { borderWidth: 1, borderColor: '#CED4DA', padding: 10, borderRadius: 4, marginBottom: 12 },
    pickerContainer: { borderWidth: 1, borderColor: '#CED4DA', borderRadius: 4, marginBottom: 12 },
    table: { borderWidth: 1, borderColor: '#DEE2E6', borderRadius: 4, marginTop: 10 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 10, borderBottomWidth: 1, borderColor: '#DEE2E6' },
    tableHeaderText: { fontWeight: 'bold', flex: 1 },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, borderBottomWidth: 1, borderColor: '#DEE2E6' },
    tableInput: { height: 40, paddingHorizontal: 5 },
    descriptionInput: { flex: 0.6 },
    amountInput: { flex: 0.4, textAlign: 'right' },
    removeButton: { padding: 5 },
    addRowButton: { flexDirection: 'row', alignItems: 'center', padding: 10, justifyContent: 'center' },
    addRowText: { color: '#0275d8', marginLeft: 8, fontWeight: 'bold' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#F8F9FA', borderTopWidth: 1, borderColor: '#DEE2E6' },
    totalText: { fontWeight: 'bold', fontSize: 16 },
    totalAmount: { fontWeight: 'bold', fontSize: 16 },
    wordsContainer: { marginTop: 16, padding: 10, backgroundColor: '#F8F9FA', borderRadius: 4 },
    wordsLabel: { fontWeight: 'bold', color: '#6c757d' },
    wordsText: { fontSize: 14 },
    uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#5bc0de', borderStyle: 'dashed', borderRadius: 8, marginTop: 16 },
    uploadText: { marginLeft: 10, color: '#5bc0de' },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
    actionButton: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
    saveButton: { backgroundColor: '#5cb85c', marginRight: 8 },
    cancelButton: { backgroundColor: '#f0ad4e', marginLeft: 8 },
    downloadButton: { backgroundColor: '#0275d8' },
    buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});

export default VouchersScreen;