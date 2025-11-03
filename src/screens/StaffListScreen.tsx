import React, { useState, useCallback } from 'react'; // Import useCallback
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl
} from 'react-native';
// ★★★ STEP 1: Import useFocusEffect from React Navigation ★★★
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/client'; // Make sure this path is correct

const StaffListScreen = ({ navigation }) => {
    const [admins, setAdmins] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Renamed fetchStaff to be more descriptive and handle loading state better
    const loadStaffData = async () => {
        try {
            const response = await apiClient.get('/staff/all');
            setAdmins(response.data.admins || []);
            setTeachers(response.data.teachers || []);
        } catch (error) {
            console.error('Error fetching staff list:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // ★★★ STEP 2: Replace useEffect with useFocusEffect ★★★
    // This will run the function inside it every time the screen comes into focus (i.e., when you navigate back to it).
    useFocusEffect(
      useCallback(() => {
        // Set loading to true only if it's the first load
        if (admins.length === 0 && teachers.length === 0) {
            setLoading(true);
        }
        loadStaffData();
      }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadStaffData();
    };

    const StaffMember = ({ item }) => (
        <TouchableOpacity
            style={styles.staffMemberContainer}
            onPress={() => navigation.navigate('StaffDetail', { staffId: item.id })}
        >
            <Image
                source={
                    item.profile_image_url
                        ? { uri: item.profile_image_url }
                        // The backend will now add a timestamp to the URL to prevent caching issues.
                        : require('../assets/default_avatar.png') 
                }
                style={styles.avatar}
            />
            <Text style={styles.staffName} numberOfLines={2}>
                {item.full_name}
            </Text>
        </TouchableOpacity>
    );

    const StaffSection = ({ title, data }) => (
        <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {data.length > 0 ? (
                <View style={styles.staffGrid}>
                    {data.map(item => (
                        <StaffMember key={item.id} item={item} />
                    ))}
                </View>
            ) : (
                <Text style={styles.noDataText}>No staff found in this category.</Text>
            )}
        </View>
    );

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#34495e" /></View>;
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <StaffSection title="Admin" data={admins} />
            <StaffSection title="Teachers" data={teachers} />
        </ScrollView>
    );
};

// Styles remain the same
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6f8',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionContainer: {
        margin: 15,
        marginBottom: 5,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 15,
        paddingBottom: 5,
        borderBottomWidth: 2,
        borderBottomColor: '#dfe4ea',
    },
    staffGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    staffMemberContainer: {
        width: '25%',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 5,
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#bdc3c7',
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    staffName: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: '500',
        color: '#34495e',
        textAlign: 'center',
    },
    noDataText: {
        fontSize: 14,
        color: '#7f8c8d',
        textAlign: 'center',
        marginTop: 10,
    },
});

export default StaffListScreen;