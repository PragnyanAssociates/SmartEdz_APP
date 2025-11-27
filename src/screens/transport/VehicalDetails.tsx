import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    SafeAreaView,
    Modal,
    TextInput,
    Alert,
    ScrollView,
    ActivityIndicator,
    Linking
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';

// ★★★ NEW LIBRARY IMPORT ★★★
import { pick, types, isCancel } from '@react-native-documents/picker';

// Icons
const PDF_ICON = 'https://cdn-icons-png.flaticon.com/128/337/337946.png';
const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';
const DENIED_ICON = 'https://cdn-icons-png.flaticon.com/128/3967/3967261.png';
const TRASH_ICON = 'https://cdn-icons-png.flaticon.com/128/6861/6861362.png';

interface Vehicle {
    id: number;
    bus_number: string;
    bus_name: string;
    bus_photos: string | string[]; // JSON string or Array
}

const VehicalDetails = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const userRole = user?.role;

    // State
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(false);

    // Add Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [busNumber, setBusNumber] = useState('');
    const [busName, setBusName] = useState('');
    
    // Selected Files (Images + PDFs)
    const [selectedFiles, setSelectedFiles] = useState<any[]>([]);

    useEffect(() => {
        if (userRole === 'admin') {
            fetchVehicles();
        }
    }, [userRole]);

    // --- API CALLS ---

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/transport/vehicles');
            // Parse JSON photos if needed
            const parsedData = response.data.map((v: any) => ({
                ...v,
                bus_photos: typeof v.bus_photos === 'string' ? JSON.parse(v.bus_photos) : v.bus_photos
            }));
            setVehicles(parsedData);
        } catch (error) {
            console.error("Fetch Vehicles Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddVehicle = async () => {
        if (!busNumber || !busName) {
            Alert.alert("Required", "Please enter Bus Number and Bus Name");
            return;
        }

        const formData = new FormData();
        formData.append('bus_number', busNumber);
        formData.append('bus_name', busName);

        // Append real files
        selectedFiles.forEach((file) => {
            formData.append('files', {
                uri: file.uri,
                type: file.type || 'image/jpeg', // Fallback type if missing
                name: file.name || `upload_${Date.now()}.jpg`, // Fallback name
            } as any);
        });

        setLoading(true);
        try {
            await apiClient.post('/transport/vehicles', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data' 
                },
            });
            Alert.alert("Success", "Vehicle Added!");
            setShowAddModal(false);
            setBusName('');
            setBusNumber('');
            setSelectedFiles([]);
            fetchVehicles();
        } catch (error: any) {
            console.error("Add Error", error?.response?.data || error);
            const errMsg = error?.response?.data?.message || "Failed to add vehicle.";
            Alert.alert("Error", errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteVehicle = (id: number) => {
        Alert.alert("Delete", "Are you sure you want to delete this vehicle?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: 'destructive',
                onPress: async () => {
                    try {
                        await apiClient.delete(`/transport/vehicles/${id}`);
                        fetchVehicles();
                    } catch (e) {
                        Alert.alert("Error", "Could not delete.");
                    }
                }
            }
        ]);
    };

    // --- REAL FILE PICKER (Updated) ---
    const pickFiles = async () => {
        try {
            const results = await pick({
                allowMultiSelection: true,
                type: [types.images, types.pdf], // Using types from the new library
            });

            // Append new selections to existing ones
            setSelectedFiles([...selectedFiles, ...results]);
            
        } catch (err) {
            if (isCancel(err)) {
                // User cancelled the picker, ignore
            } else {
                Alert.alert('Error', 'Unknown Error: ' + JSON.stringify(err));
            }
        }
    };

    // --- HELPERS ---

    const getFileUrl = (url: string) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `${SERVER_URL}${url}`;
    };

    const isPdf = (filename: string) => {
        return filename?.toLowerCase().endsWith('.pdf');
    };

    const openFile = (url: string) => {
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    // --- RENDER HELPERS ---

    // 1. ACCESS DENIED
    if (userRole !== 'admin') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                     <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Vehicle Details</Text>
                    <View style={{width: 30}} />
                </View>
                <View style={styles.accessDeniedContainer}>
                    <Image source={{ uri: DENIED_ICON }} style={styles.deniedIcon} />
                    <Text style={styles.deniedTitle}>Access Restricted</Text>
                    <Text style={styles.deniedText}>You have no access for this Module.</Text>
                    <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.goBackText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // 2. FILE PREVIEW ITEM (For Modal)
    const renderSelectedFilePreview = (file: any, index: number) => {
        const isPdfFile = file.type === 'application/pdf' || file.name?.endsWith('.pdf');
        
        return (
            <View key={index} style={styles.previewContainer}>
                <Image 
                    source={{ uri: isPdfFile ? PDF_ICON : file.uri }} 
                    style={styles.previewImage} 
                    resizeMode="cover"
                />
                <TouchableOpacity 
                    style={styles.removeFileBtn} 
                    onPress={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                >
                    <Text style={styles.removeFileText}>✕</Text>
                </TouchableOpacity>
                {isPdfFile && <Text style={styles.pdfLabel}>PDF</Text>}
            </View>
        );
    };

    // 3. VEHICLE CARD
    const renderVehicleCard = ({ item }: { item: Vehicle }) => {
        let files: string[] = [];
        if (Array.isArray(item.bus_photos)) files = item.bus_photos;
        else if (typeof item.bus_photos === 'string') {
            try { files = JSON.parse(item.bus_photos); } catch (e) { files = []; }
        }

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.busNo}>{item.bus_number}</Text>
                        <Text style={styles.busName}>{item.bus_name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteVehicle(item.id)}>
                        <Image source={{ uri: TRASH_ICON }} style={styles.trashIcon} />
                    </TouchableOpacity>
                </View>

                {/* Album Scroll */}
                {files && files.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumContainer}>
                        {files.map((fileUrl, index) => {
                            const fullUrl = getFileUrl(fileUrl);
                            if(!fullUrl) return null;
                            
                            const fileIsPdf = isPdf(fileUrl);

                            return (
                                <TouchableOpacity key={index} onPress={() => openFile(fullUrl)}>
                                    <View style={styles.fileWrapper}>
                                        <Image 
                                            source={{ uri: fileIsPdf ? PDF_ICON : fullUrl }} 
                                            style={styles.albumPhoto} 
                                            resizeMode="cover"
                                        />
                                        {fileIsPdf && <View style={styles.pdfBadge}><Text style={styles.pdfBadgeText}>PDF</Text></View>}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : (
                    <Text style={styles.noPhotos}>No docs uploaded</Text>
                )}
            </View>
        );
    };

    // --- MAIN RENDER ---
    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Vehicle Details</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
                    <Text style={styles.addButtonText}>+ Add Bus</Text>
                </TouchableOpacity>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color="#008080" /></View>
            ) : (
                <FlatList
                    data={vehicles}
                    renderItem={renderVehicleCard}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={styles.emptyText}>No Vehicles Added Yet.</Text>
                        </View>
                    }
                />
            )}

            {/* Add Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add School Bus</Text>
                        
                        <Text style={styles.label}>Bus Number</Text>
                        <TextInput 
                            placeholder="e.g. TN-01-1234" 
                            style={styles.input} 
                            value={busNumber}
                            onChangeText={setBusNumber}
                        />
                        
                        <Text style={styles.label}>Bus Name/Route Name</Text>
                        <TextInput 
                            placeholder="e.g. Yellow Bus" 
                            style={styles.input} 
                            value={busName}
                            onChangeText={setBusName}
                        />

                        {/* File Picker */}
                        <Text style={styles.label}>Album (Images & PDFs):</Text>
                        <View style={styles.imagePickerContainer}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {selectedFiles.map((file, i) => renderSelectedFilePreview(file, i))}
                                
                                <TouchableOpacity style={styles.pickBtn} onPress={pickFiles}>
                                    <Text style={styles.pickBtnText}>+</Text>
                                    <Text style={styles.pickBtnSubText}>Add File</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                        <Text style={styles.hintText}>{selectedFiles.length} files selected</Text>

                        {/* Actions */}
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleAddVehicle}>
                                <Text style={styles.saveText}>Save Vehicle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    header: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E2E8F0' 
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 15, padding: 5 },
    backIcon: { width: 24, height: 24, tintColor: '#2D3748' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A202C' },
    addButton: { backgroundColor: '#38A169', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },

    // Access Denied
    accessDeniedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    deniedIcon: { width: 80, height: 80, marginBottom: 20, tintColor: '#E53E3E' },
    deniedTitle: { fontSize: 22, fontWeight: 'bold', color: '#2D3748', marginBottom: 10 },
    deniedText: { fontSize: 16, color: '#718096', textAlign: 'center', marginBottom: 30 },
    goBackBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
    goBackText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

    // List
    listContent: { padding: 16 },
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    busNo: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
    busName: { fontSize: 14, color: '#718096' },
    trashIcon: { width: 22, height: 22, tintColor: '#E53E3E' },
    
    // Album in Card
    albumContainer: { marginTop: 10, flexDirection: 'row' },
    fileWrapper: { marginRight: 10, position: 'relative' },
    albumPhoto: { width: 90, height: 90, borderRadius: 8, backgroundColor: '#EDF2F7', borderWidth: 1, borderColor: '#E2E8F0' },
    pdfBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(229, 62, 62, 0.8)', padding: 2, alignItems: 'center', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
    pdfBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    noPhotos: { color: '#CBD5E0', fontStyle: 'italic', marginTop: 10 },
    emptyText: { color: '#718096', fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 12, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, color: '#4A5568' },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
    
    // Picker in Modal
    imagePickerContainer: { flexDirection: 'row', marginBottom: 5, height: 80 },
    previewContainer: { marginRight: 10, position: 'relative' },
    previewImage: { width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    removeFileBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#E53E3E', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    removeFileText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    pdfLabel: { position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', color: '#FFF', fontSize: 10 },
    
    pickBtn: { width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: '#3182CE', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    pickBtnText: { fontSize: 24, color: '#3182CE' },
    pickBtnSubText: { fontSize: 10, color: '#3182CE' },
    hintText: { fontSize: 12, color: '#718096', marginBottom: 20 },
    
    // Modal Buttons
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
    cancelBtn: { padding: 12, flex: 1, alignItems: 'center' },
    cancelText: { color: '#E53E3E', fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center', marginLeft: 10 },
    saveText: { color: '#FFF', fontWeight: 'bold' },
});

export default VehicalDetails;