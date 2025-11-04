import React, { useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';

const CLASS_ORDER = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const StudentListScreen = ({ navigation }) => {
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('Class 10');
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

    // MODIFIED: Added a sorting function inside useMemo
    const groupedStudents = useMemo(() => {
        const groups = {};
        students.forEach(student => {
            const groupName = student.class_group;
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(student);
        });

        // Sort each class group by roll number
        for (const groupName in groups) {
            groups[groupName].sort((a, b) => {
                const rollA = parseInt(a.roll_no, 10) || 9999; // Treat null/invalid roll numbers as high numbers
                const rollB = parseInt(b.roll_no, 10) || 9999;
                return rollA - rollB;
            });
        }

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
                {item.roll_no && (
                    <Text style={styles.rollNumber}>
                        Roll: {item.roll_no}
                    </Text>
                )}
            </TouchableOpacity>
        );
    };

    const currentClassStudents = groupedStudents[selectedClass] || [];

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#008080" /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Select Class:</Text>
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={selectedClass}
                        onValueChange={(itemValue) => setSelectedClass(itemValue)}
                        style={styles.picker}
                        dropdownIconColor="#008080"
                    >
                        {CLASS_ORDER.map(className => (
                            <Picker.Item key={className} label={className} value={className} />
                        ))}
                    </Picker>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {currentClassStudents.length > 0 ? (
                    <View style={styles.studentGrid}>
                        {currentClassStudents.map(item => (
                            <StudentMember key={item.id} item={item} />
                        ))}
                    </View>
                ) : (
                    <View style={styles.noDataContainer}>
                        <Text style={styles.noDataText}>No students found in this class.</Text>
                    </View>
                )}
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
        backgroundColor: '#f4f6f8',
    },
    pickerContainer: {
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 5,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    pickerLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7f8c8d',
        marginBottom: 5,
    },
    pickerWrapper: {
        backgroundColor: '#f4f6f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#dfe4ea',
    },
    picker: {
        width: '100%',
        height: 50,
    },
    scrollContent: {
        padding: 15,
    },
    studentGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    studentMemberContainer: {
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
    },
    studentName: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: '500',
        color: '#34495e',
        textAlign: 'center',
    },
    rollNumber: {
        fontSize: 11,
        color: '#7f8c8d',
        textAlign: 'center',
        marginTop: 2,
    },
    noDataContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 50,
    },
    noDataText: {
        fontSize: 16,
        color: '#95a5a6',
    },
});

export default StudentListScreen;