import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    Image
} from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const ComplaintsScreen = () => {
    const { user } = useAuth();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');

    // --- 1. ACCESS CONTROL ---
    if (user?.role === 'teacher') {
        return (
            <View style={styles.restrictedContainer}>
                <Image 
                    source={{ uri: 'https://cdn-icons-png.flaticon.com/128/9995/9995370.png' }} 
                    style={{ width: 80, height: 80, marginBottom: 20, tintColor: '#E53E3E' }} 
                />
                <Text style={styles.restrictedTitle}>Access Restricted</Text>
                <Text style={styles.restrictedText}>Teachers are not authorized to view this page.</Text>
            </View>
        );
    }

    // --- 2. DATA FETCHING ---
    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/complaints');
            setComplaints(res.data);
        } catch (error) {
            console.error("Fetch Error", error);
        } finally {
            setLoading(false);
        }
    };

    // --- 3. ACTIONS ---
    const handleSubmit = async () => {
        if (!subject || !description) return Alert.alert('Error', 'Please fill all fields');

        try {
            await apiClient.post('/complaints', { subject, description });
            setModalVisible(false);
            setSubject('');
            setDescription('');
            Alert.alert('Success', 'Complaint submitted successfully.');
            fetchComplaints();
        } catch (error) {
            Alert.alert('Error', 'Failed to submit complaint.');
        }
    };

    const handleUpdateStatus = async (id: number, newStatus: string) => {
        try {
            await apiClient.put(`/complaints/${id}/status`, { status: newStatus });
            // Optimistic update
            setComplaints((prev: any) => 
                prev.map((item: any) => item.id === id ? { ...item, status: newStatus } : item)
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to update status');
        }
    };

    // --- 4. RENDERERS ---
    
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'resolved': return '#38A169'; // Green
            case 'dismissed': return '#E53E3E'; // Red
            default: return '#D69E2E'; // Yellow (Pending)
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    {/* If Admin, show who posted it */}
                    {user?.role === 'admin' && (
                        <Text style={styles.userInfo}>
                            {item.full_name} <Text style={styles.userRole}>({item.user_role})</Text>
                        </Text>
                    )}
                    <Text style={styles.subject}>{item.subject}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                </View>
            </View>

            <Text style={styles.description}>{item.description}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toDateString()}</Text>

            {/* Admin Actions */}
            {user?.role === 'admin' && item.status === 'pending' && (
                <View style={styles.adminActions}>
                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: '#38A169' }]}
                        onPress={() => handleUpdateStatus(item.id, 'resolved')}
                    >
                        <Text style={styles.actionText}>Resolve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: '#E53E3E' }]}
                        onPress={() => handleUpdateStatus(item.id, 'dismissed')}
                    >
                        <Text style={styles.actionText}>Dismiss</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>
                    {user?.role === 'admin' ? 'All Complaints' : 'My Complaints'}
                </Text>
            </View>

            {loading ? <ActivityIndicator size="large" color="#4A5568" style={{marginTop: 50}} /> : (
                <FlatList 
                    data={complaints}
                    keyExtractor={(item: any) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No complaints found.</Text>
                    }
                />
            )}

            {/* Floating Action Button for Students/Others */}
            {user?.role !== 'admin' && (
                <TouchableOpacity 
                    style={styles.fab} 
                    onPress={() => setModalVisible(true)}
                >
                    <Text style={styles.fabText}>+</Text>
                </TouchableOpacity>
            )}

            {/* Create Complaint Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Raise a Complaint</Text>
                        
                        <TextInput 
                            placeholder="Subject (e.g., Bus Delay)" 
                            style={styles.input} 
                            value={subject} 
                            onChangeText={setSubject} 
                        />
                        <TextInput 
                            placeholder="Describe your issue..." 
                            style={[styles.input, styles.textArea]} 
                            value={description} 
                            onChangeText={setDescription}
                            multiline 
                            numberOfLines={4}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                                <Text>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn}>
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
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    
    // Restricted
    restrictedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    restrictedTitle: { fontSize: 22, fontWeight: 'bold', color: '#E53E3E', marginBottom: 10 },
    restrictedText: { fontSize: 16, color: '#4A5568', textAlign: 'center' },

    // Header
    header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#2D3748' },

    // Cards
    card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    userInfo: { fontSize: 12, color: '#718096', marginBottom: 2 },
    userRole: { fontStyle: 'italic', fontWeight: 'bold' },
    subject: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    statusText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    description: { fontSize: 14, color: '#4A5568', marginBottom: 10, lineHeight: 20 },
    date: { fontSize: 12, color: '#A0AEC0', textAlign: 'right' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#A0AEC0' },

    // Admin Actions
    adminActions: { flexDirection: 'row', marginTop: 15, borderTopWidth: 1, borderTopColor: '#EDF2F7', paddingTop: 10 },
    actionBtn: { flex: 1, padding: 8, borderRadius: 5, alignItems: 'center', marginHorizontal: 5 },
    actionText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

    // FAB
    fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#E53E3E', justifyContent: 'center', alignItems: 'center', elevation: 5 },
    fabText: { fontSize: 30, color: 'white', paddingBottom: 2 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#2D3748' },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 5, padding: 10, marginBottom: 15 },
    textArea: { height: 100, textAlignVertical: 'top' },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    cancelBtn: { padding: 10 },
    submitBtn: { backgroundColor: '#E53E3E', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 5 },
    submitText: { color: 'white', fontWeight: 'bold' }
});

export default ComplaintsScreen;