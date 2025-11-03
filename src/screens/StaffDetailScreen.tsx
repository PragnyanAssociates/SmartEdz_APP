import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Image
} from 'react-native';
import apiClient from './api/client'; // Make sure this path is correct

const StaffDetailScreen = ({ route }) => {
    const { staffId } = route.params;
    const [staffDetails, setStaffDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await apiClient.get(`/staff/${staffId}`);
                setStaffDetails(response.data);
            } catch (error) {
                console.error('Error fetching staff details:', error);
                // Handle error, maybe show an alert
            } finally {
                setLoading(false);
            }
        };

        if (staffId) {
            fetchDetails();
        }
    }, [staffId]);

    const DetailRow = ({ label, value }) => (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value || 'Not Provided'}</Text>
        </View>
    );

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#34495e" /></View>;
    }

    if (!staffDetails) {
        return <View style={styles.loaderContainer}><Text>Could not load staff details.</Text></View>;
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.profileHeader}>
                <Image
                    source={
                        staffDetails.profile_image_url
                            ? { uri: staffDetails.profile_image_url }
                            // ★★★ CORRECTED PATH ★★★
                            : require('../assets/default_avatar.png')
                    }
                    style={styles.avatar}
                />
                <Text style={styles.fullName}>{staffDetails.full_name}</Text>
                <Text style={styles.role}>{staffDetails.role.charAt(0).toUpperCase() + staffDetails.role.slice(1)}</Text>
            </View>

            <View style={styles.detailsContainer}>
                <DetailRow label="Full Name" value={staffDetails.full_name} />
                <DetailRow label="Mobile No" value={staffDetails.phone} />
                <DetailRow label="Email Address" value={staffDetails.email} />
                <DetailRow label="Address" value={staffDetails.address} />
                <DetailRow label="Username" value={staffDetails.username} />
                <DetailRow label="Date of Birth" value={staffDetails.dob} />
                <DetailRow label="Gender" value={staffDetails.gender} />
            </View>
        </ScrollView>
    );
};

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
    profileHeader: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#34495e',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#ffffff',
        marginBottom: 15,
        backgroundColor: '#bdc3c7',
    },
    fullName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    role: {
        fontSize: 16,
        color: '#ecf0f1',
        marginTop: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 15,
    },
    detailsContainer: {
        backgroundColor: '#ffffff',
        marginTop: -10,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        padding: 10,
    },
    detailRow: {
        flexDirection: 'row',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 16,
        color: '#7f8c8d',
        flex: 2, // Takes up 2 parts of the space
    },
    detailValue: {
        fontSize: 16,
        color: '#2c3e50',
        flex: 3, // Takes up 3 parts of the space
        fontWeight: '500',
        textAlign: 'right',
    },
});

export default StaffDetailScreen;