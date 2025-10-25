/**
 * File: src/screens/report/TeacherAssignmentScreen.js
 * Purpose: Admin screen to assign teachers to subjects for a class
 */
import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, Alert, 
    ActivityIndicator, TouchableOpacity 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';


const CLASS_SUBJECTS = {
    'LKG': ['All Subjects'],
    'UKG': ['All Subjects'],
    'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 6': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 7': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 8': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 9': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 10': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social']
};


const TeacherAssignmentScreen = ({ route }) => {
    const { classGroup } = route.params;
    const [teachers, setTeachers] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [selectedTeachers, setSelectedTeachers] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);


    const subjects = CLASS_SUBJECTS[classGroup] || [];


    useEffect(() => {
        fetchData();
    }, [classGroup]);


    const fetchData = async () => {
        try {
            const [teachersRes, assignmentsRes] = await Promise.all([
                apiClient.get('/reports/teachers'),
                apiClient.get(`/reports/teacher-assignments/${classGroup}`)
            ]);
            
            setTeachers(teachersRes.data);
            setAssignments(assignmentsRes.data);
            
            // Pre-populate selected teachers
            const selected = {};
            assignmentsRes.data.forEach(a => {
                selected[a.subject] = a.teacher_id.toString();
            });
            setSelectedTeachers(selected);
        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Failed to load teacher data');
        } finally {
            setLoading(false);
        }
    };


    const handleAssign = async (subject) => {
        const teacherId = selectedTeachers[subject];
        if (!teacherId) {
            Alert.alert('Error', 'Please select a teacher');
            return;
        }


        setSaving(true);
        try {
            await apiClient.post('/reports/assign-teacher', {
                teacherId: parseInt(teacherId),
                classGroup,
                subject
            });
            Alert.alert('Success', 'Teacher assigned successfully');
            fetchData();
        } catch (error) {
            console.error('Error assigning teacher:', error);
            Alert.alert('Error', 'Failed to assign teacher');
        } finally {
            setSaving(false);
        }
    };


    const handleRemove = async (assignmentId) => {
        Alert.alert(
            'Confirm',
            'Remove this teacher assignment?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/reports/teacher-assignments/${assignmentId}`);
                            Alert.alert('Success', 'Assignment removed');
                            fetchData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to remove assignment');
                        }
                    }
                }
            ]
        );
    };


    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#2c3e50" />
            </View>
        );
    }


    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Assign Teachers to Subjects</Text>
            <Text style={styles.subtitle}>Class: {classGroup}</Text>


            {subjects.map(subject => {
                const currentAssignment = assignments.find(a => a.subject === subject);
                
                return (
                    <View key={subject} style={styles.subjectCard}>
                        <Text style={styles.subjectTitle}>{subject}</Text>
                        
                        {currentAssignment ? (
                            <View style={styles.assignedContainer}>
                                <Text style={styles.assignedText}>
                                    Assigned to: <Text style={styles.teacherName}>{currentAssignment.teacher_name}</Text>
                                </Text>
                                <TouchableOpacity
                                    style={styles.removeButton}
                                    onPress={() => handleRemove(currentAssignment.id)}
                                >
                                    <Text style={styles.removeButtonText}>Remove</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.assignContainer}>
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={selectedTeachers[subject] || ''}
                                        onValueChange={(value) => 
                                            setSelectedTeachers(prev => ({ ...prev, [subject]: value }))
                                        }
                                    >
                                        <Picker.Item label="Select Teacher" value="" />
                                        {teachers.map(teacher => (
                                            <Picker.Item 
                                                key={teacher.id} 
                                                label={teacher.full_name} 
                                                value={teacher.id.toString()} 
                                            />
                                        ))}
                                    </Picker>
                                </View>
                                <TouchableOpacity
                                    style={styles.assignButton}
                                    onPress={() => handleAssign(subject)}
                                    disabled={!selectedTeachers[subject] || saving}
                                >
                                    <Text style={styles.assignButtonText}>Assign</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                );
            })}
        </ScrollView>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
        padding: 15
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 5
    },
    subtitle: {
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 20
    },
    subjectCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2
    },
    subjectTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 10
    },
    assignedContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#d4edda',
        padding: 12,
        borderRadius: 8
    },
    assignedText: {
        fontSize: 14,
        color: '#155724'
    },
    teacherName: {
        fontWeight: 'bold'
    },
    removeButton: {
        backgroundColor: '#e74c3c',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 6
    },
    removeButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14
    },
    assignContainer: {
        gap: 10
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        backgroundColor: '#fff'
    },
    assignButton: {
        backgroundColor: '#27ae60',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center'
    },
    assignButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    }
});


export default TeacherAssignmentScreen;