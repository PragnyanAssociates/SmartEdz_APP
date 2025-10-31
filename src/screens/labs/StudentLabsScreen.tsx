// 📂 File: src/screens/labs/StudentLabsScreen.tsx (REPLACE THIS FILE)

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LabCard, Lab } from './LabCard';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

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
        return <View style={styles.centered}><ActivityIndicator size="large" color="#008080" /></View>;
    }

    if (error) {
        return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={labs}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => <LabCard lab={item} />}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <MaterialIcons name="desktop-windows" size={30} color="#00695c" />
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Digital Labs & Resources</Text>
                            <Text style={styles.headerSubtitle}>Access interactive learning tools and experiments.</Text>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.centered}>
                        <Text style={styles.emptyText}>No digital labs are available for your class yet.</Text>
                    </View>
                }
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#008080"]} />}
                contentContainerStyle={{ flexGrow: 1 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { color: 'red', fontSize: 16, textAlign: 'center' },
    header: { padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center' },
    headerTextContainer: { marginLeft: 15 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#004d40' },
    headerSubtitle: { fontSize: 15, color: '#37474f', marginTop: 4 },
    emptyText: { fontSize: 16, color: '#555', textAlign: 'center' },
});

export default StudentLabsScreen;