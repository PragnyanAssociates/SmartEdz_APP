import React, { useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
    Image, Modal, TextInput, Alert, ScrollView, ActivityIndicator, Platform, UIManager
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import apiClient from '../../api/client'; 

// Enable Layout Animation
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- CONSTANTS ---
const CLASS_LIST = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

interface FeeSchedule {
    id: number;
    title: string;
    total_amount: number;
    due_date: string; // YYYY-MM-DD from DB
    allow_installments: number; 
    max_installments: number;
}

interface StudentFeeStatus {
    student_id: number;
    full_name: string;
    roll_no: string;
    submission_id: number | null;
    status: 'unpaid' | 'pending' | 'paid' | 'rejected' | null;
    payment_mode: string | null;
    screenshot_url: string | null;
    submitted_at: string | null;
}

interface InstallmentItem {
    amount: string;
    due_date: string; // Display format (DD/MM/YYYY)
    dateObject: Date; // Actual Date object for logic
}

const AdminFeeScreen = () => {
    const [viewMode, setViewMode] = useState<'dashboard' | 'fee_list' | 'student_list'>('dashboard');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedFee, setSelectedFee] = useState<FeeSchedule | null>(null);
    
    const [feeList, setFeeList] = useState<FeeSchedule[]>([]);
    const [studentStatuses, setStudentStatuses] = useState<StudentFeeStatus[]>([]);
    const [loading, setLoading] = useState(false);

    // --- CREATE MODAL STATE ---
    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [newFee, setNewFee] = useState({ 
        title: '', 
        amount: '', 
        dueDate: '', // Display format (DD/MM/YYYY)
        dateObject: new Date(), 
        installments: false 
    });

    // Installment Logic State
    const [numberOfInstallments, setNumberOfInstallments] = useState('');
    const [installmentBreakdown, setInstallmentBreakdown] = useState<InstallmentItem[]>([]);

    // Date Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerType, setDatePickerType] = useState<'main' | 'installment'>('main');
    const [activeInstallmentIndex, setActiveInstallmentIndex] = useState<number>(-1);

    // --- VERIFY MODAL STATE ---
    const [isVerifyModalVisible, setVerifyModalVisible] = useState(false);
    const [selectedStudentForVerify, setSelectedStudentForVerify] = useState<StudentFeeStatus | null>(null);

    // --- DATE & AMOUNT HELPERS ---

    // 1. Clean Amount (Remove commas)
    const sanitizeAmount = (amountStr: string) => {
        return amountStr.replace(/,/g, '').trim();
    };

    // 2. Convert Date Object -> "DD/MM/YYYY" (For Display)
    const formatDateForDisplay = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // 3. Convert Date Object -> "YYYY-MM-DD" (For Database)
    const formatDateForDB = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${year}-${month}-${day}`;
    };

    // 4. Convert DB String "YYYY-MM-DD" -> "DD/MM/YYYY" (For List Rendering)
    const formatDBStringForDisplay = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return formatDateForDisplay(date);
    };

    // --- API CALLS ---

    const fetchFeesForClass = async (className: string) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/fees/list/${className}`);
            setFeeList(res.data);
            setSelectedClass(className);
            setViewMode('fee_list');
        } catch (error) { Alert.alert("Error", "Failed to fetch fees"); }
        finally { setLoading(false); }
    };

    const handleCreateFee = async () => {
        if (!newFee.title || !newFee.amount || !newFee.dueDate) return Alert.alert("Error", "Fill all main fields");
        
        // Clean the main amount (remove commas)
        const cleanTotalAmount = sanitizeAmount(newFee.amount);

        // Validation: If installments selected, check breakdown
        if (newFee.installments) {
            if (installmentBreakdown.length === 0) return Alert.alert("Error", "Please specify number of installments");
            
            let totalInstAmount = 0;
            for (let i = 0; i < installmentBreakdown.length; i++) {
                if (!installmentBreakdown[i].amount || !installmentBreakdown[i].due_date) {
                    return Alert.alert("Error", `Fill details for Installment ${i + 1}`);
                }
                // Add cleaned amount to total
                totalInstAmount += parseFloat(sanitizeAmount(installmentBreakdown[i].amount));
            }

            // Optional: Check if total matches
            if (totalInstAmount !== parseFloat(cleanTotalAmount)) {
                Alert.alert("Notice", `Installment Total (${totalInstAmount}) does not match Total Amount (${cleanTotalAmount}). Make sure this is intended.`);
            }
        }

        try {
            // Prepare Payload
            const payload = {
                class_group: selectedClass,
                title: newFee.title,
                description: 'School Fee',
                total_amount: cleanTotalAmount, // Send cleaned number
                due_date: formatDateForDB(newFee.dateObject),
                allow_installments: newFee.installments,
                installment_details: newFee.installments ? installmentBreakdown.map(inst => ({
                    amount: sanitizeAmount(inst.amount), // Send cleaned number
                    due_date: formatDateForDB(inst.dateObject)
                })) : []
            };

            await apiClient.post('/fees/create', payload);
            setCreateModalVisible(false);
            resetForm();
            fetchFeesForClass(selectedClass); 
            Alert.alert("Success", "Fee Schedule Created");
        } catch (error: any) { 
            console.error(error);
            Alert.alert("Error", "Failed to create fee. Please check amounts and try again."); 
        }
    };

    const resetForm = () => {
        setNewFee({ title: '', amount: '', dueDate: '', dateObject: new Date(), installments: false });
        setNumberOfInstallments('');
        setInstallmentBreakdown([]);
    };

    // --- HANDLERS ---

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            const displayDate = formatDateForDisplay(selectedDate); // DD/MM/YYYY

            if (datePickerType === 'main') {
                setNewFee({ ...newFee, dueDate: displayDate, dateObject: selectedDate });
            } else if (datePickerType === 'installment' && activeInstallmentIndex > -1) {
                const updatedList = [...installmentBreakdown];
                updatedList[activeInstallmentIndex].due_date = displayDate;
                updatedList[activeInstallmentIndex].dateObject = selectedDate;
                setInstallmentBreakdown(updatedList);
            }
        }
    };

    const openDatePicker = (type: 'main' | 'installment', index: number = -1) => {
        setDatePickerType(type);
        setActiveInstallmentIndex(index);
        setShowDatePicker(true);
    };

    const handleInstallmentCountChange = (text: string) => {
        setNumberOfInstallments(text);
        const count = parseInt(text);
        if (!isNaN(count) && count > 0 && count <= 12) {
            const arr: InstallmentItem[] = [];
            for (let i = 0; i < count; i++) {
                arr.push({ amount: '', due_date: '', dateObject: new Date() });
            }
            setInstallmentBreakdown(arr);
        } else {
            setInstallmentBreakdown([]);
        }
    };

    const updateInstallmentAmount = (index: number, val: string) => {
        const updatedList = [...installmentBreakdown];
        updatedList[index].amount = val;
        setInstallmentBreakdown(updatedList);
    };

    const fetchStudentStatusForFee = async (fee: FeeSchedule) => {
        setLoading(true);
        setSelectedFee(fee);
        try {
            const res = await apiClient.get(`/fees/status/${fee.id}`);
            setStudentStatuses(res.data);
            setViewMode('student_list');
        } catch (error) { Alert.alert("Error", "Failed to fetch student data"); }
        finally { setLoading(false); }
    };

    const handleVerifyPayment = async (status: 'paid' | 'rejected') => {
        if (!selectedStudentForVerify?.submission_id) return;
        try {
            await apiClient.put('/fees/verify', {
                submission_id: selectedStudentForVerify.submission_id,
                status: status,
                admin_remarks: status === 'paid' ? 'Verified' : 'Rejected due to invalid proof'
            });
            setVerifyModalVisible(false);
            if (selectedFee) fetchStudentStatusForFee(selectedFee); 
        } catch (error) { Alert.alert("Error", "Update failed"); }
    };

    // --- RENDER ---
    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}><Icon name="admin-panel-settings" size={28} color="#008080" /></View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Admin Fee Manager</Text>
                    <Text style={styles.headerSubtitle}>Assign & Verify Fees</Text>
                </View>
            </View>

            {loading && <ActivityIndicator size="large" color="#008080" style={{marginTop: 50}} />}

            {/* Dashboard Views */}
            {!loading && viewMode === 'dashboard' && (
                <FlatList
                    data={CLASS_LIST}
                    numColumns={2}
                    keyExtractor={item => item}
                    contentContainerStyle={styles.gridContainer}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.classCard} onPress={() => fetchFeesForClass(item)}>
                            <View style={styles.classIconBg}><Icon name="class" size={24} color="#008080" /></View>
                            <Text style={styles.classTitle}>{item}</Text>
                        </TouchableOpacity>
                    )}
                />
            )}

            {!loading && viewMode === 'fee_list' && (
                <View style={{flex: 1}}>
                    <View style={styles.subHeader}>
                        <TouchableOpacity onPress={() => setViewMode('dashboard')}><Icon name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                        <Text style={styles.subHeaderTitle}>{selectedClass} - Fees</Text>
                        <TouchableOpacity onPress={() => setCreateModalVisible(true)} style={styles.addBtn}><Text style={styles.addBtnText}>+ Add</Text></TouchableOpacity>
                    </View>
                    <FlatList
                        data={feeList}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={{padding: 10}}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.feeCard} onPress={() => fetchStudentStatusForFee(item)}>
                                <View>
                                    <Text style={styles.feeTitle}>{item.title}</Text>
                                    <Text style={styles.feeAmount}>₹{item.total_amount}</Text>
                                    <Text style={styles.feeDate}>Due: {formatDBStringForDisplay(item.due_date)}</Text>
                                </View>
                                <Icon name="chevron-right" size={24} color="#008080" />
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.emptyText}>No fees scheduled yet.</Text>}
                    />
                </View>
            )}

            {!loading && viewMode === 'student_list' && (
                <View style={{flex: 1}}>
                     <View style={styles.subHeader}>
                        <TouchableOpacity onPress={() => setViewMode('fee_list')}><Icon name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                        <Text style={styles.subHeaderTitle}>Status: {selectedFee?.title}</Text>
                    </View>
                    <ScrollView contentContainerStyle={{padding: 10}}>
                         {/* Simple list view for students */}
                         {studentStatuses.map(student => (
                             <View key={student.student_id} style={[
                                 styles.studentCard, 
                                 { borderLeftColor: student.status === 'paid' ? '#2ECC71' : (student.status === 'pending' ? '#F39C12' : '#E74C3C') }
                             ]}>
                                <View>
                                    <Text style={styles.studentName}>{student.full_name} ({student.roll_no})</Text>
                                    <Text style={[styles.statusText, { color: student.status === 'paid' ? '#2ECC71' : (student.status === 'pending' ? '#F39C12' : '#E74C3C') }]}>
                                        {student.status ? student.status.toUpperCase() : 'UNPAID'}
                                    </Text>
                                </View>
                                {student.status === 'pending' && (
                                    <TouchableOpacity onPress={() => { setSelectedStudentForVerify(student); setVerifyModalVisible(true); }}>
                                        <Icon name="visibility" size={24} color="#008080" />
                                    </TouchableOpacity>
                                )}
                             </View>
                         ))}
                    </ScrollView>
                </View>
            )}

            {/* --- CREATE FEE MODAL --- */}
            <Modal visible={isCreateModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Assign Fee to {selectedClass}</Text>
                        
                        <ScrollView contentContainerStyle={{paddingBottom: 20}}>
                            <TextInput 
                                placeholder="Fee Title (e.g. Annual Fee)" 
                                style={styles.input} 
                                value={newFee.title} 
                                onChangeText={t => setNewFee({...newFee, title: t})} 
                            />
                            
                            <TextInput 
                                placeholder="Total Amount (e.g. 1,80,000)" 
                                style={styles.input} 
                                keyboardType="numeric" 
                                value={newFee.amount} 
                                onChangeText={t => setNewFee({...newFee, amount: t})} 
                            />
                            
                            {/* Main Due Date Picker */}
                            <TouchableOpacity onPress={() => openDatePicker('main')} style={styles.dateInput}>
                                <Text style={{color: newFee.dueDate ? '#333' : '#999'}}>
                                    {newFee.dueDate || "Select Due Date (DD/MM/YYYY)"}
                                </Text>
                                <Icon name="calendar-today" size={20} color="#666" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.checkboxRow} onPress={() => setNewFee({...newFee, installments: !newFee.installments})}>
                                <Text style={styles.label}>Allow Installments?</Text>
                                <Icon 
                                    name={newFee.installments ? "check-box" : "check-box-outline-blank"} 
                                    size={24} color="#008080" 
                                />
                            </TouchableOpacity>

                            {/* Dynamic Installments */}
                            {newFee.installments && (
                                <View style={styles.installmentContainer}>
                                    <TextInput 
                                        placeholder="No. of Installments (e.g. 3)" 
                                        style={styles.input} 
                                        keyboardType="numeric" 
                                        value={numberOfInstallments} 
                                        onChangeText={handleInstallmentCountChange} 
                                    />

                                    {installmentBreakdown.map((item, index) => (
                                        <View key={index} style={styles.instRow}>
                                            <Text style={styles.instLabel}>Inst. {index + 1}:</Text>
                                            
                                            <TextInput 
                                                placeholder="Amount" 
                                                style={[styles.input, styles.instInput]} 
                                                keyboardType="numeric"
                                                value={item.amount}
                                                onChangeText={(val) => updateInstallmentAmount(index, val)}
                                            />
                                            
                                            <TouchableOpacity 
                                                onPress={() => openDatePicker('installment', index)} 
                                                style={[styles.dateInput, styles.instDateInput]}
                                            >
                                                <Text style={{fontSize: 12, color: item.due_date ? '#333' : '#999'}}>
                                                    {item.due_date || "DD/MM/YYYY"}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>

                        <TouchableOpacity style={styles.saveBtn} onPress={handleCreateFee}>
                            <Text style={styles.btnText}>Assign Fee</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalVisible(false)}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Hidden Date Picker Component */}
            {showDatePicker && (
                <DateTimePicker
                    value={
                        datePickerType === 'main' 
                        ? newFee.dateObject 
                        : (activeInstallmentIndex > -1 ? installmentBreakdown[activeInstallmentIndex].dateObject : new Date())
                    }
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                />
            )}

            {/* Verify Payment Modal */}
            <Modal visible={isVerifyModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Verify Payment</Text>
                        <Text style={styles.label}>Student: {selectedStudentForVerify?.full_name}</Text>
                        
                        <View style={styles.proofContainer}>
                            <Image source={{ uri: selectedStudentForVerify?.screenshot_url || '' }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
                        </View>

                        <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                            <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#E74C3C', flex: 1}]} onPress={() => handleVerifyPayment('rejected')}>
                                <Text style={styles.btnText}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#2ECC71', flex: 1}]} onPress={() => handleVerifyPayment('paid')}>
                                <Text style={styles.btnText}>Approve</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setVerifyModalVisible(false)}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' },
    
    // Header & Grid Styles
    headerCard: { backgroundColor: '#FFF', padding: 15, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 3 },
    headerIconContainer: { backgroundColor: '#E0F2F1', borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    headerSubtitle: { fontSize: 13, color: '#666' },
    gridContainer: { paddingHorizontal: 8 },
    classCard: { flex: 1, margin: 8, padding: 20, backgroundColor: '#FFF', borderRadius: 12, alignItems: 'center', elevation: 2, height: 120, justifyContent: 'center' },
    classIconBg: { backgroundColor: '#F0F4F8', padding: 12, borderRadius: 50, marginBottom: 10 },
    classTitle: { fontSize: 15, fontWeight: 'bold', color: '#2C3E50' },

    // List Styles
    subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    subHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    addBtn: { backgroundColor: '#008080', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    addBtnText: { color: '#FFF', fontWeight: 'bold' },
    feeCard: { backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderRadius: 10, marginBottom: 10, marginHorizontal: 10, elevation: 2 },
    feeTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    feeAmount: { fontSize: 18, color: '#2ECC71', fontWeight: 'bold', marginTop: 4 },
    feeDate: { color: '#777', fontSize: 12, marginTop: 2 },
    studentCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginBottom: 8, borderLeftWidth: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
    studentName: { fontSize: 15, fontWeight: '600', color: '#333' },
    statusText: { fontSize: 12, fontWeight: 'bold', marginTop: 2 },
    emptyText: { textAlign: 'center', marginTop: 20, color: '#999' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#FFF', width: '90%', maxHeight:'85%', borderRadius: 12, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080', marginBottom: 15, textAlign: 'center' },
    
    input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#FAFAFA' },
    dateInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#FAFAFA', flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
    
    checkboxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 5 },
    label: { fontSize: 15, fontWeight: 'bold', color: '#333' },
    
    installmentContainer: { backgroundColor: '#F0F4F8', padding: 10, borderRadius: 8, marginBottom: 10 },
    instRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
    instLabel: { width: 50, fontSize: 12, fontWeight: 'bold', color: '#555' },
    instInput: { flex: 1, marginRight: 5, marginBottom: 0, paddingVertical: 5 },
    instDateInput: { flex: 1, marginBottom: 0, paddingVertical: 8 },

    proofContainer: { height: 250, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden', marginVertical: 10 },
    saveBtn: { backgroundColor: '#008080', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    btnText: { color: '#FFF', fontWeight: 'bold' },
    cancelBtn: { padding: 10, alignItems: 'center', marginTop: 5 },
    cancelText: { color: '#777' },
});

export default AdminFeeScreen;