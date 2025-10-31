// 📂 File: src/screens/labs/TeacherAdminLabsScreen.tsx (REPLACE THIS FILE)

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import { pick, types, isCancel } from '@react-native-documents/picker';
import { LabCard, Lab } from './LabCard';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { Picker } from '@react-native-picker/picker';

const TeacherAdminLabsScreen = () => {
    const { user } = useAuth();
    const [labs, setLabs] = useState<Lab[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLab, setEditingLab] = useState<Lab | null>(null);
    
    // Updated initial state with all new fields
    const initialFormState = { 
        title: '', subject: '', lab_type: '', description: '', access_url: '',
        topic: '', video_url: '', meet_link: '', class_datetime: '',
    };
    const [formData, setFormData] = useState(initialFormState);
    const [selectedImage, setSelectedImage] = useState<ImagePickerResponse | null>(null);
    const [selectedFile, setSelectedFile] = useState<any | null>(null);

    const [studentClasses, setStudentClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');

    const fetchLabs = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/labs/teacher/${user.id}`);
            setLabs(response.data);
        } catch (e: any) { Alert.alert("Error", e.response?.data?.message || 'Failed to fetch labs'); } 
        finally { setIsLoading(false); }
    }, [user]);

    const fetchStudentClasses = async () => {
        try {
            const response = await apiClient.get('/student-classes');
            setStudentClasses(response.data);
        } catch (e) {
            console.error("Error fetching student classes:", e);
        }
    };

    useEffect(() => { 
        fetchLabs();
        fetchStudentClasses();
    }, [fetchLabs]);

    const handleChoosePhoto = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, (response) => {
            if (response.didCancel) return;
            if (response.errorCode) return Alert.alert("Image Error", response.errorMessage);
            setSelectedImage(response);
        });
    };

    const handleChooseFile = async () => {
        try {
            const result = await pick({ type: [types.allFiles], allowMultiSelection: false });
            if (result && result.length > 0) { setSelectedFile(result[0]); }
        } catch (err) {
            if (!isCancel(err)) { Alert.alert('Error', 'An unknown error occurred.'); }
        }
    };

    const handleOpenModal = (lab: Lab | null = null) => {
        setEditingLab(lab);
        if (lab) {
            setFormData({ 
                title: lab.title, 
                subject: lab.subject, 
                lab_type: lab.lab_type, 
                description: lab.description, 
                access_url: lab.access_url || '',
                topic: lab.topic || '',
                video_url: lab.video_url || '',
                meet_link: lab.meet_link || '',
                class_datetime: lab.class_datetime ? new Date(lab.class_datetime).toISOString().slice(0, 16) : ''
            });
            setSelectedClass(lab.class_group || '');
        } else {
            setFormData(initialFormState);
            setSelectedClass('');
        }
        setSelectedImage(null); setSelectedFile(null); setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.description || !formData.subject) {
            return Alert.alert("Validation Error", "Title, Subject, and Description are required.");
        }
        
        const data = new FormData();
        // Append all form data fields
        Object.keys(formData).forEach(key => {
            if (formData[key]) { // Only append if value is not empty
                data.append(key, formData[key]);
            }
        });

        if (user) data.append('created_by', user.id.toString());
        data.append('class_group', selectedClass);

        if (selectedImage?.assets?.[0]) {
            data.append('coverImage', { uri: selectedImage.assets[0].uri, type: selectedImage.assets[0].type, name: selectedImage.assets[0].fileName });
        }
        if (selectedFile) {
            data.append('labFile', { uri: selectedFile.uri, type: selectedFile.type, name: selectedFile.name });
        }
        
        try {
            const config = { headers: { 'Content-Type': 'multipart/form-data' } };
            if (editingLab) {
                await apiClient.put(`/labs/${editingLab.id}`, data, config);
            } else {
                await apiClient.post('/labs', data, config);
            }
            Alert.alert("Success", `Lab ${editingLab ? 'updated' : 'created'} successfully!`);
            setIsModalOpen(false);
            fetchLabs();
        } catch (error: any) { Alert.alert("Save Error", error.response?.data?.message || 'An unknown error occurred.'); }
    };

    const handleDelete = async (id: number) => {
        Alert.alert("Confirm Deletion", "Are you sure you want to delete this lab?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/labs/${id}`);
                    Alert.alert("Success", "Lab deleted.");
                    fetchLabs();
                } catch (e: any) { Alert.alert("Error", e.response?.data?.message || "Failed to delete lab."); }
            }}
        ]);
    };

    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#008080" /></View>;
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={labs}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => <LabCard lab={item} onEdit={handleOpenModal} onDelete={handleDelete} />}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <MaterialIcons name="science" size={30} color="#00695c" />
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Manage Digital Labs</Text>
                            <Text style={styles.headerSubtitle}>Add, edit, or remove learning resources.</Text>
                        </View>
                    </View>
                }
                ListFooterComponent={ <TouchableOpacity style={styles.addButton} onPress={() => handleOpenModal(null)}><MaterialIcons name="add" size={24} color="#fff" /><Text style={styles.addButtonText}>Add New Digital Lab</Text></TouchableOpacity> }
                ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>No labs created yet. Tap the button below to add one.</Text></View>}
                contentContainerStyle={{ flexGrow: 1 }}
            />
            <Modal visible={isModalOpen} onRequestClose={() => setIsModalOpen(false)} animationType="slide">
                <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: 40 }}>
                    <Text style={styles.modalTitle}>{editingLab ? 'Edit Digital Lab' : 'Add New Digital Lab'}</Text>
                    
                    <Text style={styles.label}>Assign to Class</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={selectedClass} onValueChange={(itemValue) => setSelectedClass(itemValue)}>
                            <Picker.Item label="All Classes" value="" />
                            {studentClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>

                    <Text style={styles.label}>Title*</Text>
                    <TextInput style={styles.input} placeholder="e.g., Virtual Chemistry Lab" value={formData.title} onChangeText={t => setFormData({...formData, title: t})} />
                    
                    <Text style={styles.label}>Subject*</Text>
                    <TextInput style={styles.input} placeholder="e.g., Science" value={formData.subject} onChangeText={t => setFormData({...formData, subject: t})} />
                    
                    <Text style={styles.label}>Type</Text>
                    <TextInput style={styles.input} placeholder="e.g., Simulation, PDF, Video" value={formData.lab_type} onChangeText={t => setFormData({...formData, lab_type: t})} />
                    
                    <Text style={styles.label}>Topic</Text>
                    <TextInput style={styles.input} placeholder="e.g., Titration Experiment (Optional)" value={formData.topic} onChangeText={t => setFormData({...formData, topic: t})} />

                    <Text style={styles.label}>Description*</Text>
                    <TextInput style={styles.textarea} placeholder="Detailed instructions for the lab..." value={formData.description} onChangeText={t => setFormData({...formData, description: t})} multiline />
                    
                    <Text style={styles.label}>Scheduled Time (Optional)</Text>
                    <TextInput style={styles.input} placeholder="YYYY-MM-DDTHH:mm" value={formData.class_datetime} onChangeText={t => setFormData({...formData, class_datetime: t})} />

                    <TouchableOpacity style={styles.uploadButton} onPress={handleChoosePhoto}><MaterialIcons name="image" size={20} color="#fff" /><Text style={styles.uploadButtonText}>{editingLab?.cover_image_url || selectedImage ? 'Change Cover Image' : 'Select Cover Image'}</Text></TouchableOpacity>
                    {selectedImage?.assets?.[0]?.uri && <Text style={styles.fileNameText}>Selected: {selectedImage.assets[0].fileName}</Text>}
                    
                    <Text style={styles.orText}>- Lab Access Methods -</Text>
                    
                    <Text style={styles.label}>Access URL (Optional)</Text>
                    <TextInput style={styles.input} placeholder="https://..." value={formData.access_url} onChangeText={t => setFormData({...formData, access_url: t})} keyboardType="url" />

                    <Text style={styles.label}>Video URL (Optional)</Text>
                    <TextInput style={styles.input} placeholder="https://youtube.com/..." value={formData.video_url} onChangeText={t => setFormData({...formData, video_url: t})} keyboardType="url" />

                    <Text style={styles.label}>Meet Link (Optional)</Text>
                    <TextInput style={styles.input} placeholder="https://meet.google.com/..." value={formData.meet_link} onChangeText={t => setFormData({...formData, meet_link: t})} keyboardType="url" />
                    
                    <TouchableOpacity style={[styles.uploadButton, {backgroundColor: '#5cb85c'}]} onPress={handleChooseFile}><MaterialIcons name="attach-file" size={20} color="#fff" /><Text style={styles.uploadButtonText}>{editingLab?.file_path || selectedFile ? 'Change Lab File' : 'Upload Lab File (PDF, etc.)'}</Text></TouchableOpacity>
                    {selectedFile?.name && <Text style={styles.fileNameText}>Selected: {selectedFile.name}</Text>}
                    {editingLab?.file_path && !selectedFile && <Text style={styles.fileNameText}>Current file: {editingLab.file_path.split('/').pop()}</Text>}

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalOpen(false)}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}><Text style={styles.saveButtonText}>Save Lab</Text></TouchableOpacity>
                    </View>
                </ScrollView>
            </Modal>
        </View>
    );
};

// Add new styles for labels etc.
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    header: { padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center' },
    headerTextContainer: { marginLeft: 15 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#004d40' },
    headerSubtitle: { fontSize: 15, color: '#37474f', marginTop: 4 },
    emptyText: { textAlign: 'center', marginVertical: 40, fontSize: 16, color: '#555' },
    addButton: { flexDirection: 'row', backgroundColor: '#00796b', padding: 15, margin: 20, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
    modalContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#f5f5f5' },
    modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 25, textAlign: 'center', color: '#333' },
    label: { fontSize: 16, fontWeight: '600', color: '#444', marginBottom: 8, marginLeft: 2 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
    textarea: { height: 120, textAlignVertical: 'top', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
    uploadButton: { flexDirection: 'row', backgroundColor: '#1e88e5', padding: 14, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    uploadButtonText: { color: '#fff', marginLeft: 10, fontWeight: 'bold', fontSize: 16 },
    fileNameText: { textAlign: 'center', marginBottom: 15, marginTop: 5, color: '#333', fontStyle: 'italic' },
    orText: { textAlign: 'center', marginVertical: 15, fontSize: 16, color: '#777', fontWeight: 'bold' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 },
    modalButton: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, flex: 0.45, alignItems: 'center' },
    cancelButton: { backgroundColor: '#e0e0e0' },
    cancelButtonText: { color: '#333', fontWeight: 'bold', fontSize: 16 },
    saveButton: { backgroundColor: '#00796b' },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: '#fff' },
});

export default TeacherAdminLabsScreen;