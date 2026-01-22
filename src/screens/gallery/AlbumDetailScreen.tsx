import React, { useState, useEffect, FC, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Dimensions,
    TouchableOpacity, Modal, SafeAreaView, Alert, ActivityIndicator,
    PermissionsAndroid, Platform, StatusBar
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import Video from 'react-native-video';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; // For Header Icon consistency
import RNFetchBlob from 'rn-fetch-blob';
import * as Animatable from 'react-native-animatable';
import FastImage from 'react-native-fast-image'; 
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';

// --- Type Definitions ---
type GalleryItemType = { id: number; title: string; event_date: string; file_path: string; file_type: 'photo' | 'video'; };
type RootStackParamList = { AlbumDetail: { title: string }; };
type AlbumDetailScreenRouteProp = RouteProp<RootStackParamList, 'AlbumDetail'>;
type FilterType = 'all' | 'photo' | 'video';

// --- Style Constants ---
const { width } = Dimensions.get('window');
const ITEM_MARGIN = 6;
const NUM_COLUMNS = 3;
const imageSize = (width - (ITEM_MARGIN * (NUM_COLUMNS + 1))) / NUM_COLUMNS;
const ACCENT_COLOR = '#008080'; // Updated to Teal
const BACKGROUND_COLOR = '#F2F5F8';
const CARD_BG = '#FFFFFF';
const TEXT_COLOR_DARK = '#263238';
const TEXT_COLOR_MEDIUM = '#546E7A';

// --- Animatable Components ---
const AnimatableVideo = Animatable.createAnimatableComponent(Video);
const AnimatableFastImage = Animatable.createAnimatableComponent(FastImage);

// --- Download Helper ---
const handleDownloadItem = async (item: GalleryItemType) => { if (!item) return; const url = `${SERVER_URL}${item.file_path}`; const fileName = item.file_path.split('/').pop() || `gallery-item-${Date.now()}`; if (Platform.OS === 'android') { try { const permission = Platform.Version >= 33 ? (item.file_type === 'video' ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO : PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES) : PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE; const granted = await PermissionsAndroid.request(permission); if (granted !== PermissionsAndroid.RESULTS.GRANTED) { Alert.alert('Permission Denied'); return; } } catch (err) { console.warn(err); return; } } const { dirs } = RNFetchBlob.fs; const path = Platform.OS === 'ios' ? `${dirs.DocumentDir}/${fileName}` : `${dirs.PictureDir}/${fileName}`; RNFetchBlob.config({ path, fileCache: true, addAndroidDownloads: { useDownloadManager: true, notification: true, path, description: 'Downloading media.' } }).fetch('GET', url).then(() => Alert.alert('Success', 'Download complete.')).catch(() => Alert.alert('Download Failed')); };

// --- Main AlbumDetailScreen Component ---
const AlbumDetailScreen: FC = () => {
    const route = useRoute<AlbumDetailScreenRouteProp>();
    const navigation = useNavigation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const albumTitle = route.params.title;

    const [loading, setLoading] = useState(true);
    const [albumItems, setAlbumItems] = useState<GalleryItemType[]>([]);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [filteredItems, setFilteredItems] = useState<GalleryItemType[]>([]);
    
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isImageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [isVideoModalVisible, setVideoModalVisible] = useState(false);
    const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<GalleryItemType[]>(`/gallery/album/${encodeURIComponent(albumTitle)}`);
            setAlbumItems(response.data);
        } catch (error) {
            Alert.alert("Error", "Could not load album items.");
        } finally {
            setLoading(false);
        }
    }, [albumTitle]);

    useFocusEffect(fetchData);

    useEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]); // Hide default header
    useEffect(() => { if (activeFilter === 'all') setFilteredItems(albumItems); else setFilteredItems(albumItems.filter(item => item.file_type === activeFilter)); }, [albumItems, activeFilter]);

    const handleItemPress = (item: GalleryItemType) => { if (item.file_type === 'photo') { setSelectedImageUri(`${SERVER_URL}${item.file_path}`); setImageModalVisible(true); } else { setSelectedVideoUri(`${SERVER_URL}${item.file_path}`); setVideoModalVisible(true); } };
    const confirmDeleteItem = (itemToDelete: GalleryItemType) => Alert.alert("Delete Item", "Are you sure?", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteItem(itemToDelete.id) }]);
    const deleteItem = async (itemId: number) => { if (!user) return; try { await apiClient.delete(`/gallery/${itemId}`, { data: { role: user.role } }); setAlbumItems(prev => prev.filter(item => item.id !== itemId)); } catch (e) { Alert.alert("Error", "Could not delete item."); } };
    const handleAddItem = () => launchImageLibrary({ mediaType: 'mixed', selectionLimit: 10 }, async (res) => { if (res.didCancel || !res.assets) return; setIsSubmitting(true); const newItems = await Promise.all(res.assets.map(uploadItem)); setAlbumItems(prev => [...newItems.filter(Boolean).reverse() as GalleryItemType[], ...prev]); setIsSubmitting(false); });
    const uploadItem = async (asset: Asset): Promise<GalleryItemType | null> => { const originalEventDate = albumItems[0]?.event_date; if (!user || !originalEventDate) { Alert.alert("Error", "Cannot add to an empty album. Please upload from the main gallery screen first."); return null; } const fd = new FormData(); fd.append('title', albumTitle); fd.append('event_date', originalEventDate.split('T')[0]); fd.append('role', user.role); fd.append('adminId', String(user.id)); fd.append('media', { uri: asset.uri, type: asset.type, name: asset.fileName || `m-${Date.now()}` }); try { const { data } = await apiClient.post('/gallery/upload', fd); return { id: data.insertId, title: albumTitle, event_date: originalEventDate, file_path: data.filePath, file_type: asset.type?.startsWith('image') ? 'photo' : 'video' }; } catch (e) { Alert.alert("Upload Failed", "Could not upload the selected item."); return null; } };
    const closeModals = () => { setImageModalVisible(false); setVideoModalVisible(false); };
    
    const renderGridItem = ({ item, index }: { item: GalleryItemType; index: number }) => (
        <Animatable.View animation="zoomIn" duration={500} delay={index * 50} useNativeDriver={true}>
            <TouchableOpacity style={styles.gridItemContainer} onPress={() => handleItemPress(item)} activeOpacity={0.9}>
                <FastImage 
                    source={{ uri: `${SERVER_URL}${item.file_path}`, priority: FastImage.priority.normal }} 
                    style={styles.image} 
                    resizeMode={FastImage.resizeMode.cover}
                />
                {item.file_type === 'video' && (<View style={styles.videoOverlay}><Icon name="play-circle" size={30} color="rgba(255,255,255,0.8)" /></View>)}
                <View style={styles.iconOverlay}>
                    {isAdmin && (<TouchableOpacity style={styles.iconButton} onPress={(e) => { e.stopPropagation(); confirmDeleteItem(item); }}><Icon name="trash-outline" size={18} color="white" /></TouchableOpacity>)}
                    <TouchableOpacity style={styles.iconButton} onPress={(e) => { e.stopPropagation(); handleDownloadItem(item); }}><Icon name="download-outline" size={18} color="white" /></TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animatable.View>
    );

    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={ACCENT_COLOR} /></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F2F5F8" />
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="photo-library" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{albumTitle}</Text>
                        <Text style={styles.headerSubtitle}>{albumItems.length} items</Text>
                    </View>
                </View>
            </View>

            {/* Filters */}
            <View style={styles.filterContainer}>
                {(['all', 'photo', 'video'] as FilterType[]).map(type => (
                    <TouchableOpacity key={type} style={[styles.filterButton, activeFilter === type && styles.activeFilterButton]} onPress={() => setActiveFilter(type)}>
                        <Text style={[styles.filterButtonText, activeFilter === type && styles.activeFilterButtonText]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList 
                data={filteredItems} 
                keyExtractor={(item) => item.id.toString()} 
                numColumns={NUM_COLUMNS} 
                renderItem={renderGridItem} 
                contentContainerStyle={styles.listContainer} 
                ListEmptyComponent={<View style={styles.emptyContainer}><Icon name="images-outline" size={60} color="#ccc" /><Text style={styles.emptyText}>No items found in this album.</Text></View>} 
            />
            
            {isAdmin && (
                <Animatable.View animation="zoomIn" duration={400} delay={300} style={styles.fabContainer}>
                    <TouchableOpacity style={styles.fab} onPress={handleAddItem} disabled={isSubmitting}>
                        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Icon name="add" size={30} color="white" />}
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {/* Modals */}
            <Modal visible={isImageModalVisible} transparent={true} animationType="none" onRequestClose={closeModals}><Animatable.View style={styles.modalContainer} animation="fadeIn"><TouchableOpacity style={styles.closeButton} onPress={closeModals}><Icon name="close" size={32} color="white" /></TouchableOpacity><AnimatableFastImage source={{ uri: selectedImageUri!, priority: FastImage.priority.high }} style={styles.fullscreenImage} resizeMode={FastImage.resizeMode.contain} animation="zoomIn" /></Animatable.View></Modal>
            
            <Modal visible={isVideoModalVisible} transparent={true} animationType="none" onRequestClose={closeModals}>
                <Animatable.View style={styles.modalContainer} animation="fadeIn">
                    <TouchableOpacity style={styles.closeButton} onPress={closeModals}>
                        <Icon name="close" size={32} color="white" />
                    </TouchableOpacity>
                    {selectedVideoUri && ( 
                        <AnimatableVideo 
                            source={{ uri: selectedVideoUri }} 
                            style={styles.fullscreenVideo} 
                            controls={true} 
                            resizeMode="contain" 
                            animation="zoomIn" 
                            muted={false} 
                            ignoreSilentSwitch="ignore"
                        /> 
                    )}
                </Animatable.View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BACKGROUND_COLOR },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: CARD_BG,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_COLOR_DARK },
    headerSubtitle: { fontSize: 13, color: TEXT_COLOR_MEDIUM },

    // Filters
    filterContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, marginBottom: 5 },
    filterButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginHorizontal: 5, backgroundColor: '#E0E0E0' },
    activeFilterButton: { backgroundColor: ACCENT_COLOR, elevation: 2 },
    filterButtonText: { color: '#555', fontWeight: '600', fontSize: 13 },
    activeFilterButtonText: { color: '#FFFFFF' },

    // Grid Items
    listContainer: { padding: ITEM_MARGIN, paddingBottom: 80 },
    gridItemContainer: { width: imageSize, height: imageSize, margin: ITEM_MARGIN / 2, borderRadius: 8, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0', elevation: 1 },
    image: { width: '100%', height: '100%' },
    videoOverlay: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.2)', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    iconOverlay: { position: 'absolute', bottom: 0, right: 0, left: 0, padding: 4, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    iconButton: { marginLeft: 10 },
    
    // FAB
    fabContainer: { position: 'absolute', right: 25, bottom: 25 },
    fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: ACCENT_COLOR, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: ACCENT_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
    
    // Modal
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    fullscreenImage: { width: '100%', height: '100%' },
    fullscreenVideo: { width: '100%', height: '80%' },
    closeButton: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 20, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
    
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
    emptyText: { textAlign: 'center', fontSize: 16, color: '#888', marginTop: 16, fontWeight: '600' }
});

export default AlbumDetailScreen;