// 📂 File: src/screens/labs/StudentLabsScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, SafeAreaView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LabCard, Lab } from './LabCard';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    danger: '#E53935'
};

const StudentLabsScreen = () => {
    const { user } = useAuth();
    const [labs, setLabs] = useState<Lab[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLabs = useCallback(async () => {
        if (!user || !user.class_group) {
            setError('Could not determine your class. Please log in again.');
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }
        try {
            setError(null);
            const response = await apiClient.get(`/labs/student/${user.class_group}`);
            setLabs(response.data);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to fetch Digital Labs.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        fetchLabs();
    }, [fetchLabs]);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchLabs();
    };

    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <MaterialIcons name="error-outline" size={40} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="monitor-dashboard" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Digital Labs</Text>
                        <Text style={styles.headerSubtitle}>Interactive Resources</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={labs}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    // Wrapper ensures exact alignment with Header Card width
                    <View style={styles.cardWrapper}>
                        <LabCard lab={item} />
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="beaker-outline" size={50} color={COLORS.border} />
                        <Text style={styles.emptyText}>No digital labs available for your class yet.</Text>
                    </View>
                }
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
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
        marginTop: 10,     // Reduced top margin
        marginBottom: 8,  // Reduced bottom margin
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

    // --- LIST STYLES ---
    cardWrapper: {
        width: '96%',       // Matches Header Width (Reduces side gaps)
        alignSelf: 'center',
        marginBottom: 5,   // Space between cards
    },

    // --- STATES ---
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyText: { fontSize: 16, color: COLORS.textSub, textAlign: 'center', marginTop: 10 },
    errorText: { color: COLORS.danger, fontSize: 16, textAlign: 'center', marginTop: 10 },
});

export default StudentLabsScreen;