import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import apiClient from '../../api/client';

const AdminActionScreen = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        try {
            const res = await apiClient.get('/library/admin/requests');
            setRequests(res.data);
        } catch (e) { console.log(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchRequests(); }, []);

    const handleAction = async (id, action) => {
        try {
            await apiClient.put(`/library/admin/request-action/${id}`, { action });
            Alert.alert("Success", `Request ${action}`);
            fetchRequests();
        } catch (e) { Alert.alert("Error", "Update failed"); }
    };

    const renderItem = ({ item }) => (
        <View style={styles.reqCard}>
            <Text style={styles.title}>{item.book_title} (No: {item.book_no})</Text>
            <Text style={styles.sub}>By: {item.full_name} | {item.class_name}</Text>
            <Text style={styles.sub}>Dates: {item.borrow_date} to {item.expected_return_date}</Text>
            <Text style={[styles.status, {color: item.status === 'pending' ? 'orange' : 'green'}]}>
                Status: {item.status.toUpperCase()}
            </Text>

            {item.status === 'pending' && (
                <View style={styles.row}>
                    <TouchableOpacity style={[styles.btn, {backgroundColor: '#22C55E'}]} onPress={() => handleAction(item.id, 'approved')}>
                        <Text style={styles.btnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, {backgroundColor: '#EF4444'}]} onPress={() => handleAction(item.id, 'rejected')}>
                        <Text style={styles.btnText}>Reject</Text>
                    </TouchableOpacity>
                </View>
            )}
            
            {item.status === 'approved' && (
                <TouchableOpacity style={[styles.btn, {backgroundColor: '#6366F1'}]} onPress={() => handleAction(item.id, 'returned')}>
                    <Text style={styles.btnText}>Confirm Return</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.head}>Pending Requests & Actions</Text>
            {loading ? <ActivityIndicator size="large"/> : 
                <FlatList data={requests} renderItem={renderItem} keyExtractor={i => i.id.toString()} />
            }
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9', padding: 15 },
    head: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    reqCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 12, elevation: 2 },
    title: { fontWeight: 'bold', fontSize: 16 },
    sub: { color: '#64748B', fontSize: 13, marginTop: 2 },
    status: { fontWeight: 'bold', marginTop: 5, fontSize: 12 },
    row: { flexDirection: 'row', marginTop: 15, justifyContent: 'space-between' },
    btn: { flex: 0.48, padding: 10, borderRadius: 6, alignItems: 'center' },
    btnText: { color: '#FFF', fontWeight: 'bold' }
});

export default AdminActionScreen;