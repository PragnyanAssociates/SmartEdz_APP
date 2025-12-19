import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Alert, ActivityIndicator, ScrollView, Image, Platform, KeyboardAvoidingView
} from 'react-native';
import { pick, types, isCancel } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';

const AddDigitalResourceScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    
    // Files
    const [file, setFile] = useState(null);
    const [coverImage, setCoverImage] = useState(null);

    // Form Data (Updated Fields)
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        book_no: '',
        category: '',
        publisher: ''
    });

    const handleInput = (key, value) => {
        setFormData({ ...formData, [key]: value });
    };

    // Pick Cover
    const pickCover = async () => {
        try {
            const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
            if (result.assets && result.assets.length > 0) setCoverImage(result.assets[0]);
        } catch (error) { Alert.alert("Error", "Could not open gallery."); }
    };

    // Pick Document
    const selectFile = async () => {
        try {
            const result = await pick({
                allowMultiSelection: false,
                type: [types.pdf, types.doc, types.docx, types.ppt, types.pptx, types.images], 
            });
            if (result && result.length > 0) setFile(result[0]);
        } catch (err) {
            if (!isCancel(err)) Alert.alert("Error", "Could not select file.");
        }
    };

    // Upload
    const handleUpload = async () => {
        if (!formData.title || !formData.author || !file) {
            Alert.alert("Missing Fields", "Title, Author, and Document are required.");
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            
            // Append Text Fields
            data.append('title', formData.title);
            data.append('author', formData.author);
            data.append('book_no', formData.book_no);
            data.append('category', formData.category);
            data.append('publisher', formData.publisher);
            
            // Append Doc
            data.append('file', {
                uri: file.uri,
                type: file.type || 'application/pdf',
                name: file.name || `doc_${Date.now()}.pdf`,
            });

            // Append Cover
            if (coverImage) {
                const imageUri = Platform.OS === 'android' ? coverImage.uri : coverImage.uri.replace('file://', '');
                data.append('cover_image', {
                    uri: imageUri,
                    type: coverImage.type || 'image/jpeg',
                    name: coverImage.fileName,
                });
            }

            await apiClient.post('/library/digital', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            Alert.alert("Success", "Uploaded successfully!", [{ text: "OK", onPress: () => navigation.goBack() }]);
        } catch (error) {
            console.error("Upload Error:", error);
            Alert.alert("Error", "Upload failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                <Text style={styles.header}>Upload Digital Resource</Text>

                {/* Cover Picker */}
                <TouchableOpacity style={styles.coverPicker} onPress={pickCover}>
                    {coverImage ? (
                        <Image source={{ uri: coverImage.uri }} style={styles.previewImage} resizeMode="cover" />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.cameraIcon}>📷</Text>
                            <Text style={styles.placeholderText}>Add Cover (Optional)</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Form Fields */}
                <View style={styles.card}>
                    <InputGroup label="Title *" placeholder="e.g. Physics Notes" value={formData.title} onChangeText={t => handleInput('title', t)} />
                    
                    <InputGroup label="Author *" placeholder="e.g. H.C. Verma" value={formData.author} onChangeText={t => handleInput('author', t)} />
                    
                    <View style={styles.row}>
                        <InputGroup containerStyle={{flex:1, marginRight:10}} label="Book No." placeholder="e.g. BK-100" value={formData.book_no} onChangeText={t => handleInput('book_no', t)} />
                        <InputGroup containerStyle={{flex:1}} label="Category" placeholder="e.g. Science" value={formData.category} onChangeText={t => handleInput('category', t)} />
                    </View>

                    <InputGroup label="Publisher" placeholder="e.g. Bharati Bhawan" value={formData.publisher} onChangeText={t => handleInput('publisher', t)} />

                    {/* File Picker */}
                    <View style={styles.fileSection}>
                        <Text style={styles.label}>Document *</Text>
                        <TouchableOpacity style={[styles.fileButton, file && styles.fileSelected]} onPress={selectFile}>
                            <Text style={[styles.fileButtonText, file && styles.fileSelectedText]}>
                                {file ? `📄 ${file.name}` : "📎 Select PDF / Doc"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Submit */}
                <TouchableOpacity style={[styles.uploadButton, loading && styles.disabled]} onPress={handleUpload} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Upload Resource</Text>}
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
};

// Helper Component for inputs
const InputGroup = ({ label, placeholder, value, onChangeText, containerStyle }) => (
    <View style={[styles.formGroup, containerStyle]}>
        <Text style={styles.label}>{label}</Text>
        <TextInput 
            style={styles.input} 
            placeholder={placeholder} 
            placeholderTextColor="#94A3B8"
            value={value} 
            onChangeText={onChangeText}
        />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { padding: 20, paddingBottom: 50 },
    header: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
    coverPicker: { height: 160, width: 120, backgroundColor: '#E2E8F0', borderRadius: 12, marginBottom: 20, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed' },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { alignItems: 'center' },
    cameraIcon: { fontSize: 28, marginBottom: 5, color: '#64748B' },
    placeholderText: { fontSize: 10, color: '#64748B', textAlign: 'center' },
    card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 2 },
    formGroup: { marginBottom: 15 },
    row: { flexDirection: 'row' },
    label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 15, color: '#1E293B' },
    fileSection: { marginTop: 5 },
    fileButton: { backgroundColor: '#F0F9FF', padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#BAE6FD', borderStyle: 'dashed' },
    fileButtonText: { color: '#0284C7', fontWeight: '600', fontSize: 14 },
    fileSelected: { backgroundColor: '#E0F2FE', borderStyle: 'solid' },
    fileSelectedText: { color: '#0369A1' },
    uploadButton: { backgroundColor: '#2563EB', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 25, elevation: 3 },
    disabled: { backgroundColor: '#94A3B8' },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default AddDigitalResourceScreen;