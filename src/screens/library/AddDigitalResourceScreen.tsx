import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Alert, ActivityIndicator, ScrollView, Image, Platform, KeyboardAvoidingView
} from 'react-native';
import { pick, types, isCancel } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig'; // To show existing images
import { useNavigation, useRoute } from '@react-navigation/native';

const AddDigitalResourceScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const isEditMode = route.params?.resource ? true : false;
    const existingResource = route.params?.resource || {};

    const [loading, setLoading] = useState(false);
    
    // Form Data
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        book_no: '',
        category: '',
        publisher: ''
    });

    const [file, setFile] = useState(null);
    const [coverImage, setCoverImage] = useState(null);

    // Populate data if Edit Mode
    useEffect(() => {
        if (isEditMode) {
            setFormData({
                title: existingResource.title || '',
                author: existingResource.author || '',
                book_no: existingResource.book_no || '',
                category: existingResource.category || '',
                publisher: existingResource.publisher || ''
            });
            navigation.setOptions({ title: 'Edit Resource' });
        }
    }, [isEditMode]);

    const handleUpload = async () => {
        if (!formData.title || !formData.author) {
            Alert.alert("Missing Fields", "Title and Author are required.");
            return;
        }
        
        // If Adding: File is required. If Editing: File is optional.
        if (!isEditMode && !file) {
            Alert.alert("Missing File", "Please select a document to upload.");
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            
            data.append('title', formData.title);
            data.append('author', formData.author);
            data.append('book_no', formData.book_no);
            data.append('category', formData.category);
            data.append('publisher', formData.publisher);
            
            // Only append file/cover if new ones are selected
            if (file) {
                data.append('file', {
                    uri: file.uri,
                    type: file.type || 'application/pdf',
                    name: file.name || `doc_${Date.now()}.pdf`,
                });
            }

            if (coverImage) {
                const imageUri = Platform.OS === 'android' ? coverImage.uri : coverImage.uri.replace('file://', '');
                data.append('cover_image', {
                    uri: imageUri,
                    type: coverImage.type || 'image/jpeg',
                    name: coverImage.fileName,
                });
            }

            if (isEditMode) {
                // PUT Request
                await apiClient.put(`/library/digital/${existingResource.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                Alert.alert("Success", "Resource updated!", [{ text: "OK", onPress: () => navigation.navigate('DigitalLibraryScreen') }]);
            } else {
                // POST Request
                await apiClient.post('/library/digital', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                Alert.alert("Success", "Resource uploaded!", [{ text: "OK", onPress: () => navigation.goBack() }]);
            }

        } catch (error) {
            console.error("Error:", error);
            Alert.alert("Error", "Operation failed.");
        } finally {
            setLoading(false);
        }
    };

    // Pickers
    const pickCover = async () => {
        try {
            const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
            if (result.assets?.length > 0) setCoverImage(result.assets[0]);
        } catch (error) {}
    };

    const selectFile = async () => {
        try {
            const result = await pick({ allowMultiSelection: false, type: [types.pdf, types.doc, types.images] });
            if (result?.length > 0) setFile(result[0]);
        } catch (err) { if (!isCancel(err)) Alert.alert("Error", "File selection failed"); }
    };

    // Determine current cover URL for preview in edit mode
    const currentCoverUrl = coverImage ? coverImage.uri : (isEditMode && existingResource.cover_image_url ? `${SERVER_URL}${existingResource.cover_image_url}` : null);

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.header}>{isEditMode ? "Edit Resource" : "Upload Resource"}</Text>

                <TouchableOpacity style={styles.coverPicker} onPress={pickCover}>
                    {currentCoverUrl ? (
                        <Image source={{ uri: currentCoverUrl }} style={styles.previewImage} resizeMode="cover" />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.cameraIcon}>📷</Text>
                            <Text style={styles.placeholderText}>Cover Image</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={styles.card}>
                    <InputGroup label="Title *" value={formData.title} onChangeText={t => setFormData({...formData, title: t})} />
                    <InputGroup label="Author *" value={formData.author} onChangeText={t => setFormData({...formData, author: t})} />
                    
                    <View style={styles.row}>
                        <InputGroup containerStyle={{flex:1, marginRight:10}} label="Book No" value={formData.book_no} onChangeText={t => setFormData({...formData, book_no: t})} />
                        <InputGroup containerStyle={{flex:1}} label="Category" value={formData.category} onChangeText={t => setFormData({...formData, category: t})} />
                    </View>

                    <InputGroup label="Publisher" value={formData.publisher} onChangeText={t => setFormData({...formData, publisher: t})} />

                    <View style={styles.fileSection}>
                        <Text style={styles.label}>{isEditMode ? "Update Document (Optional)" : "Document *"}</Text>
                        <TouchableOpacity style={[styles.fileButton, file && styles.fileSelected]} onPress={selectFile}>
                            <Text style={[styles.fileButtonText, file && styles.fileSelectedText]}>
                                {file ? `📄 ${file.name}` : (isEditMode ? "📎 Change File (Tap here)" : "📎 Select PDF / Doc")}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity style={[styles.uploadButton, loading && styles.disabled]} onPress={handleUpload} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>{isEditMode ? "Update" : "Upload"}</Text>}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const InputGroup = ({ label, value, onChangeText, containerStyle }) => (
    <View style={[styles.formGroup, containerStyle]}>
        <Text style={styles.label}>{label}</Text>
        <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholderTextColor="#94A3B8" />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { padding: 20 },
    header: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
    coverPicker: { height: 160, width: 120, backgroundColor: '#E2E8F0', borderRadius: 12, marginBottom: 20, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { alignItems: 'center' },
    cameraIcon: { fontSize: 28, color: '#64748B' },
    placeholderText: { fontSize: 10, color: '#64748B' },
    card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
    formGroup: { marginBottom: 15 },
    row: { flexDirection: 'row' },
    label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 5 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, color: '#1E293B' },
    fileSection: { marginTop: 5 },
    fileButton: { backgroundColor: '#F0F9FF', padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#BAE6FD', borderStyle: 'dashed' },
    fileButtonText: { color: '#0284C7', fontWeight: '600' },
    fileSelected: { backgroundColor: '#E0F2FE', borderStyle: 'solid' },
    fileSelectedText: { color: '#0369A1' },
    uploadButton: { backgroundColor: '#2563EB', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 25 },
    disabled: { backgroundColor: '#94A3B8' },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default AddDigitalResourceScreen;