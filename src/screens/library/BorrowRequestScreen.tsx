import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const BorrowRequestScreen = ({ route, navigation }) => {
    const { bookId, bookTitle } = route.params;
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        full_name: user?.full_name || '',
        roll_no: '',
        class_name: '',
        mobile: '',
        email: user?.email || '',
        borrow_date: new Date().toISOString().split('T')[0],
        return_date: ''
    });

    const handleRequest = async () => {
        if(!form.roll_no || !form.mobile || !form.return_date) {
            return Alert.alert("Error", "Please fill all required fields");
        }
        setLoading(true);
        try {
            await apiClient.post('/library/request', { ...form, book_id: bookId });
            Alert.alert("Success", "Borrow request submitted to Admin.");
            navigation.popToTop();
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Request failed");
        } finally { setLoading(false); }
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>Request: {bookTitle}</Text>
            <View style={styles.card}>
                <InputField label="Full Name" value={form.full_name} onChangeText={(t)=>setForm({...form, full_name:t})} />
                <InputField label="Roll No / ID" value={form.roll_no} onChangeText={(t)=>setForm({...form, roll_no:t})} />
                <InputField label="Class/Department" value={form.class_name} onChangeText={(t)=>setForm({...form, class_name:t})} />
                <InputField label="Mobile Number" keyboardType="phone-pad" value={form.mobile} onChangeText={(t)=>setForm({...form, mobile:t})} />
                <InputField label="Email ID" value={form.email} onChangeText={(t)=>setForm({...form, email:t})} />
                <InputField label="Borrow Date (YYYY-MM-DD)" value={form.borrow_date} editable={false} />
                <InputField label="Expected Return Date (YYYY-MM-DD)" placeholder="2024-12-31" value={form.return_date} onChangeText={(t)=>setForm({...form, return_date:t})} />
                
                <TouchableOpacity style={styles.btn} onPress={handleRequest} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Submit Request</Text>}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const InputField = ({ label, ...props }) => (
    <View style={{marginBottom: 15}}>
        <Text style={styles.label}>{label}</Text>
        <TextInput style={styles.input} {...props} />
    </View>
);

const styles = StyleSheet.create({
    container: { flex:1, backgroundColor: '#F8FAFC', padding: 20 },
    header: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#1E293B' },
    card: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, elevation: 3 },
    label: { fontSize: 12, color: '#64748B', marginBottom: 5 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', padding: 10, borderRadius: 8, color: '#000' },
    btn: { backgroundColor: '#2563EB', padding: 15, borderRadius: 10, marginTop: 10, alignItems: 'center' },
    btnText: { color: '#FFF', fontWeight: 'bold' }
});

export default BorrowRequestScreen;