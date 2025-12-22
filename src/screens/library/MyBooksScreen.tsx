import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, ActivityIndicator, 
    RefreshControl, Image, StatusBar 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client'; // Adjust path
import { SERVER_URL } from '../../../apiConfig'; // Adjust path

const MyBooksScreen = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- Fetch Data ---
    const fetchHistory = async () => {
        try {
            // Call the NEW endpoint
            const response = await apiClient.get('/library/student/history');
            setData(response.data || []);
        } catch (error) {
            console.error("Error fetching my books:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [])
    );

    // --- Helper: Format Date ---
    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    };

    // --- Helper: Get Status Style ---
    const getStatusStyle = (status: string, returnDate: string) => {
        const isOverdue = status === 'approved' && new Date(returnDate) < new Date();
        
        switch (status) {
            case 'pending': return { color: '#D97706', bg: '#FEF3C7', label: 'Pending Approval' };
            case 'returned': return { color: '#059669', bg: '#D1FAE5', label: 'Returned' };
            case 'rejected': return { color: '#DC2626', bg: '#FEE2E2', label: 'Rejected' };
            case 'approved': 
                return isOverdue 
                    ? { color: '#DC2626', bg: '#FEE2E2', label: 'Overdue' }
                    : { color: '#2563EB', bg: '#DBEAFE', label: 'Issued' };
            default: return { color: '#64748B', bg: '#F1F5F9', label: status };
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const statusStyle = getStatusStyle(item.status, item.expected_return_date);
        const imageUrl = item.cover_image_url 
            ? `${SERVER_URL}${item.cover_image_url}` 
            : 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=No+Cover';

        return (
            <View style={styles.card}>
                {/* Book Image */}
                <Image source={{ uri: imageUrl }} style={styles.bookCover} resizeMode="cover" />
                
                {/* Content */}
                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <Text style={styles.title} numberOfLines={1}>{item.book_title}</Text>
                        <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                            <Text style={[styles.badgeText, { color: statusStyle.color }]}>
                                {statusStyle.label}
                            </Text>
                        </View>
                    </View>
                    
                    <Text style={styles.author}>by {item.author}</Text>
                    <Text style={styles.bookNo}>Book No: {item.book_no}</Text>

                    {/* Dates Section */}
                    <View style={styles.dateContainer}>
                        <View style={styles.dateBox}>
                            <Text style={styles.dateLabel}>📅 Borrowed</Text>
                            <Text style={styles.dateValue}>{formatDate(item.borrow_date)}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.dateBox}>
                            <Text style={styles.dateLabel}>
                                {item.status === 'returned' ? '✅ Returned On' : '⏳ Due Date'}
                            </Text>
                            <Text style={[
                                styles.dateValue, 
                                item.status === 'returned' && { color: '#059669', fontWeight: 'bold' }
                            ]}>
                                {item.status === 'returned' 
                                    ? formatDate(item.actual_return_date) 
                                    : formatDate(item.expected_return_date)
                                }
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#F8FAFC" barStyle="dark-content" />
            <Text style={styles.screenTitle}>My Library History</Text>
            
            {loading ? (
                <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📚</Text>
                            <Text style={styles.emptyText}>You haven't borrowed any books yet.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    screenTitle: { 
        fontSize: 22, 
        fontWeight: '800', 
        color: '#1E293B', 
        padding: 20, 
        paddingBottom: 10,
        backgroundColor: '#FFF',
        elevation: 2 
    },
    listContent: { padding: 16 },
    
    // Card Styles
    card: { 
        flexDirection: 'row',
        backgroundColor: '#FFF', 
        borderRadius: 12, 
        marginBottom: 16, 
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5
    },
    bookCover: {
        width: 70,
        height: 100,
        borderRadius: 8,
        backgroundColor: '#F1F5F9'
    },
    content: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between'
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    title: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        marginRight: 8
    },
    author: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 2
    },
    bookNo: {
        fontSize: 11,
        color: '#94A3B8',
        marginBottom: 8
    },
    
    // Badge
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },

    // Dates
    dateContainer: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 6,
        alignItems: 'center'
    },
    dateBox: {
        flex: 1,
        alignItems: 'center'
    },
    divider: {
        width: 1,
        height: '80%',
        backgroundColor: '#E2E8F0'
    },
    dateLabel: {
        fontSize: 10,
        color: '#94A3B8',
        marginBottom: 2,
        textTransform: 'uppercase',
        fontWeight: '600'
    },
    dateValue: {
        fontSize: 12,
        color: '#334155',
        fontWeight: '600'
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: 10
    },
    emptyText: {
        color: '#94A3B8',
        fontSize: 16
    }
});

export default MyBooksScreen;