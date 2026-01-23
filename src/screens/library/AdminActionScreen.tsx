import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, RefreshControl, Alert, StatusBar, ActivityIndicator, SafeAreaView
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client'; 
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
    blue: '#1E88E5',
    warning: '#F59E0B'
};

const AdminActionScreen = () => {
    const navigation = useNavigation();
    
    // --- State ---
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('PENDING'); 
    const [searchText, setSearchText] = useState('');

    const fetchData = async () => {
        try {
            const response = await apiClient.get('/library/admin/requests');
            setRequests(response.data || []);
        } catch (error) {
            console.error("Fetch Error:", error);
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

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return dateString.split('T')[0];
    };

    const isOverdue = (dateString) => {
        if (!dateString) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        const returnDate = new Date(dateString);
        return returnDate < today;
    };

    const getFilteredData = () => {
        let data = [...requests];

        if (activeTab === 'PENDING') {
            data = data.filter(item => item.status === 'pending');
        } else if (activeTab === 'ISSUED') {
            data = data.filter(item => item.status === 'approved' && !isOverdue(item.expected_return_date));
        } else if (activeTab === 'OVERDUE') {
            data = data.filter(item => item.status === 'approved' && isOverdue(item.expected_return_date));
        }

        if (searchText) {
            const lower = searchText.toLowerCase();
            data = data.filter(item => 
                (item.book_title && item.book_title.toLowerCase().includes(lower)) || 
                (item.full_name && item.full_name.toLowerCase().includes(lower)) ||
                (item.roll_no && item.roll_no.toLowerCase().includes(lower))
            );
        }
        return data;
    };

    const handleAction = async (id, type) => {
        Alert.alert(
            "Confirm Action",
            `Are you sure you want to mark this as ${type}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Confirm", 
                    onPress: async () => {
                        setLoading(true);
                        try {
                            let endpoint = '';
                            let body = {};

                            if (type === 'returned') {
                                endpoint = `/library/return/${id}`;
                            } else {
                                endpoint = `/library/admin/request-action/${id}`;
                                body = { action: type };
                            }
                            
                            await apiClient.put(endpoint, body);
                            Alert.alert("Success", "Updated successfully");
                            fetchData(); 
                        } catch (error) {
                            console.error(error);
                            Alert.alert("Error", error.response?.data?.message || "Action failed");
                            setLoading(false);
                        }
                    } 
                }
            ]
        );
    };

    const renderItem = ({ item, index }) => {
        const overdue = isOverdue(item.expected_return_date);

        return (
            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={{flex: 1, paddingRight: 10}}>
                            <Text style={styles.bookTitle} numberOfLines={2}>{item.book_title || "Unknown Book"}</Text>
                            <Text style={styles.studentDetails}>{item.full_name} ({item.roll_no})</Text>
                            <Text style={styles.classDetails}>Class: {item.class_name || 'N/A'}</Text>
                        </View>

                        <View style={[styles.badge, { backgroundColor: item.status === 'pending' ? '#FEF3C7' : '#DBEAFE' }]}>
                            <Text style={[styles.badgeText, { color: item.status === 'pending' ? COLORS.warning : COLORS.blue }]}>
                                {item.status.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.dateRow}>
                        <View style={styles.dateItem}>
                            <MaterialIcons name="event" size={14} color={COLORS.textSub} />
                            <Text style={styles.dateText}> Borrow: {formatDate(item.borrow_date)}</Text>
                        </View>
                        <View style={styles.dateItem}>
                            <MaterialIcons name="event-available" size={14} color={overdue && item.status === 'approved' ? COLORS.danger : COLORS.textSub} />
                            <Text style={[styles.dateText, overdue && item.status === 'approved' && { color: COLORS.danger, fontWeight: 'bold' }]}>
                                Return: {formatDate(item.expected_return_date)}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.actionRow}>
                        {item.status === 'pending' && (
                            <>
                                <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => handleAction(item.id, 'approved')}>
                                    <Text style={styles.btnText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => handleAction(item.id, 'rejected')}>
                                    <Text style={styles.btnText}>Reject</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {(item.status === 'approved') && (
                            <TouchableOpacity style={[styles.btn, styles.btnReturn]} onPress={() => handleAction(item.id, 'returned')}>
                                <Text style={styles.btnText}>Mark Returned</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Animatable.View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={COLORS.background} barStyle="dark-content" />
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="pending-actions" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Action Center</Text>
                        <Text style={styles.headerSubtitle}>Library Requests</Text>
                    </View>
                </View>
                
                <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('LibraryHistoryScreen')}>
                    <MaterialIcons name="history" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* --- SEARCH & TABS --- */}
            <View style={styles.filterContainer}>
                <View style={styles.searchBox}>
                    <MaterialIcons name="search" size={20} color={COLORS.textSub} style={{marginRight: 8}} />
                    <TextInput 
                        placeholder="Search Student, ID, or Book..." 
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholderTextColor={COLORS.textSub}
                    />
                </View>

                <View style={styles.tabContainer}>
                    {['PENDING', 'ISSUED', 'OVERDUE'].map(tab => (
                        <TouchableOpacity 
                            key={tab}
                            style={[styles.tab, activeTab === tab && styles.tabActive]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                {tab.charAt(0) + tab.slice(1).toLowerCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 40}} />
            ) : (
                <FlatList
                    data={getFilteredData()}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[COLORS.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="playlist-check" size={50} color={COLORS.border} />
                            <Text style={styles.emptyText}>No {activeTab.toLowerCase()} requests found.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    
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
    headerBtn: {
        backgroundColor: COLORS.primary,
        padding: 8,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // --- FILTERS ---
    filterContainer: { paddingHorizontal: 15, marginBottom: 10 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.border, height: 45, marginBottom: 15 },
    searchInput: { flex: 1, height: 45, fontSize: 15, color: COLORS.textMain },

    // Tabs
    tabContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 8, padding: 4, borderWidth: 1, borderColor: COLORS.border },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
    tabActive: { backgroundColor: '#E0F2F1' },
    tabText: { color: COLORS.textSub, fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: COLORS.primary, fontWeight: 'bold' },

    // --- CARD STYLES ---
    listContent: { paddingHorizontal: 15, paddingBottom: 20 },
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    bookTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 4 },
    studentDetails: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
    classDetails: { fontSize: 12, color: '#999', marginTop: 2 },
    
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, height: 24, justifyContent: 'center' },
    badgeText: { fontSize: 10, fontWeight: 'bold' },

    dateRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, marginVertical: 10, borderWidth: 1, borderColor: '#f0f0f0' },
    dateItem: { flexDirection: 'row', alignItems: 'center' },
    dateText: { fontSize: 12, color: COLORS.textMain, fontWeight: '500', marginLeft: 4 },

    // Buttons
    actionRow: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnApprove: { backgroundColor: COLORS.success },
    btnReject: { backgroundColor: COLORS.danger },
    btnReturn: { backgroundColor: COLORS.blue },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyText: { color: COLORS.textSub, fontSize: 16, marginTop: 10 }
});

export default AdminActionScreen;