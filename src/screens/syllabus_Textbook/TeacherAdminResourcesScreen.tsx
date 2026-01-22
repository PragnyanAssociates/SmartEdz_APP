import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, ScrollView, RefreshControl, Image, Linking, SafeAreaView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Picker } from '@react-native-picker/picker';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
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

const TeacherAdminResourcesScreen = () => {
    const navigation = useNavigation();
    const [mainView, setMainView] = useState<'syllabus' | 'textbooks'>('syllabus');
    const [boardView, setBoardView] = useState<'state' | 'central'>('state');
    const [selectedClassFilter, setSelectedClassFilter] = useState('All'); 
    
    const [syllabi, setSyllabi] = useState([]);
    const [textbooks, setTextbooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [allClasses, setAllClasses] = useState([]);
    
    // Form State
    const [modalResourceType, setModalResourceType] = useState<'syllabus' | 'textbook'>('syllabus');
    const [modalBoardType, setModalBoardType] = useState<'state' | 'central'>('state');
    const [selectedClass, setSelectedClass] = useState('');
    const [subjectName, setSubjectName] = useState('');
    const [url, setUrl] = useState('');
    const [selectedImage, setSelectedImage] = useState<ImagePickerResponse | null>(null);
    
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [syllabusRes, textbookRes, classesRes] = await Promise.all([
                apiClient.get('/resources?type=syllabus'),
                apiClient.get('/resources?type=textbook'),
                apiClient.get('/all-classes')
            ]);
            setSyllabi(syllabusRes.data);
            setTextbooks(textbookRes.data);
            setAllClasses(classesRes.data);
        } catch (e) { Alert.alert("Error", "Failed to fetch data from the server."); } 
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCardPress = async (item) => {
        if (!item.url) return Alert.alert("Not Available", "The link for this item has not been provided yet.");
        if (item.url.toLowerCase().endsWith('.pdf')) {
            navigation.navigate('PDFViewer', { url: item.url, title: item.subject_name });
        } else {
            const canOpen = await Linking.canOpenURL(item.url);
            if (canOpen) await Linking.openURL(item.url);
            else Alert.alert("Error", `Could not open the link.`);
        }
    };
    
    const handleChoosePhoto = () => { launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, (response) => { if (response.didCancel || response.errorCode) return; setSelectedImage(response); }); };
    
    const resetForm = () => { setEditingItem(null); setSelectedClass(''); setSubjectName(''); setUrl(''); setSelectedImage(null); setModalResourceType(mainView === 'syllabus' ? 'syllabus' : 'textbook'); setModalBoardType(boardView); };
    
    const openCreateModal = () => { resetForm(); setIsModalVisible(true); };
    
    const openEditModal = (item, type) => { setEditingItem(item); setModalResourceType(type); setModalBoardType(item.syllabus_type); setSelectedClass(item.class_group); setUrl(item.url || ''); setSubjectName(item.subject_name || ''); setSelectedImage(null); setIsModalVisible(true); };
    
    const handleDelete = (item) => { const resourceName = mainView.slice(0, -1); Alert.alert(`Confirm Delete`, `Delete ${resourceName} for ${item.subject_name} (${item.class_group})?`, [{ text: "Cancel", style: 'cancel' }, { text: "Delete", style: 'destructive', onPress: async () => { try { await apiClient.delete(`/resources/${item.id}`); fetchData(); } catch(e) { Alert.alert("Error", `Could not delete ${resourceName}.`); }}},]);};
    
    const handleSave = async () => { 
        if (!selectedClass || !url || !modalBoardType || !modalResourceType || !subjectName) return Alert.alert("Validation Error", "All fields with * are required."); 
        setIsSaving(true); 
        const data = new FormData(); 
        data.append('class_group', selectedClass); 
        data.append('url', url); 
        data.append('syllabus_type', modalBoardType); 
        data.append('subject_name', subjectName); 
        data.append('resource_type', modalResourceType); 
        if (selectedImage?.assets?.[0]) { 
            data.append('coverImage', { uri: selectedImage.assets[0].uri, type: selectedImage.assets[0].type, name: selectedImage.assets[0].fileName, }); 
        } 
        try { 
            const config = { headers: { 'Content-Type': 'multipart/form-data' } }; 
            if (editingItem) await apiClient.put(`/resources/${editingItem.id}`, data, config); 
            else await apiClient.post('/resources', data, config); 
            Alert.alert("Success", "Resource saved successfully!"); 
            setIsModalVisible(false); 
            fetchData(); 
        } catch (e) { Alert.alert("Error", e.response?.data?.message || "An error occurred while saving."); } 
        finally { setIsSaving(false); }
    };
    
    const displayableClasses = allClasses.filter(c => c.startsWith('Class') || c === 'LKG' || c === 'UKG');

    const renderList = () => {
        const isSyllabus = mainView === 'syllabus';
        const baseData = isSyllabus ? syllabi : textbooks;
        
        const filteredData = baseData
            .filter((item) => item.syllabus_type === boardView)
            .filter((item) => selectedClassFilter === 'All' ? true : item.class_group === selectedClassFilter);

        return (
            <FlatList
                data={filteredData}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2} 
                contentContainerStyle={styles.gridContainer}
                renderItem={({ item, index }) => {
                    const imageUri = item.cover_image_url ? `${SERVER_URL}${item.cover_image_url}` : `https://via.placeholder.com/300x400/DCDCDC/808080?text=${item.subject_name.replace(' ', '+')}`;
                    return (
                        <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.gridItemWrapper}>
                            <TouchableOpacity style={styles.gridItem} onPress={() => handleCardPress(item)} activeOpacity={0.9}>
                                <Image source={{ uri: imageUri }} style={styles.coverImage} />
                                <View style={styles.actionsOverlay}>
                                    <TouchableOpacity style={styles.iconButton} onPress={() => openEditModal(item, isSyllabus ? 'syllabus' : 'textbook')}>
                                        <MaterialIcons name="edit" size={16} color={COLORS.blue} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.iconButton} onPress={() => handleDelete(item)}>
                                        <MaterialIcons name="delete" size={16} color={COLORS.danger} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.infoContainer}>
                                    <Text style={styles.gridTitle} numberOfLines={1}>{item.subject_name}</Text>
                                    <Text style={styles.gridSubtitle}>{item.class_group}</Text>
                                </View>
                            </TouchableOpacity>
                        </Animatable.View>
                    );
                }}
                ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>{`No ${mainView} found.`}</Text></View>}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchData} />}
            />
        );
    };
    
    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="bookshelf" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Resources</Text>
                        <Text style={styles.headerSubtitle}>Syllabus & Textbooks</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={openCreateModal}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* --- TABS --- */}
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, mainView === 'syllabus' && styles.tabActive]} onPress={() => setMainView('syllabus')}>
                    <Text style={[styles.tabText, mainView === 'syllabus' && styles.tabTextActive]}>Syllabus</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, mainView === 'textbooks' && styles.tabActive]} onPress={() => setMainView('textbooks')}>
                    <Text style={[styles.tabText, mainView === 'textbooks' && styles.tabTextActive]}>Textbooks</Text>
                </TouchableOpacity>
            </View>
            
            {/* --- FILTERS --- */}
            <View style={styles.filterSection}>
                <View style={styles.pickerWrapper}>
                    <Text style={styles.pickerLabel}>Board:</Text>
                    <View style={styles.pickerBox}>
                        <Picker selectedValue={boardView} onValueChange={setBoardView} style={styles.picker}>
                            <Picker.Item label="State" value="state" />
                            <Picker.Item label="Central" value="central" />
                        </Picker>
                    </View>
                </View>

                <View style={styles.pickerWrapper}>
                    <Text style={styles.pickerLabel}>Class:</Text>
                    <View style={styles.pickerBox}>
                        <Picker selectedValue={selectedClassFilter} onValueChange={setSelectedClassFilter} style={styles.picker}>
                            <Picker.Item label="All Classes" value="All" />
                            {displayableClasses.map((c) => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>
                </View>
            </View>

            {isLoading ? <ActivityIndicator style={{marginTop: 40}} size="large" color={COLORS.primary} /> : renderList()}

            {/* --- MODAL --- */}
            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide">
                <View style={styles.modalBackground}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingItem ? 'Edit' : 'Create'} Resource</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <MaterialIcons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{paddingBottom: 20}} keyboardShouldPersistTaps="handled">
                            <Text style={styles.label}>Resource Type*</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={modalResourceType} onValueChange={setModalResourceType} enabled={!editingItem}>
                                    <Picker.Item label="Syllabus" value="syllabus" />
                                    <Picker.Item label="Textbook" value="textbook" />
                                </Picker>
                            </View>
                            
                            <Text style={styles.label}>Board Type*</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={modalBoardType} onValueChange={setModalBoardType}>
                                    <Picker.Item label="State Board" value="state" />
                                    <Picker.Item label="Central Board" value="central" />
                                </Picker>
                            </View>
                            
                            <Text style={styles.label}>Class*</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={selectedClass} onValueChange={setSelectedClass} enabled={!editingItem}>
                                    <Picker.Item label="-- Select Class --" value="" />
                                    {displayableClasses.map((c) => <Picker.Item key={c} label={c} value={c} />)}
                                </Picker>
                            </View>
                            
                            <Text style={styles.label}>Subject Name*</Text>
                            <TextInput style={styles.input} value={subjectName} onChangeText={setSubjectName} placeholder="e.g., English..." />
                            
                            <Text style={styles.label}>Resource URL*</Text>
                            <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="https://..." keyboardType="url" />
                            
                            <TouchableOpacity style={styles.imagePicker} onPress={handleChoosePhoto}>
                                <MaterialIcons name="image" size={24} color={COLORS.textSub} />
                                <Text style={styles.imagePickerText}>{editingItem?.cover_image_url || selectedImage ? 'Change Image' : 'Select Cover Image'}</Text>
                            </TouchableOpacity>
                            { (selectedImage?.assets?.[0]?.uri || editingItem?.cover_image_url) && <Image style={styles.previewImage} source={{ uri: selectedImage?.assets?.[0]?.uri || `${SERVER_URL}${editingItem.cover_image_url}` }} /> }
                            
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSave} disabled={isSaving}>
                                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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

    // --- TABS ---
    tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: 8, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: COLORS.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { backgroundColor: '#F0FDF4', borderBottomWidth: 3, borderBottomColor: COLORS.primary },
    tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSub },
    tabTextActive: { color: COLORS.primary },

    // --- FILTERS ---
    filterSection: { flexDirection: 'row', paddingHorizontal: 15, gap: 10, marginBottom: 10 },
    pickerWrapper: { flex: 1 },
    pickerLabel: { fontSize: 12, fontWeight: 'bold', color: COLORS.textSub, marginBottom: 4, marginLeft: 2 },
    pickerBox: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, height: 40, justifyContent: 'center' },
    picker: { color: COLORS.textMain },

    // --- GRID ---
    gridContainer: { paddingHorizontal: 10, paddingBottom: 20 },
    gridItemWrapper: { width: '50%', padding: 5 },
    gridItem: { backgroundColor: '#fff', borderRadius: 10, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, overflow: 'hidden' },
    coverImage: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#eee' },
    infoContainer: { padding: 10, alignItems: 'center' },
    gridTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, textAlign: 'center' },
    gridSubtitle: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
    actionsOverlay: { position: 'absolute', top: 5, right: 5, flexDirection: 'row', gap: 5 },
    iconButton: { backgroundColor: 'rgba(255,255,255,0.9)', padding: 5, borderRadius: 15, elevation: 2 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    emptyText: { textAlign: 'center', fontSize: 16, color: COLORS.textSub },

    // --- MODAL ---
    modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', backgroundColor: 'white', borderRadius: 12, padding: 20, maxHeight: '85%', elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textSub, marginBottom: 5, marginTop: 10 },
    input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#FAFAFA' },
    pickerContainer: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: '#FAFAFA', marginBottom: 5 },
    imagePicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e0e0', padding: 10, borderRadius: 8, marginTop: 10, justifyContent: 'center' },
    imagePickerText: { marginLeft: 10, fontSize: 14, color: COLORS.textMain },
    previewImage: { width: 80, height: 100, borderRadius: 8, alignSelf: 'center', marginTop: 10 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5, elevation: 2 },
    saveBtn: { backgroundColor: COLORS.primary },
    cancelBtn: { backgroundColor: '#e0e0e0' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    cancelBtnText: { color: '#333', fontWeight: 'bold', fontSize: 15 },
});

export default TeacherAdminResourcesScreen;