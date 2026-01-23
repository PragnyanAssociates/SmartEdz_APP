import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, ActivityIndicator, 
    RefreshControl, Image, StatusBar, SafeAreaView, TouchableOpacity
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
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
    warning: '#D97706',
    blue: '#1E88E5'
};

const MyBooksScreen = () => {
    const navigation = useNavigation();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- Fetch Data ---
    const fetchHistory = async () => {
        try {
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
            case 'pending': return { color: COLORS.warning, bg: '#FEF3C7', label: 'Pending' };
            case 'returned': return { color: COLORS.success, bg: '#D1FAE5', label: 'Returned' };
            case 'rejected': return { color: COLORS.danger, bg: '#FEE2E2', label: 'Rejected' };
            case 'approved': 
                return isOverdue 
                    ? { color: COLORS.danger, bg: '#FEE2E2', label: 'Overdue' }
                    : { color: COLORS.blue, bg: '#DBEAFE', label: 'Issued' };
            default: return { color: COLORS.textSub, bg: '#F1F5F9', label: status };
        }
    };

    const renderItem = ({ item, index }) => {
        const statusStyle = getStatusStyle(item.status, item.expected_return_date);
        const imageUrl = item.cover_image_url 
            ? `${SERVER_URL}${item.cover_image_url}` 
            : 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=No+Cover';

        return (
            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50}>
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
                        <Text style={styles.bookNo}>ID: {item.book_no}</Text>

                        {/* Dates Section */}
                        <View style={styles.dateContainer}>
                            <View style={styles.dateBox}>
                                <Text style={styles.dateLabel}>Borrowed</Text>
                                <Text style={styles.dateValue}>{formatDate(item.borrow_date)}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.dateBox}>
                                <Text style={styles.dateLabel}>
                                    {item.status === 'returned' ? 'Returned' : 'Due Date'}
                                </Text>
                                <Text style={[
                                    styles.dateValue, 
                                    item.status === 'returned' && { color: COLORS.success, fontWeight: 'bold' }
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
            </Animatable.View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={COLORS.background} barStyle="dark-content" />
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    {/* Back Button */}
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>

                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="history" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>My History</Text>
                        <Text style={styles.headerSubtitle}>Borrowed Books</Text>
                    </View>
                </View>
            </View>
            
            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} colors={[COLORS.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="book-open-page-variant" size={50} color={COLORS.border} />
                            <Text style={styles.emptyText}>You haven't borrowed any books yet.</Text>
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

    listContent: { paddingHorizontal: 15, paddingBottom: 20 },
    
    // Card Styles
    card: { 
        flexDirection: 'row',
        backgroundColor: COLORS.cardBg, 
        borderRadius: 12, 
        marginBottom: 12, 
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 }
    },
    bookCover: {
        width: 70,
        height: 100,
        borderRadius: 8,
        backgroundColor: '#eee'
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
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textMain,
        marginRight: 8
    },
    author: {
        fontSize: 12,
        color: COLORS.textSub,
        marginBottom: 2
    },
    bookNo: {
        fontSize: 11,
        color: '#90A4AE',
        fontWeight: '600',
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
        padding: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee'
    },
    dateBox: {
        flex: 1,
        alignItems: 'center'
    },
    divider: {
        width: 1,
        height: '70%',
        backgroundColor: '#E0E0E0'
    },
    dateLabel: {
        fontSize: 10,
        color: COLORS.textSub,
        marginBottom: 2,
        textTransform: 'uppercase',
        fontWeight: '600'
    },
    dateValue: {
        fontSize: 12,
        color: COLORS.textMain,
        fontWeight: '600'
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        marginTop: 80
    },
    emptyText: {
        color: COLORS.textSub,
        fontSize: 16,
        marginTop: 10
    }
});

export default MyBooksScreen;