import React, { useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';

// Define the order of classes to be displayed
const CLASS_ORDER = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const StudentListScreen = ({ navigation }) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadStudentData = async () => {
        try {
            const response = await apiClient.get('/students/all');
            setStudents(response.data || []);
        } catch (error) {
            console.error('Error fetching student list:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
      useCallback(() => {
        if (students.length === 0) {
            setLoading(true);
        }
        loadStudentData();
      }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadStudentData();
    };

    // Group students by their class_group using useMemo for performance
    const groupedStudents = useMemo(() => {
        const groups = {};
        students.forEach(student => {
            const groupName = student.class_group;
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(student);
        });
        return groups;
    }, [students]);

    const StudentMember = ({ item }) => {
        const imageUrl = item.profile_image_url
            ? `${SERVER_URL}${item.profile_image_url.startsWith('/') ? '' : '/'}${item.profile_image_url}`
            : null;

        return (
            <TouchableOpacity
                style={styles.studentMemberContainer}
                onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
            >
                <Image
                    source={
                        imageUrl
                            ? { uri: imageUrl }
                            : require('../assets/default_avatar.png')
                    }
                    style={styles.avatar}
                />
                <Text style={styles.studentName} numberOfLines={2}>
                    {item.full_name}
                </Text>
            </TouchableOpacity>
        );
    };

    const StudentSection = ({ title, data }) => {
        if (!data || data.length === 0) {
            return null; // Don't render a section if there are no students in it
        }

        return (
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>{title}</Text>
                <View style={styles.studentGrid}>
                    {data.map(item => (
                        <StudentMember key={item.id} item={item} />
                    ))}
                </View>
            </View>
        );
    };

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#34495e" /></View>;
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {CLASS_ORDER.map(className => (
                <StudentSection
                    key={className}
                    title={className}
                    data={groupedStudents[className]}
                />
            ))}
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
    studentGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    studentMemberContainer: {
        width: '25%', // 4 items per row
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
    studentName: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: '500',
        color: '#34495e',
        textAlign: 'center',
    },
});

export default StudentListScreen;