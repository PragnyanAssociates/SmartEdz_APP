import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
    TouchableOpacity, Modal, Pressable
} from 'react-native';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';

const StudentDetailScreen = ({ route }) => {
    const { studentId } = route.params;
    const [studentDetails, setStudentDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isViewerVisible, setViewerVisible] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await apiClient.get(`/students/${studentId}`);
                setStudentDetails(response.data);
            } catch (error) {
                console.error('Error fetching student details:', error);
            } finally {
                setLoading(false);
            }
        };

        if (studentId) {
            fetchDetails();
        }
    }, [studentId]);

    const DetailRow = ({ label, value }) => (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value || 'Not Provided'}</Text>
        </View>
    );

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#34495e" /></View>;
    }

    if (!studentDetails) {
        return <View style={styles.loaderContainer}><Text>Could not load student details.</Text></View>;
    }

    const imageUrl = studentDetails.profile_image_url
        ? `${SERVER_URL}${studentDetails.profile_image_url.startsWith('/') ? '' : '/'}${studentDetails.profile_image_url}`
        : null;

    return (
        <View style={{ flex: 1 }}>
            <Modal
                visible={isViewerVisible}
                transparent={true}
                onRequestClose={() => setViewerVisible(false)}
                animationType="fade"
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setViewerVisible(false)}>
                    <View style={styles.modalContent}>
                        <Image
                            source={
                                imageUrl
                                    ? { uri: imageUrl }
                                    : require('../assets/default_avatar.png')
                            }
                            style={styles.enlargedAvatar}
                            resizeMode="contain"
                        />
                        <TouchableOpacity style={styles.closeButton} onPress={() => setViewerVisible(false)}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            <ScrollView style={styles.container}>
                <View style={styles.profileHeader}>
                    <TouchableOpacity onPress={() => setViewerVisible(true)}>
                        <Image
                            source={
                                imageUrl
                                    ? { uri: imageUrl }
                                    : require('../assets/default_avatar.png')
                            }
                            style={styles.avatar}
                        />
                    </TouchableOpacity>
                    <Text style={styles.fullName}>{studentDetails.full_name}</Text>
                    <Text style={styles.role}>{studentDetails.class_group}</Text>
                </View>

                {/* Personal Details Section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Personal Details</Text>
                    <DetailRow label="Full Name" value={studentDetails.full_name} />
                    <DetailRow label="Username" value={studentDetails.username} />
                    <DetailRow label="Date of Birth" value={studentDetails.dob} />
                    <DetailRow label="Gender" value={studentDetails.gender} />
                </View>

                {/* Contact Details Section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Contact Details</Text>
                    <DetailRow label="Mobile No" value={studentDetails.phone} />
                    <DetailRow label="Email Address" value={studentDetails.email} />
                    <DetailRow label="Address" value={studentDetails.address} />
                </View>

                {/* Academic Details Section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Academic Details</Text>
                    <DetailRow label="Class" value={studentDetails.class_group} />
                    <DetailRow label="Roll No." value={studentDetails.roll_no} />
                    <DetailRow label="Admission No." value={studentDetails.admission_no} />
                    <DetailRow label="Parent Name" value={studentDetails.parent_name} />
                    <DetailRow label="Aadhar No." value={studentDetails.aadhar_no} />
                    <DetailRow label="PEN No." value={studentDetails.pen_no} />
                    <DetailRow label="Admission Date" value={studentDetails.admission_date} />
                </View>

            </ScrollView>
        </View>
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
        paddingVertical: 30,
        paddingHorizontal: 15,
        backgroundColor: '#008080', // Using a different color to distinguish from staff
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
        textAlign: 'center'
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
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 8,
        marginHorizontal: 15,
        marginTop: 15,
        paddingHorizontal: 15,
        paddingBottom: 5,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#008080',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
        marginBottom: 5,
    },
    detailRow: {
        flexDirection: 'row',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 15,
        color: '#7f8c8d',
        flex: 2,
    },
    detailValue: {
        fontSize: 15,
        color: '#2c3e50',
        flex: 3,
        fontWeight: '500',
        textAlign: 'right',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        height: '70%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    enlargedAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
    },
    closeButton: {
        position: 'absolute',
        bottom: -60,
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 35,
        borderRadius: 25,
    },
    closeButtonText: {
        color: '#2c3e50',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default StudentDetailScreen;