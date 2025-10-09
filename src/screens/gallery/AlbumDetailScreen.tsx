// 📂 File: src/screens/gallery/AlbumDetailScreen.tsx (MODIFIED & ENHANCED)

import React, { useState, useEffect, FC } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, Dimensions,
    TouchableOpacity, Modal, SafeAreaView, Alert, ActivityIndicator,
    PermissionsAndroid, Platform, StatusBar
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import RNFetchBlob from 'rn-fetch-blob';
import * as Animatable from 'react-native-animatable'; // ★ DYNAMIC LOOK: Import Animatable
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';

// --- Type Definitions ---
type GalleryItemType = { id: number; title: string; event_date: string; file_path: string; file_type: 'photo' | 'video'; };
type RootStackParamList = { AlbumDetail: { title: string; items: GalleryItemType[]; }; };
type AlbumDetailScreenRouteProp = RouteProp<RootStackParamList, 'AlbumDetail'>;

const { width } = Dimensions.get('window');
const ITEM_MARGIN = 6;
const NUM_COLUMNS = 3;
const imageSize = (width - (ITEM_MARGIN * (NUM_COLUMNS + 1))) / NUM_COLUMNS;
const ACCENT_COLOR = '#5A33C8'; // ★ DYNAMIC LOOK: Consistent color theme

// Create Animatable Video Component
const AnimatableVideo = Animatable.createAnimatableComponent(Video);

const handleDownloadItem = async (item: GalleryItemType) => {
    if (!item) return;
    const url = `${SERVER_URL}${item.file_path}`;
    const fileName = item.file_path.split('/').pop() || `gallery-item-${Date.now()}`;

    if (Platform.OS === 'android') {
        try {
            const permission = Platform.Version >= 33 
                ? item.file_type === 'video' ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO : PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
                : PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
            const granted = await PermissionsAndroid.request(permission, { title: 'Storage Permission Required', message: 'App needs access to your storage to download this file.', buttonPositive: 'OK' });
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) { Alert.alert('Permission Denied', 'Storage permission is required to download files.'); return; }
        } catch (err) { console.warn(err); return; }
    }
    downloadFile(url, fileName);
};

const downloadFile = (url: string, fileName: string) => {
    const { dirs } = RNFetchBlob.fs;
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    let downloadPath = '';
    if (Platform.OS === 'ios') { downloadPath = dirs.DocumentDir + `/${fileName}`; } 
    else { const pathDir = (fileExt === 'mp4' || fileExt === 'mov' || fileExt === 'mkv') ? dirs.MovieDir : dirs.PictureDir; downloadPath = `${pathDir}/${fileName}`; }
    Alert.alert('Starting Download', `Downloading "${fileName}"...`);
    RNFetchBlob.config({ path: downloadPath, fileCache: true, addAndroidDownloads: { useDownloadManager: true, notification: true, path: downloadPath, description: 'Downloading media file.', title: fileName } })
    .fetch('GET', url)
    .then((res) => {
        if (Platform.OS === 'ios') { RNFetchBlob.ios.saveToCameraRoll(res.path()).then(() => { Alert.alert('Success', `"${fileName}" saved to Photos.`); RNFetchBlob.fs.unlink(res.path()); }).catch(() => Alert.alert('Save Error', 'Could not save to Photos.')); } 
        else { Alert.alert('Success', `"${fileName}" saved to your device.`); RNFetchBlob.fs.scanFile(res.path()); }
    }).catch((error) => { console.error(error); Alert.alert('Download Failed', 'An error occurred while downloading.'); });
};

const AlbumDetailScreen: FC = () => {
    const route = useRoute<AlbumDetailScreenRouteProp>();
    const navigation = useNavigation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [albumItems, setAlbumItems] = useState<GalleryItemType[]>(route.params.items);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isImageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [isVideoModalVisible, setVideoModalVisible] = useState(false);
    const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);

    useEffect(() => { navigation.setOptions({ title: route.params.title }); }, [navigation, route.params.title]);

    const handleItemPress = (item: GalleryItemType) => {
        if (item.file_type === 'photo') { setSelectedImageUri(`${SERVER_URL}${item.file_path}`); setImageModalVisible(true); } 
        else { setSelectedVideoUri(`${SERVER_URL}${item.file_path}`); setVideoModalVisible(true); }
    };

    const confirmDeleteItem = (itemToDelete: GalleryItemType) => {
        Alert.alert("Delete Item", "Are you sure you want to delete this item permanently?",
            [ { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteItem(itemToDelete.id) } ]
        );
    };

    const deleteItem = async (itemId: number) => {
        if (!user) return;
        try {
            await apiClient.delete(`/gallery/${itemId}`, { data: { role: user.role } });
            Alert.alert("Success", "Item has been deleted.");
            setAlbumItems(prevItems => prevItems.filter(item => item.id !== itemId));
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Could not delete the item.");
        }
    };

    const handleAddItem = () => {
        launchImageLibrary({ mediaType: 'mixed', selectionLimit: 5 }, async (response) => {
            if (response.didCancel || !response.assets) return;
            if (response.errorCode) { Alert.alert("Error", "ImagePicker Error: " + response.errorMessage); return; }
            setIsSubmitting(true);
            const newItems: GalleryItemType[] = [];
            for (const asset of response.assets) {
                const newItem = await uploadItem(asset);
                if (newItem) newItems.push(newItem);
            }
            setAlbumItems(prevItems => [...newItems.reverse(), ...prevItems]);
            setIsSubmitting(false);
        });
    };

    const uploadItem = async (asset: Asset): Promise<GalleryItemType | null> => {
        if (!user || !route.params.title || !albumItems[0]?.event_date) {
            Alert.alert('Upload Error', 'Cannot add to this album because its details are missing.');
            return null;
        }
        const formData = new FormData();
        formData.append('title', route.params.title);
        formData.append('event_date', albumItems[0].event_date.split('T')[0]);
        formData.append('role', user.role);
        formData.append('adminId', String(user.id));
        formData.append('media', { uri: asset.uri, type: asset.type, name: asset.fileName || `media-${Date.now()}` });
        try {
            const { data } = await apiClient.post('/gallery/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            return { id: data.insertId, title: route.params.title, event_date: albumItems[0].event_date, file_path: data.filePath, file_type: asset.type?.startsWith('image') ? 'photo' : 'video' };
        } catch (error: any) {
            Alert.alert('Upload Error', error.response?.data?.message || 'An error occurred while uploading a file.');
            return null;
        }
    };
    
    const closeModals = () => { setImageModalVisible(false); setVideoModalVisible(false); };

    // ★ DYNAMIC LOOK: Animate each grid item as it appears
    const renderGridItem = ({ item, index }: { item: GalleryItemType; index: number }) => (
        <Animatable.View animation="zoomIn" duration={500} delay={index * 100} useNativeDriver={true}>
            <TouchableOpacity style={styles.gridItemContainer} onPress={() => handleItemPress(item)}>
                {item.file_type === 'photo' ? (
                    <Image source={{ uri: `${SERVER_URL}${item.file_path}` }} style={styles.image} />
                ) : (
                    <View style={styles.image}>
                        <View style={styles.videoOverlay}><Icon name="play" size={30} color="white" /></View>
                    </View>
                )}
                <View style={styles.iconOverlay}>
                    {isAdmin && ( 
                        <TouchableOpacity style={styles.iconButton} onPress={(e) => { e.stopPropagation(); confirmDeleteItem(item); }}>
                            <Icon name="trash-outline" size={18} color="white" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.iconButton} onPress={(e) => { e.stopPropagation(); handleDownloadItem(item); }}>
                        <Icon name="download-outline" size={18} color="white" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animatable.View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />
            <FlatList 
                data={albumItems} 
                keyExtractor={(item) => item.id.toString()} 
                numColumns={NUM_COLUMNS} 
                renderItem={renderGridItem} 
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="images-outline" size={60} color="#ccc" />
                        <Text style={styles.emptyText}>This album is empty.</Text>
                        <Text style={styles.emptySubText}>{isAdmin ? "Press the '+' button to add photos or videos." : "Check back later for new content."}</Text>
                    </View>
                }
            />
            {isAdmin && (
                <Animatable.View animation="zoomIn" duration={400} delay={300} style={styles.fabContainer}>
                    <TouchableOpacity style={styles.fab} onPress={handleAddItem} disabled={isSubmitting}>
                        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Icon name="add" size={30} color="white" />}
                    </TouchableOpacity>
                </Animatable.View>
            )}
            <Modal visible={isImageModalVisible} transparent={true} animationType="none" onRequestClose={closeModals}>
                <Animatable.View style={styles.modalContainer} animation="fadeIn" duration={300}>
                    <TouchableOpacity style={styles.closeButton} onPress={closeModals}><Icon name="close" size={32} color="white" /></TouchableOpacity>
                    <Animatable.Image source={{ uri: selectedImageUri! }} style={styles.fullscreenImage} resizeMode="contain" animation="zoomIn" duration={400} delay={100} />
                </Animatable.View>
            </Modal>
            <Modal visible={isVideoModalVisible} transparent={true} animationType="none" onRequestClose={closeModals}>
                <Animatable.View style={styles.modalContainer} animation="fadeIn" duration={300}>
                    <TouchableOpacity style={styles.closeButton} onPress={closeModals}><Icon name="close" size={32} color="white" /></TouchableOpacity>
                    {selectedVideoUri && ( <AnimatableVideo source={{ uri: selectedVideoUri }} style={styles.fullscreenVideo} controls={true} resizeMode="contain" animation="zoomIn" duration={400} delay={100} /> )}
                </Animatable.View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    listContainer: { padding: ITEM_MARGIN },
    gridItemContainer: { width: imageSize, height: imageSize, margin: ITEM_MARGIN / 2, borderRadius: 8, overflow: 'hidden' },
    image: { width: '100%', height: '100%', backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
    videoOverlay: { backgroundColor: 'rgba(0,0,0,0.3)', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    iconOverlay: { position: 'absolute', bottom: 0, right: 0, left: 0, padding: 6, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    iconButton: { marginLeft: 10 },
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    fullscreenImage: { width: '100%', height: '100%' },
    fullscreenVideo: { width: '100%', height: '80%' },
    closeButton: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 20, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
    fabContainer: { position: 'absolute', right: 25, bottom: 25 },
    fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: ACCENT_COLOR, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: ACCENT_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
    emptyText: { textAlign: 'center', fontSize: 18, color: '#888', marginTop: 16, fontWeight: '600' },
    emptySubText: { textAlign: 'center', marginTop: 8, fontSize: 14, color: '#aaa', paddingHorizontal: 40 }
});
export default AlbumDetailScreen;