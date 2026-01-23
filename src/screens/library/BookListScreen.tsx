import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TextInput, Image, 
    TouchableOpacity, ActivityIndicator, RefreshControl, SafeAreaView, Dimensions
} from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
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
    blue: '#1E88E5'
};

const BookListScreen = () => {
    const navigation = useNavigation();
    const [books, setBooks] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    useFocusEffect(
        useCallback(() => {
            fetchBooks();
        }, [search])
    );

    const fetchBooks = async () => {
        try {
            const res = await apiClient.get('/library/books', { params: { search } });
            setBooks(res.data);
        } catch (error) { 
            console.error(error); 
        } finally { 
            setLoading(false); 
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchBooks();
    };

    const renderBookCard = ({ item, index }) => {
        const imageUrl = item.cover_image_url 
            ? `${SERVER_URL}${item.cover_image_url}` 
            : 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=No+Cover';
        
        const isAvailable = item.available_copies > 0;

        return (
            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.cardWrapper}>
                <TouchableOpacity 
                    style={styles.card} 
                    onPress={() => navigation.navigate('BookDetailsScreen', { book: item })}
                    activeOpacity={0.9}
                >
                    <View style={styles.imageContainer}>
                        <Image source={{ uri: imageUrl }} style={styles.coverImage} resizeMode="cover" />
                        <View style={[styles.badge, isAvailable ? styles.bgGreen : styles.bgRed]}>
                            <Text style={styles.badgeText}>{isAvailable ? 'Available' : 'Out'}</Text>
                        </View>
                    </View>

                    <View style={styles.infoContainer}>
                        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.author} numberOfLines={1}>{item.author}</Text>
                        <View style={styles.footerRow}>
                            <Text style={styles.bookNo}>ID: {item.book_no}</Text>
                            {/* Visual indicator for copies */}
                            <Text style={styles.copiesText}>{item.available_copies} Left</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Animatable.View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    {/* Back Button */}
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>

                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="library" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Library</Text>
                        <Text style={styles.headerSubtitle}>Books Collection</Text>
                    </View>
                </View>
                
                {/* Add Button (Admin Only) */}
                {isAdmin && (
                    <TouchableOpacity 
                        style={styles.headerBtn}
                        onPress={() => navigation.navigate('AddBookScreen')}
                    >
                        <MaterialIcons name="add" size={18} color="#fff" />
                        <Text style={styles.headerBtnText}>Add</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* --- SEARCH BAR --- */}
            <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={22} color={COLORS.textSub} style={styles.searchIcon} />
                <TextInput 
                    style={styles.searchInput} 
                    placeholder="Search by Title, Author, or No..." 
                    placeholderTextColor={COLORS.textSub}
                    value={search} 
                    onChangeText={setSearch} 
                />
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList 
                    data={books} 
                    renderItem={renderBookCard} 
                    keyExtractor={(item) => item.id.toString()} 
                    numColumns={2} 
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialIcons name="menu-book" size={60} color="#CFD8DC" />
                            <Text style={styles.emptyText}>No books found.</Text>
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
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 10,
    },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // --- SEARCH BAR ---
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        marginHorizontal: 15,
        marginBottom: 10,
        paddingHorizontal: 10,
        height: 45,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16, color: COLORS.textMain },

    // --- GRID LIST ---
    listContent: { paddingHorizontal: 8, paddingBottom: 40 },
    cardWrapper: {
        width: '50%', // Occupy half width
        padding: 6,   // Inner spacing to create gap between columns
    },
    card: { 
        backgroundColor: '#FFF', 
        borderRadius: 12, 
        elevation: 3, 
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 5, 
        overflow: 'hidden',
        height: 250, // Fixed height for uniformity
        flexDirection: 'column'
    },
    imageContainer: { height: 160, width: '100%', position: 'relative', backgroundColor: '#eee' },
    coverImage: { width: '100%', height: '100%' },
    badge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    bgGreen: { backgroundColor: 'rgba(34, 197, 94, 0.9)' },
    bgRed: { backgroundColor: 'rgba(239, 68, 68, 0.9)' },
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
    
    infoContainer: { padding: 10, flex: 1, justifyContent: 'space-between' },
    title: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 2 },
    author: { fontSize: 12, color: COLORS.textSub },
    
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
    bookNo: { fontSize: 11, color: '#90A4AE', fontWeight: '600' },
    copiesText: { fontSize: 11, color: COLORS.primary, fontWeight: 'bold' },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: COLORS.textSub, fontSize: 16, marginTop: 10 }
});

export default BookListScreen;