import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext'; 

const DigitalResourceDetailsScreen = ({ route, navigation }) => {
    const { resource } = route.params;
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [loading, setLoading] = useState(false);

    const coverUrl = resource.cover_image_url 
        ? `${SERVER_URL}${resource.cover_image_url}` 
        : 'https://via.placeholder.com/300/CCCCCC/FFFFFF?text=No+Cover';

    const fullFileUrl = `${SERVER_URL}${resource.file_url}`;

    // --- 1. VIEW FUNCTION (Opens inside App) ---
    const handleView = () => {
        if (!resource.file_url) return;
        // Navigate to the new Viewer Screen
        navigation.navigate('DocumentViewerScreen', { url: fullFileUrl });
    };

    // --- 2. DOWNLOAD FUNCTION (Opens in Browser/Download Manager) ---
    const handleDownload = () => {
        if (!resource.file_url) return;
        Linking.openURL(fullFileUrl);
    };

    const handleDelete = async () => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this resource?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: 'destructive', onPress: async () => {
                setLoading(true);
                try {
                    await apiClient.delete(`/library/digital/${resource.id}`);
                    navigation.goBack();
                } catch (error) {
                    Alert.alert("Error", "Failed to delete.");
                } finally { setLoading(false); }
            }}
        ]);
    };

    const handleEdit = () => {
        navigation.navigate('AddDigitalResourceScreen', { resource: resource });
    };

    return (
        <ScrollView style={styles.container} bounces={false}>
            {/* Cover Image Header */}
            <View style={styles.imageHeader}>
                <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="contain" />
            </View>

            <View style={styles.content}>
                {/* Book Info */}
                <Text style={styles.title}>{resource.title}</Text>
                <Text style={styles.author}>by {resource.author}</Text>

                <View style={styles.tags}>
                    {resource.category && <Text style={styles.tag}>{resource.category}</Text>}
                    {resource.book_no && <Text style={[styles.tag, styles.tagGray]}>Ref: {resource.book_no}</Text>}
                </View>

                <View style={styles.divider} />

                <Text style={styles.label}>Publisher</Text>
                <Text style={styles.value}>{resource.publisher || 'N/A'}</Text>

                {/* --- ACTION BUTTONS (View / Download) --- */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.viewBtn} onPress={handleView}>
                        <Text style={styles.viewBtnText}>👁 View Document</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
                        <Text style={styles.downloadBtnText}>⬇ Download</Text>
                    </TouchableOpacity>
                </View>

                {/* --- ADMIN ACTIONS (Edit / Delete) --- */}
                {isAdmin && (
                    <View style={styles.adminSection}>
                        <Text style={styles.adminHeader}>Admin Actions</Text>
                        <View style={styles.adminRow}>
                            <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
                                <Text style={styles.editBtnText}>✏ Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                                <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    imageHeader: { height: 260, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderColor: '#E2E8F0' },
    cover: { width: 180, height: 240, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
    content: { padding: 24 },
    title: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 5 },
    author: { fontSize: 16, color: '#64748B', fontWeight: '500', marginBottom: 15 },
    tags: { flexDirection: 'row', marginBottom: 20 },
    tag: { backgroundColor: '#EFF6FF', color: '#2563EB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, fontSize: 12, fontWeight: 'bold', marginRight: 10 },
    tagGray: { backgroundColor: '#F1F5F9', color: '#64748B' },
    divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 15 },
    label: { fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 },
    value: { fontSize: 16, color: '#334155', fontWeight: '500', marginBottom: 20 },
    
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    viewBtn: { flex: 1, backgroundColor: '#2563EB', padding: 15, borderRadius: 10, marginRight: 10, alignItems: 'center' },
    viewBtnText: { color: '#FFF', fontWeight: 'bold' },
    downloadBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#2563EB', padding: 15, borderRadius: 10, alignItems: 'center' },
    downloadBtnText: { color: '#2563EB', fontWeight: 'bold' },

    adminSection: { marginTop: 40, borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 20 },
    adminHeader: { fontSize: 14, fontWeight: 'bold', color: '#94A3B8', marginBottom: 15 },
    adminRow: { flexDirection: 'row', justifyContent: 'space-between' },
    editBtn: { flex: 1, backgroundColor: '#F59E0B', padding: 15, borderRadius: 10, marginRight: 10, alignItems: 'center' },
    editBtnText: { color: '#FFF', fontWeight: 'bold' },
    deleteBtn: { flex: 1, backgroundColor: '#EF4444', padding: 15, borderRadius: 10, alignItems: 'center' },
    deleteBtnText: { color: '#FFF', fontWeight: 'bold' },
});

export default DigitalResourceDetailsScreen;