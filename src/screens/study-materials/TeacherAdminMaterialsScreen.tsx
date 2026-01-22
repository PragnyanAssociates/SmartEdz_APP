// 📂 File: src/screens/study-materials/TeacherAdminMaterialsScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, TextInput, Linking, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import { pick, types, isCancel } from '@react-native-documents/picker';
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

// --- Main Router Component ---
const TeacherAdminMaterialsScreen = () => {
    const { user } = useAuth();
    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const isFocused = useIsFocused();

    const fetchMaterials = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/study-materials/teacher/${user.id}`);
            setMaterials(response.data);
        } catch (error: any) { Alert.alert("Error", error.response?.data?.message || "Failed to fetch your materials."); }
        finally { setIsLoading(false); }
    }, [user?.id]);

    useEffect(() => {
        if (isFocused) {
            fetchMaterials();
        }
    }, [isFocused, fetchMaterials]);

    const openModal = (material = null) => {
        setEditingMaterial(material);
        setIsModalVisible(true);
    };

    const handleDelete = (material) => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this study material?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    try {
                        await apiClient.delete(`/study-materials/${material.material_id}`);
                        Alert.alert("Success", "Material deleted.");
                        setMaterials(prev => prev.filter(m => m.material_id !== material.material_id));
                    } catch (error: any) { Alert.alert("Error", error.response?.data?.message || "Failed to delete."); }
                },
            },
        ]);
    };

    const renderItem = ({ item, index }) => {
        return (
            <Animatable.View animation="fadeInUp" duration={500} delay={index * 100}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={{flex: 1}}>
                            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                            <Text style={styles.cardSubtitle}>For: {item.class_group} | Subject: {item.subject}</Text>
                        </View>
                        <View style={styles.actionIcons}>
                            <TouchableOpacity onPress={() => openModal(item)} style={styles.iconBtn}><MaterialIcons name="edit" size={20} color={COLORS.blue} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.iconBtn, {backgroundColor: '#fee2e2'}]}><MaterialIcons name="delete" size={20} color={COLORS.danger} /></TouchableOpacity>
                        </View>
                    </View>
                    
                    <Text style={styles.cardDescription} numberOfLines={3}>{item.description || 'No description provided.'}</Text>
                    
                    <View style={styles.buttonContainer}>
                        {item.file_path && (
                            <TouchableOpacity 
                                style={styles.viewButton} 
                                onPress={() => Linking.openURL(`${SERVER_URL}${item.file_path}`)}
                            >
                                <MaterialIcons name="cloud-download" size={18} color="#fff" />
                                <Text style={styles.viewButtonText}>Download File</Text>
                            </TouchableOpacity>
                        )}
                        {item.external_link && (
                            <TouchableOpacity 
                                style={[styles.viewButton, styles.linkButton]} 
                                onPress={() => Linking.openURL(item.external_link)}
                            >
                                <MaterialIcons name="open-in-new" size={18} color="#fff" />
                                <Text style={styles.viewButtonText}>Open Link</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Animatable.View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="book-education-outline" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Study Materials</Text>
                        <Text style={styles.headerSubtitle}>Manage Resources</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={() => openModal(null)}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={materials}
                keyExtractor={(item) => item.material_id.toString()}
                renderItem={renderItem}
                onRefresh={fetchMaterials}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading && <Text style={styles.emptyText}>You haven't uploaded any materials yet.</Text>}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            />
            
            {/* --- MODAL --- */}
            {isModalVisible && <MaterialFormModal material={editingMaterial} onClose={() => setIsModalVisible(false)} onSave={fetchMaterials} />}
        </SafeAreaView>
    );
};

// --- Modal Form Component ---
const MaterialFormModal = ({ material, onClose, onSave }) => {
    const { user } = useAuth();
    const isEditMode = !!material;
    const [title, setTitle] = useState(isEditMode ? material.title : '');
    const [description, setDescription] = useState(isEditMode ? material.description : '');
    const [subject, setSubject] = useState(isEditMode ? material.subject : '');
    const [classGroup, setClassGroup] = useState(isEditMode ? material.class_group : '');
    const [materialType, setMaterialType] = useState(isEditMode ? material.material_type : 'Notes');
    const [externalLink, setExternalLink] = useState(isEditMode ? material.external_link || '' : '');
    const [file, setFile] = useState(null);
    const [studentClasses, setStudentClasses] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchClasses = async () => { try { 
            const response = await apiClient.get('/student-classes');
            setStudentClasses(response.data); 
        } catch (e) { console.error(e); }};
        fetchClasses();
    }, []);

    const handleFilePick = async () => {
        try {
            const result = await pick({ type: [types.allFiles], allowMultiSelection: false });
            if (result && result.length > 0) {
                setFile(result[0]);
            }
        } catch (err) {
            if (isCancel(err)) { console.log('User cancelled file selection.'); } 
            else { Alert.alert("Error", "An unknown error occurred while picking the file."); console.error(err); }
        }
    };

    const handleSave = async () => {
        if (!title || !classGroup) return Alert.alert("Validation Error", "Title and Class are required.");
        setIsSaving(true);
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('class_group', classGroup);
        formData.append('subject', subject);
        formData.append('material_type', materialType);
        formData.append('external_link', externalLink);
        formData.append('uploaded_by', user.id.toString());

        if (file) {
            formData.append('materialFile', {
                uri: file.uri,
                type: file.type,
                name: file.name,
            });
        } else if (isEditMode && material.file_path) {
            formData.append('existing_file_path', material.file_path);
        }
        
        try {
            if (isEditMode) {
                await apiClient.put(`/study-materials/${material.material_id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                await apiClient.post('/study-materials', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            Alert.alert("Success", `Material ${isEditMode ? 'updated' : 'uploaded'} successfully.`);
            onSave();
            onClose();
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Save failed.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal visible={true} onRequestClose={onClose} animationType="slide">
            <View style={styles.modalBackground}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{isEditMode ? 'Edit Material' : 'New Material'}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                    
                    <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                        <Text style={styles.label}>Title *</Text>
                        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Chapter 1 Notes" />
                        
                        <Text style={styles.label}>Subject</Text>
                        <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="e.g. Science" />
                        
                        <Text style={styles.label}>Class *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={classGroup} onValueChange={setClassGroup}>
                                <Picker.Item label="-- Select Class --" value="" />
                                {studentClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                            </Picker>
                        </View>
                        
                        <Text style={styles.label}>Type *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={materialType} onValueChange={setMaterialType}>
                                {['Notes', 'Presentation', 'Video Lecture', 'Worksheet', 'Link', 'Other'].map(t => <Picker.Item key={t} label={t} value={t} />)}
                            </Picker>
                        </View>
                        
                        <Text style={styles.label}>External Link (Optional)</Text>
                        <TextInput style={styles.input} value={externalLink} onChangeText={setExternalLink} keyboardType="url" placeholder="https://..." />
                        
                        <Text style={styles.label}>File Upload</Text>
                        <TouchableOpacity style={styles.uploadButton} onPress={handleFilePick}>
                            <MaterialIcons name="attach-file" size={20} color="#fff" />
                            <Text style={styles.uploadButtonText} numberOfLines={1}>
                                {file ? file.name : (material?.file_path?.split('/').pop() || 'Select File')}
                            </Text>
                        </TouchableOpacity>
                        
                        <Text style={styles.label}>Description</Text>
                        <TextInput style={[styles.input, styles.textarea]} multiline value={description} onChangeText={setDescription} placeholder="Details..." />
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={onClose}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.createBtn]} onPress={handleSave} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
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

    // --- CARDS ---
    card: { backgroundColor: COLORS.cardBg, borderRadius: 12, marginBottom: 15, padding: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    actionIcons: { flexDirection: 'row', gap: 10 },
    iconBtn: { padding: 6, backgroundColor: '#e0f2f1', borderRadius: 8 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 4 },
    cardSubtitle: { fontSize: 13, color: COLORS.textSub, marginBottom: 8, fontWeight: '500' },
    cardDescription: { fontSize: 14, color: '#455a64', marginBottom: 15, lineHeight: 20 },
    
    buttonContainer: { flexDirection: 'row', gap: 10, marginTop: 5 },
    viewButton: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.blue, paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    linkButton: { backgroundColor: '#8E24AA' },
    viewButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 6, fontSize: 13 },

    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: COLORS.textSub },
    
    // --- MODAL ---
    modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
    
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textSub, marginBottom: 5, marginTop: 10 },
    input: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 15, color: COLORS.textMain },
    textarea: { height: 80, textAlignVertical: 'top' },
    pickerContainer: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: '#F9F9F9', marginBottom: 5 },
    
    uploadButton: { flexDirection: 'row', backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
    uploadButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 14 },
    
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
    createBtn: { backgroundColor: COLORS.success },
    cancelBtn: { backgroundColor: '#e0e0e0' },
    modalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    cancelBtnText: { color: '#333', fontWeight: 'bold', fontSize: 15 },
});

export default TeacherAdminMaterialsScreen;