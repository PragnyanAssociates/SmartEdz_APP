import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    ScrollView,
    Image,
    Platform,
    KeyboardAvoidingView
} from 'react-native';

// 1. Document Picker (Your preferred package)
import { pick, types, isCancel } from '@react-native-documents/picker';

// 2. Image Picker (For Cover Image)
import { launchImageLibrary } from 'react-native-image-picker';

import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';

const AddDigitalResourceScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    
    // State for Files
    const [file, setFile] = useState(null);       // The PDF/Doc
    const [coverImage, setCoverImage] = useState(null); // The Cover Image

    // Form Data
    const [formData, setFormData] = useState({
        title: '',
        subject: '',
        class_group: ''
    });

    // --- 1. Pick Cover Image (Optional) ---
    const pickCover = async () => {
        const options = {
            mediaType: 'photo',
            quality: 0.8,
            selectionLimit: 1,
        };

        try {
            const result = await launchImageLibrary(options);
            if (result.assets && result.assets.length > 0) {
                setCoverImage(result.assets[0]);
            }
        } catch (error) {
            Alert.alert("Error", "Could not open gallery.");
        }
    };

    // --- 2. Pick Document (PDF/Docs) ---
    const selectFile = async () => {
        try {
            const result = await pick({
                allowMultiSelection: false,
                // Allow PDF and Common Office Docs
                type: [types.pdf, types.doc, types.docx, types.ppt, types.pptx, types.images], 
            });

            if (result && result.length > 0) {
                setFile(result[0]);
            }
        } catch (err) {
            if (isCancel(err)) {
                console.log('User cancelled document selection');
            } else {
                console.error("File selection error:", err);
                Alert.alert("Error", "Could not select file.");
            }
        }
    };

    // --- 3. Upload Function ---
    const handleUpload = async () => {
        // Validation: Title, Subject, and Main File are required. Cover is optional.
        if (!formData.title || !formData.subject || !file) {
            Alert.alert("Missing Fields", "Please provide a Title, Subject, and select a Document.");
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            
            // Text Fields
            data.append('title', formData.title);
            data.append('subject', formData.subject);
            data.append('class_group', formData.class_group);
            
            // Append Document File
            data.append('file', {
                uri: file.uri,
                type: file.type || 'application/pdf',
                name: file.name || `doc_${Date.now()}.pdf`,
            });

            // Append Cover Image (If selected)
            if (coverImage) {
                const imageUri = Platform.OS === 'android' ? coverImage.uri : coverImage.uri.replace('file://', '');
                data.append('cover_image', {
                    uri: imageUri,
                    type: coverImage.type || 'image/jpeg',
                    name: coverImage.fileName || `cover_${Date.now()}.jpg`,
                });
            }

            // API Call
            await apiClient.post('/library/digital', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            Alert.alert("Success", "Resource uploaded successfully!", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);

        } catch (error) {
            console.error("Upload Error:", error);
            Alert.alert("Upload Failed", "Could not upload the resource. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                <Text style={styles.header}>Upload Digital Resource</Text>

                {/* --- Cover Image Picker --- */}
                <TouchableOpacity style={styles.coverPicker} onPress={pickCover}>
                    {coverImage ? (
                        <Image source={{ uri: coverImage.uri }} style={styles.previewImage} resizeMode="cover" />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.cameraIcon}>📷</Text>
                            <Text style={styles.placeholderText}>Add Cover Image (Optional)</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* --- Form Inputs --- */}
                <View style={styles.card}>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Resource Title *</Text>
                        <TextInput 
                            style={styles.input} 
                            placeholder="e.g. History Chapter 5 Notes" 
                            placeholderTextColor="#94A3B8"
                            value={formData.title}
                            onChangeText={t => setFormData({...formData, title: t})}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.formGroup, {flex:1, marginRight:10}]}>
                            <Text style={styles.label}>Subject *</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="e.g. History" 
                                placeholderTextColor="#94A3B8"
                                value={formData.subject}
                                onChangeText={t => setFormData({...formData, subject: t})}
                            />
                        </View>
                        <View style={[styles.formGroup, {flex:1}]}>
                            <Text style={styles.label}>Class</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="e.g. 10-A" 
                                placeholderTextColor="#94A3B8"
                                value={formData.class_group}
                                onChangeText={t => setFormData({...formData, class_group: t})}
                            />
                        </View>
                    </View>

                    {/* --- Document File Picker --- */}
                    <View style={styles.fileSection}>
                        <Text style={styles.label}>Document (PDF/Doc) *</Text>
                        <TouchableOpacity style={[styles.fileButton, file && styles.fileSelected]} onPress={selectFile}>
                            <Text style={[styles.fileButtonText, file && styles.fileSelectedText]}>
                                {file ? `📄 ${file.name}` : "📎 Tap to Select File"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* --- Submit Button --- */}
                <TouchableOpacity 
                    style={[styles.uploadButton, loading && styles.disabled]} 
                    onPress={handleUpload}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Upload Resource</Text>}
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { padding: 20, paddingBottom: 50 },
    header: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
    
    // Cover Picker Styles
    coverPicker: { 
        height: 180, 
        backgroundColor: '#E2E8F0', 
        borderRadius: 12, 
        marginBottom: 20, 
        justifyContent: 'center', 
        alignItems: 'center', 
        overflow: 'hidden', 
        borderWidth: 1, 
        borderColor: '#CBD5E1', 
        borderStyle: 'dashed',
        width: 140,
        alignSelf: 'center'
    },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { alignItems: 'center' },
    cameraIcon: { fontSize: 32, marginBottom: 5, color: '#64748B' },
    placeholderText: { fontSize: 11, color: '#64748B', textAlign: 'center', paddingHorizontal: 5 },

    // Card & Form Styles
    card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    formGroup: { marginBottom: 15 },
    row: { flexDirection: 'row' },
    label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 15, color: '#1E293B' },

    // Document Picker Styles
    fileSection: { marginTop: 5 },
    fileButton: { backgroundColor: '#F0F9FF', padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#BAE6FD', borderStyle: 'dashed' },
    fileButtonText: { color: '#0284C7', fontWeight: '600', fontSize: 14 },
    fileSelected: { backgroundColor: '#E0F2FE', borderStyle: 'solid' },
    fileSelectedText: { color: '#0369A1' },

    // Upload Button Styles
    uploadButton: { backgroundColor: '#2563EB', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 25, elevation: 3, shadowColor: '#2563EB', shadowOpacity: 0.3 },
    disabled: { backgroundColor: '#94A3B8', elevation: 0 },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default AddDigitalResourceScreen;