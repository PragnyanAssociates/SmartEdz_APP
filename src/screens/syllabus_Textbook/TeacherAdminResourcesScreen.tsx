// 📂 File: src/screens/admin/TeacherAdminResourcesScreen.tsx (REPLACE THIS FILE)

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, ScrollView, RefreshControl, Image } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import apiClient from '../../api/client';

const SERVER_URL = 'https://vivekanandapublicschoolerp-production.up.railway.app'; 

const TeacherAdminResourcesScreen = () => {
    const [mainView, setMainView] = useState<'syllabus' | 'textbooks'>('syllabus');
    const [boardView, setBoardView] = useState<'state' | 'central'>('state');
    
    const [syllabi, setSyllabi] = useState([]);
    const [textbooks, setTextbooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [allClasses, setAllClasses] = useState([]);

    const [modalResourceType, setModalResourceType] = useState<'syllabus' | 'textbook'>('syllabus');
    const [modalBoardType, setModalBoardType] = useState<'state' | 'central'>('state');
    const [selectedClass, setSelectedClass] = useState('');
    const [subjectName, setSubjectName] = useState('');
    const [url, setUrl] = useState('');
    const [selectedImage, setSelectedImage] = useState<ImagePickerResponse | null>(null);
    
    // ★ UPDATED ★ Now calls the new unified API endpoints
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

    const handleChoosePhoto = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, (response) => {
            if (response.didCancel || response.errorCode) return;
            setSelectedImage(response);
        });
    };

    const resetForm = () => {
        setEditingItem(null);
        setSelectedClass('');
        setSubjectName('');
        setUrl('');
        setSelectedImage(null);
        setModalResourceType(mainView === 'syllabus' ? 'syllabus' : 'textbook');
        setModalBoardType(boardView);
    };

    const openCreateModal = () => {
        resetForm();
        setIsModalVisible(true);
    };

    const openEditModal = (item: any, type: 'syllabus' | 'textbook') => {
        setEditingItem(item);
        setModalResourceType(type);
        setModalBoardType(item.syllabus_type);
        setSelectedClass(item.class_group);
        setUrl(item.url || '');
        setSubjectName(item.subject_name || '');
        setSelectedImage(null);
        setIsModalVisible(true);
    };

    const handleDelete = (item: any) => {
        const resourceName = mainView.slice(0, -1); // 'syllabus' or 'textbook'
        Alert.alert(`Confirm Delete`, `Delete ${resourceName} for ${item.subject_name} (${item.class_group})?`, [
            { text: "Cancel", style: 'cancel' },
            { text: "Delete", style: 'destructive', onPress: async () => {
                try {
                    // ★ UPDATED ★ Uses the new unified delete endpoint
                    await apiClient.delete(`/resources/${item.id}`);
                    fetchData();
                } catch(e) { Alert.alert("Error", `Could not delete ${resourceName}.`); }
            }},
        ]);
    };

    // ★ UNIFIED ★ A single save logic for both syllabi and textbooks
    const handleSave = async () => {
        if (!selectedClass || !url || !modalBoardType || !modalResourceType || !subjectName) {
            return Alert.alert("Validation Error", "All fields with * are required.");
        }
        setIsSaving(true);
        
        const data = new FormData();
        data.append('class_group', selectedClass);
        data.append('url', url);
        data.append('syllabus_type', modalBoardType);
        data.append('subject_name', subjectName);
        data.append('resource_type', modalResourceType);

        if (selectedImage?.assets?.[0]) {
            data.append('coverImage', {
                uri: selectedImage.assets[0].uri,
                type: selectedImage.assets[0].type,
                name: selectedImage.assets[0].fileName,
            });
        }
        
        try {
            const config = { headers: { 'Content-Type': 'multipart/form-data' } };
            if (editingItem) {
                await apiClient.put(`/resources/${editingItem.id}`, data, config);
            } else {
                await apiClient.post('/resources', data, config);
            }
        } catch (e: any) {
            setIsSaving(false);
            return Alert.alert("Error", e.response?.data?.message || "An error occurred while saving.");
        }
        
        Alert.alert("Success", "Resource saved successfully!");
        setIsSaving(false);
        setIsModalVisible(false);
        fetchData();
    };
    
    const renderList = () => {
        const isSyllabus = mainView === 'syllabus';
        const baseData = isSyllabus ? syllabi : textbooks;
        const filteredData = baseData.filter((item: any) => item.syllabus_type === boardView);
        const emptyTextMessage = `No ${mainView.slice(0, -1)} added for ${boardView} board yet.`;

        return (
            <FlatList
                data={filteredData}
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardContent}>
                            <Text style={styles.cardTitle}>{item.subject_name}</Text>
                            <Text style={styles.cardSubtitle}>{item.class_group}</Text>
                            <Text style={styles.urlText} numberOfLines={1}>URL: {item.url}</Text>
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(item, isSyllabus ? 'syllabus' : 'textbook')}><MaterialIcons name="edit" size={22} color="#0288d1" /></TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}><MaterialIcons name="delete" size={22} color="#d32f2f" /></TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>{emptyTextMessage}</Text></View>}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchData} />}
                contentContainerStyle={{ flexGrow: 1 }}
            />
        );
    };
    
    return (
        <View style={styles.container}>
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, mainView === 'syllabus' && styles.tabActive]} onPress={() => setMainView('syllabus')}>
                    <Text style={[styles.tabText, mainView === 'syllabus' && styles.tabTextActive]}>Syllabus Management</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, mainView === 'textbooks' && styles.tabActive]} onPress={() => setMainView('textbooks')}>
                    <Text style={[styles.tabText, mainView === 'textbooks' && styles.tabTextActive]}>Textbooks Management</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.boardPickerWrapper}>
                <Text style={styles.boardPickerLabel}>Filter by Board:</Text>
                <View style={styles.boardPickerContainer}>
                    <Picker selectedValue={boardView} onValueChange={(itemValue) => setBoardView(itemValue)} style={styles.boardPicker}>
                        <Picker.Item label="State Board" value="state" />
                        <Picker.Item label="Central Board" value="central" />
                    </Picker>
                </View>
            </View>

            {isLoading ? <ActivityIndicator style={{marginTop: 20}} size="large" /> : renderList()}
            
            <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
                <MaterialIcons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide">
                <ScrollView style={styles.modalView} keyboardShouldPersistTaps="handled">
                    <Text style={styles.modalTitle}>{editingItem ? 'Edit' : 'Create'} Resource</Text>
                    
                    <Text style={styles.label}>Resource Type*</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={modalResourceType} onValueChange={itemValue => setModalResourceType(itemValue)} enabled={!editingItem}>
                            <Picker.Item label="Syllabus" value="syllabus" />
                            <Picker.Item label="Textbook" value="textbook" />
                        </Picker>
                    </View>

                    <Text style={styles.label}>Board Type*</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={modalBoardType} onValueChange={itemValue => setModalBoardType(itemValue)}>
                            <Picker.Item label="State Board" value="state" />
                            <Picker.Item label="Central Board" value="central" />
                        </Picker>
                    </View>

                    <Text style={styles.label}>Class*</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={selectedClass} onValueChange={itemValue => setSelectedClass(itemValue)} enabled={!editingItem}>
                            <Picker.Item label="-- Select a class --" value="" />
                            {allClasses.map((c: string) => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>

                    {/* ★ UNIFIED FIELDS ★ These fields now appear for both resource types */}
                    <Text style={styles.label}>Subject Name*</Text>
                    <TextInput style={styles.input} value={subjectName} onChangeText={setSubjectName} placeholder="e.g., English, Mathematics..." />
                    
                    <Text style={styles.label}>{modalResourceType === 'syllabus' ? 'Syllabus' : 'Textbook'} URL*</Text>
                    <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="https://..." keyboardType="url" />

                    <Text style={styles.label}>Cover Image (Optional)</Text>
                    <TouchableOpacity style={styles.imagePicker} onPress={handleChoosePhoto}>
                        <MaterialIcons name="image" size={24} color="#555" />
                        <Text style={styles.imagePickerText}>{editingItem?.cover_image_url || selectedImage ? 'Change Image' : 'Select Cover Image'}</Text>
                    </TouchableOpacity>
                    
                    { (selectedImage?.assets?.[0]?.uri || editingItem?.cover_image_url) && 
                        <Image 
                            style={styles.previewImage} 
                            source={{ uri: selectedImage?.assets?.[0]?.uri || `${SERVER_URL}${editingItem.cover_image_url}` }} 
                        />
                    }

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsModalVisible(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSave} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Modal>
        </View>
    );
};

// --- ★ NO CHANGE IN STYLES ★ ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    tabContainer: { flexDirection: 'row', backgroundColor: '#fff', elevation: 2 },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: '#008080' },
    tabText: { fontSize: 16, color: '#757575' },
    tabTextActive: { color: '#008080', fontWeight: 'bold' },
    boardPickerWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd', },
    boardPickerLabel: { fontSize: 16, fontWeight: 'bold', color: '#333', marginRight: 10, },
    boardPickerContainer: { flex: 1, height: 45, justifyContent: 'center', backgroundColor: '#f5f5f5', borderRadius: 8, },
    boardPicker: { color: '#000', },
    card: { backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 15, marginVertical: 8, padding: 20, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardContent: { flex: 1, marginRight: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#37474f' },
    cardSubtitle: { fontSize: 14, color: '#546e7a', marginTop: 4 },
    urlText: { fontSize: 13, color: '#546e7a', marginTop: 4, fontStyle: 'italic' },
    cardActions: { flexDirection: 'row' },
    actionButton: { padding: 8 },
    fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#1e88e5', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#777' },
    modalView: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
    label: { fontSize: 16, fontWeight: '500', color: '#444', marginBottom: 5, marginLeft: 5, marginTop: 10 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 5, fontSize: 16 },
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#fff', marginBottom: 5, justifyContent: 'center' },
    imagePicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e0e0', padding: 12, borderRadius: 8, marginBottom: 10 },
    imagePickerText: { marginLeft: 10, fontSize: 16, color: '#333' },
    previewImage: { width: 100, height: 100, borderRadius: 8, alignSelf: 'center', marginBottom: 10 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 30, marginBottom: 50 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5, elevation: 2 },
    saveBtn: { backgroundColor: '#2e7d32' },
    cancelBtn: { backgroundColor: '#6c757d' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default TeacherAdminResourcesScreen;