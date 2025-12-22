import React, { useState, useCallback } from 'react';
import { 
    View, Text, FlatList, StyleSheet, TouchableOpacity, 
    Alert, ActivityIndicator, RefreshControl, TextInput, StatusBar 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client'; 

const AdminActionScreen = () => {
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState({ issued: 0, overdue: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Filters
    const [searchText, setSearchText] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'ISSUED', 'OVERDUE', 'PENDING'

    // --- 1. FETCH DATA (Requests + Stats) ---
    const fetchData = async () => {
        try {
            // Run both requests in parallel for speed
            const [reqRes, statRes] = await Promise.all([
                apiClient.get('/library/admin/requests'),
                apiClient.get('/api/library/stats') // Ensure this matches your backend route
            ]);

            setRequests(reqRes.data);
            setStats(statRes.data);
        } catch (e) { 
            console.log("Error fetching data:", e);
        } finally { 
            setLoading(false); 
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // --- 2. LOGIC: FILTER & SORT ---
    const getProcessedData = () => {
        let data = [...requests];

        // A. Filter by Status Card Click
        if (activeFilter !== 'ALL') {
            if (activeFilter === 'PENDING') {
                data = data.filter(item => item.status === 'pending');
            } else if (activeFilter === 'ISSUED') {
                data = data.filter(item => item.status === 'approved');
            } else if (activeFilter === 'OVERDUE') {
                // Overdue logic: Approved AND Date passed
                const today = new Date();
                today.setHours(0,0,0,0);
                data = data.filter(item => {
                    const returnDate = new Date(item.expected_return_date);
                    return item.status === 'approved' && returnDate < today;
                });
            }
        }

        // B. Search Text
        if (searchText) {
            const lower = searchText.toLowerCase();
            data = data.filter(item => 
                (item.book_title?.toLowerCase().includes(lower)) ||
                (item.full_name?.toLowerCase().includes(lower)) ||
                (item.roll_no?.toLowerCase().includes(lower))
            );
        }

        // C. Sort (Overdue/Pending first, then by date)
        data.sort((a, b) => {
            const dateA = new Date(a.expected_return_date);
            const dateB = new Date(b.expected_return_date);
            return dateA - dateB; 
        });

        return data;
    };

    // --- 3. ACTIONS ---
    const handleAction = async (id, action) => {
        try {
            if (action === 'returned') {
                await apiClient.put(`/library/return/${id}`);
                Alert.alert("Success", "Book returned.");
            } else {
                await apiClient.put(`/library/admin/request-action/${id}`, { action });
                Alert.alert("Success", `Request ${action}.`);
            }
            fetchData(); // Refresh list & stats
        } catch (e) { 
            Alert.alert("Error", "Action failed."); 
        }
    };

    // --- 4. RENDER COMPONENTS ---
    
    // Stat Card Component
    const StatCard = ({ label, count, type, isActive }) => (
        <TouchableOpacity 
            style={[styles.statCard, isActive && styles.activeCard]} 
            onPress={() => setActiveFilter(isActive ? 'ALL' : type)}
            activeOpacity={0.7}
        >
            <Text style={[styles.statNum, type === 'OVERDUE' && { color: '#EF4444' }]}>
                {count}
            </Text>
            <Text style={styles.statLabel}>{label}</Text>
        </TouchableOpacity>
    );

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    };

    const isOverdue = (dateStr) => {
        const d = new Date(dateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        return d < today;
    };

    const renderItem = ({ item }) => {
        const itemIsOverdue = item.status === 'approved' && isOverdue(item.expected_return_date);
        
        return (
            <View style={[styles.card, itemIsOverdue && styles.overdueBorder]}>
                <View style={styles.cardTop}>
                    <View style={{flex:1}}>
                        <Text style={styles.bookTitle} numberOfLines={1}>{item.book_title}</Text>
                        <Text style={styles.subText}>{item.full_name} ({item.class_name})</Text>
                    </View>
                    <View style={[styles.badge, 
                        item.status === 'pending' ? styles.bgOrange : 
                        item.status === 'approved' ? styles.bgGreen : styles.bgBlue
                    ]}>
                        <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>

                <View style={styles.dateRow}>
                    <Text style={styles.dateText}>
                        <Text style={{color:'#64748B'}}>Borrow: </Text> 
                        {formatDate(item.borrow_date)}
                    </Text>
                    <Text style={[styles.dateText, itemIsOverdue && { color: '#DC2626', fontWeight:'bold' }]}>
                        <Text style={{color:'#64748B'}}>Return: </Text> 
                        {formatDate(item.expected_return_date)}
                    </Text>
                </View>

                {/* Action Buttons */}
                {item.status === 'pending' && (
                    <View style={styles.btnRow}>
                        <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={()=>handleAction(item.id, 'approved')}>
                            <Text style={styles.btnTxt}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={()=>handleAction(item.id, 'rejected')}>
                            <Text style={styles.btnTxt}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {item.status === 'approved' && (
                    <TouchableOpacity style={[styles.btn, styles.btnReturn]} onPress={()=>handleAction(item.id, 'returned')}>
                        <Text style={styles.btnTxt}>Mark Returned</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#F1F5F9" barStyle="dark-content" />
            
            {/* --- FIXED HEADER SECTION --- */}
            <View style={styles.headerContainer}>
                <Text style={styles.screenTitle}>Library Hub</Text>
                
                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <Text style={{fontSize: 16}}>🔍</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="Search Student, Book..."
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={()=>setSearchText('')}>
                            <Text style={{color:'#94A3B8'}}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Stats Dashboard */}
                <View style={styles.statsRow}>
                    <StatCard 
                        label="Issued" 
                        count={stats.issued || 0} 
                        type="ISSUED" 
                        isActive={activeFilter === 'ISSUED'} 
                    />
                    <StatCard 
                        label="Overdue" 
                        count={stats.overdue || 0} 
                        type="OVERDUE" 
                        isActive={activeFilter === 'OVERDUE'} 
                    />
                    <StatCard 
                        label="Pending" 
                        count={stats.pending || 0} 
                        type="PENDING" 
                        isActive={activeFilter === 'PENDING'} 
                    />
                </View>
                
                {/* Filter Indicator */}
                {activeFilter !== 'ALL' && (
                    <Text style={styles.filterText}>
                        Showing: <Text style={{fontWeight:'bold'}}>{activeFilter}</Text>
                        {' '}(Tap card to clear)
                    </Text>
                )}
            </View>

            {/* --- SCROLLABLE LIST --- */}
            {loading ? (
                <ActivityIndicator size="large" color="#2563EB" style={{marginTop: 50}} />
            ) : (
                <FlatList
                    data={getProcessedData()}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Text style={{ color: '#94A3B8' }}>No records found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    
    // Header
    headerContainer: { backgroundColor: '#FFF', padding: 16, paddingBottom: 10, elevation: 4, shadowOpacity: 0.1, zIndex: 10 },
    screenTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 12 },
    
    // Search
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12, height: 44, marginBottom: 16 },
    input: { flex: 1, marginLeft: 8, fontSize: 14, color: '#334155', height: '100%' },
    
    // Stats
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    statCard: { flex: 1, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
    activeCard: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
    statNum: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 },
    statLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
    filterText: { fontSize: 11, color: '#64748B', marginTop: 8, textAlign: 'center' },

    // List Card
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
    overdueBorder: { borderWidth: 1, borderColor: '#FECACA' }, // Red border if overdue
    
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    bookTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    subText: { fontSize: 12, color: '#64748B', marginTop: 2 },
    
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, height: 24, justifyContent: 'center' },
    bgOrange: { backgroundColor: '#FFF7ED' }, // Pending
    bgGreen: { backgroundColor: '#ECFDF5' }, // Approved
    bgBlue: { backgroundColor: '#EFF6FF' }, // Returned
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#334155' },

    dateRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, marginTop: 4 },
    dateText: { fontSize: 12, color: '#334155', fontWeight: '600' },

    // Buttons
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnApprove: { backgroundColor: '#10B981' },
    btnReject: { backgroundColor: '#EF4444' },
    btnReturn: { backgroundColor: '#3B82F6', marginTop: 12 },
    btnTxt: { color: '#FFF', fontSize: 13, fontWeight: 'bold' }
});

export default AdminActionScreen;