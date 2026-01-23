import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ActivityIndicator, Image, TextInput, RefreshControl, SafeAreaView, Dimensions
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
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
    blue: '#1E88E5'
};

const DigitalLibraryScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    useFocusEffect(
        useCallback(() => {
            fetchResources();
        }, [search])
    );

    const fetchResources = async () => {
        try {
            const res = await apiClient.get('/library/digital', { params: { search } });
            setResources(res.data);
        } catch (e) { 
            console.error(e); 
        } finally { 
            setLoading(false); 
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchResources();
    };

    const renderCard = ({ item, index }) => {
        const coverUrl = item.cover_image_url 
            ? `${SERVER_URL}${item.cover_image_url}` 
            : 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=E-Book';

        return (
            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.cardWrapper}>
                <TouchableOpacity 
                    style={styles.card} 
                    onPress={() => navigation.navigate('DigitalResourceDetailsScreen', { resource: item })} 
                    activeOpacity={0.9}
                >
                    <View style={styles.imageContainer}>
                        <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
                        <View style={styles.typeBadge}>
                            <Text style={styles.typeText}>E-BOOK</Text>
                        </View>
                    </View>
                    
                    <View style={styles.info}>
                        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.author}>by {item.author}</Text>
                        
                        <View style={styles.metaRow}>
                            {item.category ? (
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryText}>{item.category}</Text>
                                </View>
                            ) : <View/>}
                            <Text style={styles.bookNo}>ID: {item.book_no || 'N/A'}</Text>
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
                        <MaterialCommunityIcons name="cloud-download-outline" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Digital Library</Text>
                        <Text style={styles.headerSubtitle}>E-Books & Resources</Text>
                    </View>
                </View>

                {/* Add Button (Admin Only) */}
                {isAdmin && (
                    <TouchableOpacity 
                        style={styles.headerBtn} 
                        onPress={() => navigation.navigate('AddDigitalResourceScreen')}
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
                    placeholder="Search by Title, Author..." 
                    placeholderTextColor={COLORS.textSub}
                    value={search} 
                    onChangeText={setSearch} 
                />
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList 
                    data={resources} 
                    renderItem={renderCard} 
                    keyExtractor={(item) => item.id.toString()} 
                    numColumns={2} 
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="file-document-outline" size={60} color="#CFD8DC" />
                            <Text style={styles.emptyText}>No digital resources found.</Text>
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
        width: '50%',
        padding: 6,
    },
    card: { 
        backgroundColor: '#FFF', 
        borderRadius: 12, 
        elevation: 3, 
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 5, 
        overflow: 'hidden',
        height: 250, 
        flexDirection: 'column'
    },
    imageContainer: { height: 140, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', position: 'relative' },
    coverImage: { width: '100%', height: '100%' },
    typeBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    typeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    
    info: { padding: 10, flex: 1, justifyContent: 'space-between' },
    title: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 2 },
    author: { fontSize: 12, color: COLORS.textSub },
    
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
    categoryBadge: { backgroundColor: '#E0F2F1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    categoryText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
    bookNo: { fontSize: 10, color: '#94A3B8', fontWeight: 'bold' },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { textAlign: 'center', color: COLORS.textSub, fontSize: 16, marginTop: 10 }
});

export default DigitalLibraryScreen;