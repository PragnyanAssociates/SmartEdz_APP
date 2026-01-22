// 📂 File: src/screens/labs/TeacherAdminLabsScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, ScrollView, Platform, SafeAreaView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import { pick, types, isCancel } from '@react-native-documents/picker';
import { LabCard, Lab } from './LabCard';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

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

const TeacherAdminLabsScreen = () => {
    const { user } = useAuth();
    const [labs, setLabs] = useState<Lab[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLab, setEditingLab] = useState<Lab | null>(null);
    
    // --- STATE MANAGEMENT ---
    const initialFormState = { 
        title: '', subject: '', lab_type: '', description: '', access_url: '',
        topic: '', video_url: '', meet_link: '',
    };
    const [formData, setFormData] = useState(initialFormState);
    const [scheduleDate, setScheduleDate] = useState<Date | null>(null);

    const [selectedImage, setSelectedImage] = useState<ImagePickerResponse | null>(null);
    const [selectedFile, setSelectedFile] = useState<any | null>(null);
    const [studentClasses, setStudentClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [showPicker, setShowPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

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

    // --- DATETIME LOGIC ---
    const showMode = (currentMode: 'date' | 'time') => {
        setShowPicker(true);
        setPickerMode(currentMode);
    };
    
    const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowPicker(Platform.OS === 'ios'); 

        if (event.type === 'set' && selectedDate) {
            const currentDate = selectedDate;
            if (Platform.OS === 'android' && pickerMode === 'date') {
                setScheduleDate(currentDate); 
                showMode('time'); 
            } else {
                setScheduleDate(currentDate);
            }
        }
    };

    const clearDateTime = () => {
        setScheduleDate(null);
    };
    
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
            setScheduleDate(lab.class_datetime ? new Date(lab.class_datetime) : null);
            setFormData({ 
                title: lab.title, 
                subject: lab.subject, 
                lab_type: lab.lab_type, 
                description: lab.description, 
                access_url: lab.access_url || '',
                topic: lab.topic || '',
                video_url: lab.video_url || '',
                meet_link: lab.meet_link || '',
            });
            setSelectedClass(lab.class_group || '');
        } else {
            setScheduleDate(null);
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
        Object.keys(formData).forEach(key => {
            const value = formData[key as keyof typeof formData];
            if (value) { data.append(key, value); }
        });

        if (scheduleDate) {
            const pad = (num: number) => num.toString().padStart(2, '0');
            const formattedDateTime = `${scheduleDate.getFullYear()}-${pad(scheduleDate.getMonth() + 1)}-${pad(scheduleDate.getDate())} ${pad(scheduleDate.getHours())}:${pad(scheduleDate.getMinutes())}:00`;
            data.append('class_datetime', formattedDateTime);
        }

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
        return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="flask" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Digital Labs</Text>
                        <Text style={styles.headerSubtitle}>Manage Resources</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={() => handleOpenModal(null)}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={labs}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => <LabCard lab={item} onEdit={handleOpenModal} onDelete={handleDelete} />}
                ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>No labs created yet.</Text></View>}
                contentContainerStyle={{ paddingBottom: 20 }}
            />

            {/* --- MODAL --- */}
            <Modal visible={isModalOpen} onRequestClose={() => setIsModalOpen(false)} animationType="slide">
                <View style={styles.modalBackground}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingLab ? 'Edit Lab' : 'New Lab'}</Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                                <MaterialIcons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                            <Text style={styles.label}>Assign to Class</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={selectedClass} onValueChange={(itemValue) => setSelectedClass(itemValue)}>
                                    <Picker.Item label="All Classes" value="" color="#555"/>
                                    {studentClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Title*</Text>
                            <TextInput style={styles.input} placeholder="e.g., Chemistry Basics" value={formData.title} onChangeText={t => setFormData({...formData, title: t})} />
                            
                            <Text style={styles.label}>Subject*</Text>
                            <TextInput style={styles.input} placeholder="e.g., Science" value={formData.subject} onChangeText={t => setFormData({...formData, subject: t})} />
                            
                            <Text style={styles.label}>Type</Text>
                            <TextInput style={styles.input} placeholder="e.g., Video, PDF" value={formData.lab_type} onChangeText={t => setFormData({...formData, lab_type: t})} />
                            
                            <Text style={styles.label}>Topic</Text>
                            <TextInput style={styles.input} placeholder="e.g., Titration" value={formData.topic} onChangeText={t => setFormData({...formData, topic: t})} />

                            <Text style={styles.label}>Description*</Text>
                            <TextInput style={[styles.input, styles.textarea]} placeholder="Instructions..." value={formData.description} onChangeText={t => setFormData({...formData, description: t})} multiline />
                            
                            <Text style={styles.label}>Scheduled Time</Text>
                            <View style={styles.datePickerContainer}>
                                <TouchableOpacity style={styles.datePickerButton} onPress={() => showMode('date')}>
                                    <MaterialIcons name="event" size={20} color={COLORS.primary} style={{marginRight: 10}}/>
                                    <Text style={styles.datePickerText}>
                                        {scheduleDate ? scheduleDate.toLocaleString() : 'Select Date & Time'}
                                    </Text>
                                </TouchableOpacity>
                                {scheduleDate && (
                                    <TouchableOpacity style={styles.clearDateButton} onPress={clearDateTime}>
                                        <MaterialIcons name="clear" size={20} color="#666" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {showPicker && (
                                <DateTimePicker
                                    testID="dateTimePicker"
                                    value={scheduleDate || new Date()}
                                    mode={pickerMode}
                                    is24Hour={true}
                                    display="default"
                                    onChange={handleDateChange}
                                />
                            )}

                            <TouchableOpacity style={styles.uploadButton} onPress={handleChoosePhoto}>
                                <MaterialIcons name="image" size={20} color="#fff" />
                                <Text style={styles.uploadButtonText}>{editingLab?.cover_image_url || selectedImage ? 'Change Cover' : 'Select Cover'}</Text>
                            </TouchableOpacity>
                            {selectedImage?.assets?.[0]?.uri && <Text style={styles.fileNameText}>{selectedImage.assets[0].fileName}</Text>}
                            
                            <View style={styles.divider} />
                            <Text style={styles.sectionHeader}>Links & Files</Text>
                            
                            <TextInput style={styles.input} placeholder="Access URL (https://...)" value={formData.access_url} onChangeText={t => setFormData({...formData, access_url: t})} keyboardType="url" />
                            <TextInput style={styles.input} placeholder="Video URL (Youtube...)" value={formData.video_url} onChangeText={t => setFormData({...formData, video_url: t})} keyboardType="url" />
                            <TextInput style={styles.input} placeholder="Meet Link (Google Meet...)" value={formData.meet_link} onChangeText={t => setFormData({...formData, meet_link: t})} keyboardType="url" />
                            
                            <TouchableOpacity style={[styles.uploadButton, {backgroundColor: COLORS.blue}]} onPress={handleChooseFile}>
                                <MaterialIcons name="attach-file" size={20} color="#fff" />
                                <Text style={styles.uploadButtonText}>{editingLab?.file_path || selectedFile ? 'Change File' : 'Upload File'}</Text>
                            </TouchableOpacity>
                            {selectedFile?.name && <Text style={styles.fileNameText}>{selectedFile.name}</Text>}

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalOpen(false)}>
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}>
                                    <Text style={styles.saveButtonText}>Save Lab</Text>
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
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    
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

    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: COLORS.textSub },

    // --- MODAL STYLES ---
    modalBackground: { flex: 1, backgroundColor: '#fff' }, // Full screen modal bg
    modalContent: { flex: 1, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain },
    
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textSub, marginBottom: 5, marginTop: 10 },
    input: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.textMain },
    textarea: { height: 100, textAlignVertical: 'top' },
    pickerContainer: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: '#F9F9F9', marginBottom: 5 },
    
    uploadButton: { flexDirection: 'row', backgroundColor: COLORS.primary, padding: 14, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    uploadButtonText: { color: '#fff', marginLeft: 10, fontWeight: 'bold', fontSize: 15 },
    fileNameText: { textAlign: 'center', marginTop: 5, color: COLORS.textSub, fontSize: 12, fontStyle: 'italic' },
    
    sectionHeader: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginTop: 20, marginBottom: 10, textAlign: 'center' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 15 },

    datePickerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    datePickerButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12 },
    datePickerText: { fontSize: 15, color: COLORS.textMain },
    clearDateButton: { padding: 10, marginLeft: 5 },

    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 20 },
    modalButton: { paddingVertical: 12, borderRadius: 8, flex: 0.48, alignItems: 'center', elevation: 2 },
    cancelButton: { backgroundColor: '#e0e0e0' },
    cancelButtonText: { color: '#333', fontWeight: 'bold', fontSize: 16 },
    saveButton: { backgroundColor: COLORS.primary },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default TeacherAdminLabsScreen;