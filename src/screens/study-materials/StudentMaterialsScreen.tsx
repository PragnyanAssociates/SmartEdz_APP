// 📂 File: src/screens/study-materials/StudentMaterialsScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Linking, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    blue: '#1E88E5',
    purple: '#8E24AA'
};

const StudentMaterialsScreen = () => {
    const { user } = useAuth();
    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const isFocused = useIsFocused();

    const fetchMaterials = useCallback(async () => {
        if (!user?.class_group) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/study-materials/student/${user.class_group}`);
            setMaterials(response.data);
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Failed to fetch study materials.");
        } finally {
            setIsLoading(false);
        }
    }, [user?.class_group]);

    useEffect(() => {
        if (isFocused) {
            fetchMaterials();
        }
    }, [isFocused, fetchMaterials]);

    const getIconForType = (type) => {
        switch (type) {
            case 'Notes': return 'note-text-outline';
            case 'Presentation': return 'projector-screen';
            case 'Video Lecture': return 'video-outline';
            case 'Worksheet': return 'file-document-edit-outline';
            case 'Link': return 'link-variant';
            default: return 'folder-outline';
        }
    };

    const renderItem = ({ item, index }) => (
        <Animatable.View animation="fadeInUp" duration={500} delay={index * 100} style={styles.cardWrapper}>
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={styles.iconBox}>
                        <MaterialCommunityIcons name={getIconForType(item.material_type)} size={22} color={COLORS.primary} />
                    </View>
                    <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</Text>
                </View>
                
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardInfo}>{item.subject} • {item.material_type}</Text>
                
                {item.description ? (
                    <Text style={styles.cardDescription} numberOfLines={3}>{item.description}</Text>
                ) : <View style={{flex: 1}} />}
                
                <View style={styles.buttonContainer}>
                    {item.file_path && (
                        <TouchableOpacity 
                            style={styles.actionButton} 
                            onPress={() => Linking.openURL(`${SERVER_URL}${item.file_path}`)}
                        >
                            <MaterialIcons name="cloud-download" size={18} color="#fff" />
                            <Text style={styles.actionButtonText}>Download</Text>
                        </TouchableOpacity>
                    )}
                    {item.external_link && (
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.linkButton]}
                            onPress={() => Linking.openURL(item.external_link)}
                        >
                            <MaterialIcons name="open-in-new" size={18} color="#fff" />
                            <Text style={styles.actionButtonText}>Visit</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Animatable.View>
    );

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="bookshelf" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Study Materials</Text>
                        <Text style={styles.headerSubtitle}>Notes & Resources</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={materials}
                renderItem={renderItem}
                keyExtractor={(item) => item.material_id.toString()}
                numColumns={2}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={!isLoading && (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="folder-open-outline" size={50} color={COLORS.border} />
                        <Text style={styles.emptyText}>No study materials found for your class.</Text>
                    </View>
                )}
                onRefresh={fetchMaterials}
                refreshing={isLoading}
            />
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

    // --- GRID LIST ---
    listContentContainer: { paddingHorizontal: 10, paddingBottom: 20 },
    cardWrapper: {
        width: '50%', // Half width for grid
        padding: 6,
    },
    card: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        height: 220, // Fixed height for uniformity
        flexDirection: 'column',
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    iconBox: { backgroundColor: '#F0F2F5', padding: 6, borderRadius: 8 },
    cardDate: { fontSize: 11, color: COLORS.textSub, fontWeight: '500' },
    
    cardTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 4, lineHeight: 18 },
    cardInfo: { fontSize: 11, color: COLORS.primary, marginBottom: 6, fontWeight: '600' },
    cardDescription: { fontSize: 12, color: COLORS.textSub, lineHeight: 16, marginBottom: 10, flex: 1 },
    
    buttonContainer: { marginTop: 'auto' },
    actionButton: { flexDirection: 'row', backgroundColor: COLORS.blue, paddingVertical: 8, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    linkButton: { backgroundColor: COLORS.purple },
    actionButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 6, fontSize: 12 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyText: { textAlign: 'center', fontSize: 16, color: COLORS.textSub, marginTop: 10 },
});

export default StudentMaterialsScreen;