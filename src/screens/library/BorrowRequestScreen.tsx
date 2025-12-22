import React, { useState } from 'react';
import { 
    View, Text, StyleSheet, TextInput, TouchableOpacity, 
    ScrollView, Alert, ActivityIndicator, Platform 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const BorrowRequestScreen = ({ route, navigation }) => {
    // 1. Get Params & Auth
    const { bookId, bookTitle } = route.params;
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(false);

    // 2. State for Form Fields
    const [form, setForm] = useState({
        full_name: user?.full_name || '',
        roll_no: '',
        class_name: '',
        mobile: '',
        email: user?.email || '',
    });

    // 3. State for Dates (Initialize Borrow Date as Today)
    const [borrowDate, setBorrowDate] = useState(new Date());
    const [returnDate, setReturnDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // Default +7 days
    
    // Toggle Pickers
    const [showBorrowPicker, setShowBorrowPicker] = useState(false);
    const [showReturnPicker, setShowReturnPicker] = useState(false);

    // 4. Helper: Format Date for Display (DD/MM/YYYY)
    const formatDateDisplay = (date) => {
        if (!date) return '';
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // 5. Helper: Format Date for Backend (YYYY-MM-DD)
    const formatDateBackend = (date) => {
        if (!date) return '';
        return date.toISOString().split('T')[0];
    };

    // 6. Handle Date Changes
    const onBorrowDateChange = (event, selectedDate) => {
        setShowBorrowPicker(Platform.OS === 'ios'); // Keep open on iOS, close on Android
        if (selectedDate) {
            setBorrowDate(selectedDate);
        }
    };

    const onReturnDateChange = (event, selectedDate) => {
        setShowReturnPicker(Platform.OS === 'ios');
        if (selectedDate) {
            setReturnDate(selectedDate);
        }
    };

    // 7. Submit Request
    const handleRequest = async () => {
        if(!form.roll_no || !form.mobile) {
            return Alert.alert("Validation Error", "Please fill Roll No and Mobile Number.");
        }

        setLoading(true);
        try {
            // Prepare Payload (Convert Dates to YYYY-MM-DD for DB)
            const payload = {
                ...form,
                book_id: bookId,
                borrow_date: formatDateBackend(borrowDate),
                return_date: formatDateBackend(returnDate),
            };

            await apiClient.post('/library/request', payload);
            
            Alert.alert("Success", "Borrow request submitted successfully!", [
                { text: "OK", onPress: () => navigation.popToTop() }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", error.response?.data?.message || "Request failed");
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 40}}>
            <Text style={styles.header}>Request: {bookTitle}</Text>
            
            <View style={styles.card}>
                {/* Auto-filled / Text Inputs */}
                <InputField label="Full Name" value={form.full_name} onChangeText={(t)=>setForm({...form, full_name:t})} />
                <InputField label="Roll No / ID *" value={form.roll_no} onChangeText={(t)=>setForm({...form, roll_no:t})} placeholder="e.g. 12345" />
                <InputField label="Class/Department" value={form.class_name} onChangeText={(t)=>setForm({...form, class_name:t})} placeholder="e.g. Class 10" />
                <InputField label="Mobile Number *" keyboardType="phone-pad" value={form.mobile} onChangeText={(t)=>setForm({...form, mobile:t})} placeholder="e.g. 9876543210" />
                <InputField label="Email ID" value={form.email} onChangeText={(t)=>setForm({...form, email:t})} />

                {/* --- DATE PICKERS --- */}
                
                {/* 1. Borrow Date */}
                <Text style={styles.label}>Borrow Date (DD/MM/YYYY)</Text>
                <TouchableOpacity 
                    style={styles.dateButton} 
                    onPress={() => setShowBorrowPicker(true)}
                >
                    <Text style={styles.dateText}>{formatDateDisplay(borrowDate)}</Text>
                    <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>
                
                {showBorrowPicker && (
                    <DateTimePicker
                        value={borrowDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onBorrowDateChange}
                        maximumDate={new Date()} // Can't borrow in future? Usually borrow is today.
                    />
                )}

                {/* 2. Return Date */}
                <Text style={styles.label}>Expected Return Date (DD/MM/YYYY)</Text>
                <TouchableOpacity 
                    style={styles.dateButton} 
                    onPress={() => setShowReturnPicker(true)}
                >
                    <Text style={styles.dateText}>{formatDateDisplay(returnDate)}</Text>
                    <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>

                {showReturnPicker && (
                    <DateTimePicker
                        value={returnDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onReturnDateChange}
                        minimumDate={borrowDate} // Can't return before borrowing
                    />
                )}

                {/* Submit Button */}
                <TouchableOpacity style={styles.btn} onPress={handleRequest} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Submit Request</Text>}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

// Reusable Input Component
const InputField = ({ label, ...props }) => (
    <View style={{marginBottom: 16}}>
        <Text style={styles.label}>{label}</Text>
        <TextInput 
            style={styles.input} 
            placeholderTextColor="#94A3B8" 
            {...props} 
        />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20 },
    header: { fontSize: 20, fontWeight: '800', marginBottom: 20, color: '#1E293B' },
    card: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, elevation: 3, shadowColor:'#000', shadowOpacity:0.05 },
    
    label: { fontSize: 13, fontWeight:'600', color: '#64748B', marginBottom: 8 },
    input: { 
        borderWidth: 1, 
        borderColor: '#E2E8F0', 
        backgroundColor: '#F8FAFC',
        padding: 14, 
        borderRadius: 10, 
        color: '#1E293B',
        fontSize: 15
    },
    
    // Date Picker Styles
    dateButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFF',
        padding: 14,
        borderRadius: 10,
        marginBottom: 16
    },
    dateText: { fontSize: 15, color: '#1E293B' },
    calendarIcon: { fontSize: 18 },

    // Submit Button
    btn: { 
        backgroundColor: '#2563EB', 
        paddingVertical: 16, 
        borderRadius: 12, 
        marginTop: 10, 
        alignItems: 'center',
        elevation: 2 
    },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default BorrowRequestScreen;