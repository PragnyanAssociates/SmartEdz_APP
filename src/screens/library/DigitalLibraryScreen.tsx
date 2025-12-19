import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ActivityIndicator, Image, TextInput, RefreshControl 
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext'; 

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

    const renderCard = ({ item }) => {
        const coverUrl = item.cover_image_url 
            ? `${SERVER_URL}${item.cover_image_url}` 
            : 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=E-Book';

        return (
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
                        {item.category ? <Text style={styles.category}>{item.category}</Text> : <View/>}
                        <Text style={styles.bookNo}>{item.book_no || '0000'}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.heading}>Digital Resources</Text>
                <View style={styles.searchBar}>
                    <Text style={{marginRight: 8}}>🔍</Text>
                    <TextInput 
                        style={styles.searchInput} 
                        placeholder="Search by Title, Author..." 
                        value={search} 
                        onChangeText={setSearch} 
                    />
                </View>
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 50 }} />
            ) : (
                <FlatList 
                    data={resources} 
                    renderItem={renderCard} 
                    keyExtractor={(item) => item.id.toString()} 
                    numColumns={2} 
                    columnWrapperStyle={styles.rowWrapper}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={<Text style={styles.emptyText}>No digital resources found.</Text>}
                />
            )}

            {isAdmin && (
                <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddDigitalResourceScreen')}>
                    <Text style={styles.fabIcon}>+</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { padding: 20, backgroundColor: '#FFF', elevation: 2, paddingBottom: 15 },
    heading: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 15 },
    searchBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, alignItems: 'center' },
    searchInput: { flex: 1, fontSize: 16, color: '#334155', padding: 0 },
    listContent: { padding: 15, paddingBottom: 80 },
    rowWrapper: { justifyContent: 'space-between' },
    card: { width: '48%', backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, elevation: 3, overflow: 'hidden' },
    imageContainer: { height: 140, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', position: 'relative' },
    coverImage: { width: '100%', height: '100%' },
    typeBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    typeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    info: { padding: 12 },
    title: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 4, height: 40 },
    author: { fontSize: 12, color: '#64748B', marginBottom: 6 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    category: { fontSize: 10, color: '#2563EB', backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '600' },
    bookNo: { fontSize: 10, color: '#94A3B8', fontWeight: 'bold' },
    fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#2563EB', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    fabIcon: { color: '#FFF', fontSize: 32, marginTop: -2 },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#94A3B8', fontSize: 16 }
});

export default DigitalLibraryScreen;