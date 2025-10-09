// 📂 File: src/screens/gallery/GalleryScreen.tsx (MODIFIED & ENHANCED)

import React, { useState, useEffect, FC, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, Dimensions,
    TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput,
    Button, Platform, SafeAreaView, StatusBar
} from 'react-native';
import { TabView, SceneMap, TabBar, Route } from 'react-native-tab-view';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable'; // ★ DYNAMIC LOOK: Import Animatable
import LinearGradient from 'react-native-linear-gradient'; // ★ DYNAMIC LOOK: Import LinearGradient
import { useAuth } from '../../context/AuthContext'; 
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

// --- Type Definitions ---
type GalleryItemType = {
    id: number;
    title: string;
    event_date: string;
    file_path: string;
    file_type: 'photo' | 'video';
    uploader_name: string;
};

type AlbumSection = {
    title: string;
    date: string;
    items: GalleryItemType[];
};

type RootStackParamList = {
    AlbumDetail: { title: string; items: GalleryItemType[] };
};
type GalleryScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const ACCENT_COLOR = '#5A33C8'; // ★ DYNAMIC LOOK: Consistent color theme

// --- AlbumCover Component ---
const AlbumCover: FC<{ 
    section: AlbumSection, 
    onPress: () => void,
    onDelete: () => void,
    isAdmin: boolean,
    index: number, // ★ DYNAMIC LOOK: Index for staggered animation
}> = ({ section, onPress, onDelete, isAdmin, index }) => {
    const coverItem = section.items.find(item => item.file_type === 'photo') || section.items[0];
    if (!coverItem) return null;

    return (
        // ★ DYNAMIC LOOK: Animate each album cover as it appears
        <Animatable.View
            animation="fadeInUp"
            duration={600}
            delay={index * 150} // Staggered delay
            useNativeDriver={true}
        >
            <TouchableOpacity style={styles.albumContainer} onPress={onPress}>
                <Image
                    source={{ uri: `${SERVER_URL}${coverItem.file_path}` }}
                    style={styles.albumImage}
                />
                {/* ★ DYNAMIC LOOK: Gradient overlay for better text readability */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.gradientOverlay}
                />
                <View style={styles.albumInfo}>
                    <Text style={styles.albumTitle} numberOfLines={2}>{section.title}</Text>
                    <Text style={styles.albumDate}>{new Date(section.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</Text>
                    <Text style={styles.albumCount}>{section.items.length} items</Text>
                </View>
                 {isAdmin && (
                    <TouchableOpacity 
                        style={styles.deleteButton} 
                        onPress={(e) => { e.stopPropagation(); onDelete(); }}
                    >
                        <Icon name="trash-outline" size={20} color="white" />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        </Animatable.View>
    );
};

// --- Main GalleryScreen Component ---
const GalleryScreen: FC = () => {
    const { user } = useAuth(); 
    const navigation = useNavigation<GalleryScreenNavigationProp>();
    const isAdmin = user?.role === 'admin';

    const [index, setIndex] = useState<number>(0);
    const [routes] = useState<Route[]>([ { key: 'photos', title: 'Photos' }, { key: 'videos', title: 'Videos' } ]);
    
    const [photoAlbums, setPhotoAlbums] = useState<AlbumSection[]>([]);
    const [videoAlbums, setVideoAlbums] = useState<AlbumSection[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const [isUploadModalVisible, setUploadModalVisible] = useState<boolean>(false);
    const [title, setTitle] = useState<string>('');
    const [eventDate, setEventDate] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
    const [mediaAsset, setMediaAsset] = useState<Asset | null>(null);

    const groupDataByTitle = (data: GalleryItemType[]): AlbumSection[] => {
        if (!data) return [];
        const grouped = data.reduce((acc, item) => {
            if (!acc[item.title]) { acc[item.title] = { title: item.title, date: item.event_date, items: [] }; }
            acc[item.title].items.push(item);
            return acc;
        }, {} as Record<string, AlbumSection>);
        return Object.values(grouped).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const fetchData = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            const response = await apiClient.get<GalleryItemType[]>('/gallery');
            const allItems = response.data;
            const allAlbums = groupDataByTitle(allItems);
            const photoData = allAlbums.filter(album => album.items.some(item => item.file_type === 'photo'));
            const videoData = allAlbums.filter(album => album.items.some(item => item.file_type === 'video'));
            setPhotoAlbums(photoData);
            setVideoAlbums(videoData);
        } catch (error: any) { 
            console.error('Failed to fetch gallery items:', error); 
            Alert.alert("Error", error.response?.data?.message || "Failed to load gallery items.");
        } finally { 
            setLoading(false); 
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleAlbumPress = (section: AlbumSection) => {
        navigation.navigate('AlbumDetail', { title: section.title, items: section.items });
    };

    const handleDeleteAlbum = (albumTitle: string) => {
        Alert.alert("Delete Album", `Are you sure you want to permanently delete the "${albumTitle}" album? This cannot be undone.`,
            [ { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive",
                onPress: async () => {
                    try {
                        await apiClient.delete('/gallery/album', { data: { title: albumTitle, role: user?.role } });
                        Alert.alert("Success", `Album "${albumTitle}" has been deleted.`);
                        fetchData();
                    } catch (error: any) {
                        console.error("Failed to delete album:", error);
                        Alert.alert("Error", error.response?.data?.message || "An error occurred while deleting the album.");
                    }
                },
              },
            ]
        );
    };

    const handleOpenUploadModal = (): void => {
        setTitle(''); setEventDate(new Date()); setMediaAsset(null); setUploadModalVisible(true);
    };

    const handleUpload = async (): Promise<void> => { 
        if (!user || !title.trim() || !eventDate || !mediaAsset) {
            Alert.alert('Validation Error', 'All fields and a media file are required.'); 
            return; 
        }
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('event_date', eventDate.toISOString().split('T')[0]);
        formData.append('role', user.role);
        formData.append('adminId', String(user.id));
        formData.append('media', { uri: mediaAsset.uri, type: mediaAsset.type, name: mediaAsset.fileName || `media-${Date.now()}` });
        try {
            await apiClient.post('/gallery/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            Alert.alert('Success', 'Media uploaded!');
            setUploadModalVisible(false);
            fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'An error occurred while uploading.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date): void => { 
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) setEventDate(selectedDate);
    };
    
    // ★ DYNAMIC LOOK: Pass index to renderItem for staggered animation
    const renderAlbumList = (data: AlbumSection[]) => (
        <FlatList 
            data={data} 
            keyExtractor={(item) => item.title} 
            renderItem={({ item, index }) => (
                <AlbumCover 
                    section={item} 
                    onPress={() => handleAlbumPress(item)} 
                    onDelete={() => handleDeleteAlbum(item.title)} 
                    isAdmin={isAdmin} 
                    index={index}
                /> 
            )} 
            ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No albums found.</Text></View>} 
            contentContainerStyle={styles.listContainer} 
            onRefresh={fetchData} 
            refreshing={loading}
        />
    );
    
    const renderScene = SceneMap({
        photos: () => renderAlbumList(photoAlbums),
        videos: () => renderAlbumList(videoAlbums),
    });

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
            <TabView 
                navigationState={{ index, routes }} 
                renderScene={renderScene} 
                onIndexChange={setIndex} 
                initialLayout={{ width }} 
                renderTabBar={props => <TabBar {...props} 
                    indicatorStyle={{ backgroundColor: ACCENT_COLOR, height: 3, borderRadius: 2 }} 
                    style={{ backgroundColor: 'white', elevation: 1, shadowOpacity: 0.05 }} 
                    labelStyle={{ fontWeight: '700', textTransform: 'capitalize' }} 
                    activeColor={ACCENT_COLOR} 
                    inactiveColor={'#777'} 
                />} 
            />
            {isAdmin && ( 
                 // ★ DYNAMIC LOOK: Animated FAB
                <Animatable.View animation="zoomIn" duration={400} delay={300} style={styles.fabContainer}>
                    <TouchableOpacity style={styles.fab} onPress={handleOpenUploadModal}>
                        <Icon name="add" size={30} color="white" />
                    </TouchableOpacity>
                </Animatable.View>
            )}
            <Modal visible={isUploadModalVisible} transparent={true} animationType="fade" onRequestClose={() => setUploadModalVisible(false)}>
                 <View style={styles.modalContainer}>
                    {/* ★ DYNAMIC LOOK: Animated Modal View */}
                    <Animatable.View animation="zoomInUp" duration={500} style={styles.modalView}>
                        <Text style={styles.modalTitle}>Create New Album</Text>
                        <TextInput style={styles.input} placeholder="Album Title" value={title} onChangeText={setTitle} />
                        <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
                            <Icon name="calendar-outline" size={20} color="#555" style={{marginRight: 10}} />
                            <Text style={styles.datePickerText}>Event Date: {eventDate.toLocaleDateString()}</Text>
                        </TouchableOpacity>
                        {showDatePicker && (<DateTimePicker value={eventDate} mode="date" display="default" onChange={onDateChange} />)}
                        <TouchableOpacity style={styles.selectButton} onPress={() => launchImageLibrary({ mediaType: 'mixed' }, r => r.assets && setMediaAsset(r.assets[0]))}>
                            <Icon name={mediaAsset ? "checkmark-circle" : "attach"} size={20} color={mediaAsset ? '#4CAF50' : ACCENT_COLOR} />
                            <Text style={styles.selectButtonText}>{mediaAsset ? "Media Selected" : "Select Cover Photo/Video"}</Text>
                        </TouchableOpacity>
                        {mediaAsset?.fileName && <Text style={styles.fileName} numberOfLines={1}>{mediaAsset.fileName}</Text>}
                        <View style={styles.modalActions}>
                            <Button title="Cancel" onPress={() => setUploadModalVisible(false)} color="#888" />
                            <View style={{ width: 20 }} />
                            <Button title={isSubmitting ? "Uploading..." : 'Upload'} onPress={handleUpload} disabled={isSubmitting} color={ACCENT_COLOR} />
                        </View>
                    </Animatable.View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F2F5' },
    listContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', height: Dimensions.get('window').height / 2 },
    emptyText: { textAlign: 'center', fontSize: 16, color: '#888' },
    albumContainer: { width: '100%', marginBottom: 20, borderRadius: 16, backgroundColor: '#fff', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, overflow: 'hidden' },
    albumImage: { width: '100%', height: 200, backgroundColor: '#e0e0e0' },
    gradientOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
    albumInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, },
    albumTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 10 },
    albumDate: { fontSize: 14, color: '#eee', marginTop: 4 },
    albumCount: { fontSize: 14, color: '#eee', marginTop: 4, fontWeight: '600' },
    deleteButton: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    fabContainer: { position: 'absolute', right: 25, bottom: 25 },
    fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: ACCENT_COLOR, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: ACCENT_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalView: { width: '90%', maxWidth: 400, backgroundColor: 'white', borderRadius: 20, padding: 25, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 24, color: '#333' },
    input: { width: '100%', height: 50, backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 15, paddingHorizontal: 15, fontSize: 16 },
    datePickerButton: { width: '100%', height: 50, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 15, paddingHorizontal: 15 },
    datePickerText: { fontSize: 16, color: '#333' },
    selectButton: { width: '100%', height: 50, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8E1FF', borderRadius: 8, marginBottom: 8 },
    selectButtonText: { color: ACCENT_COLOR, fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
    fileName: { fontSize: 12, color: 'gray', textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%', marginTop: 20 }
});
export default GalleryScreen;