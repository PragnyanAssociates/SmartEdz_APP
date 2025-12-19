import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    Linking, ActivityIndicator, Image, TextInput, RefreshControl 
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
// IMPORT USEAUTH TO CHECK ROLE SAFELY
import { useAuth } from '../../context/AuthContext'; 

const DigitalLibraryScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth(); // Get user from context
    const isAdmin = user?.role === 'admin'; // Strict Admin Check

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

    const handleOpen = (url) => {
        if (url) Linking.openURL(`${SERVER_URL}${url}`);
    };

    const renderCard = ({ item }) => {
        const coverUrl = item.cover_image_url 
            ? `${SERVER_URL}${item.cover_image_url}` 
            : 'https://cdn-icons-png.flaticon.com/512/337/337946.png'; // Fallback icon

        return (
            <TouchableOpacity style={styles.card} onPress={() => handleOpen(item.file_url)} activeOpacity={0.8}>
                <View style={styles.imageContainer}>
                    <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode={item.cover_image_url ? "cover" : "center"} />
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeText}>PDF</Text>
                    </View>
                </View>
                
                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.subject}>{item.subject}</Text>
                        {item.class_group && <Text style={styles.classGroup}>{item.class_group}</Text>}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header Search */}
            <View style={styles.header}>
                <Text style={styles.heading}>Digital Resources</Text>
                <View style={styles.searchBar}>
                    <Text style={{marginRight: 8}}>🔍</Text>
                    <TextInput 
                        style={styles.searchInput} 
                        placeholder="Search eBooks, Notes..." 
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
                    numColumns={2} // ★ GRID LAYOUT
                    columnWrapperStyle={styles.rowWrapper}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No digital resources found.</Text>
                        </View>
                    }
                />
            )}

            {/* Floating Add Button - Admin Only */}
            {isAdmin && (
                <TouchableOpacity 
                    style={styles.fab} 
                    onPress={() => navigation.navigate('AddDigitalResourceScreen')}
                >
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
    
    // Card Styles
    card: { 
        width: '48%', 
        backgroundColor: '#FFF', 
        borderRadius: 12, 
        marginBottom: 16, 
        elevation: 3, 
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4,
        overflow: 'hidden'
    },
    imageContainer: { height: 140, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', position: 'relative' },
    coverImage: { width: '100%', height: '100%' },
    typeBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    typeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    
    info: { padding: 12 },
    title: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 6, height: 40 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    subject: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
    classGroup: { fontSize: 11, color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

    fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#2563EB', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 } },
    fabIcon: { color: '#FFF', fontSize: 32, marginTop: -2 },
    
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#94A3B8', fontSize: 16 }
});

export default DigitalLibraryScreen;