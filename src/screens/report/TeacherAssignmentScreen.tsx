/**
 * File: src/screens/report/TeacherAssignmentScreen.js
 * Purpose: Admin screen to assign teachers to subjects for a class
 * Updated: Header Card Design & Theme Consistency
 */
import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, Alert, 
    ActivityIndicator, TouchableOpacity 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    success: '#43A047',
    danger: '#E53935',
    border: '#CFD8DC'
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
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <Icon name="account-details" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Teacher Allocation</Text>
                        <Text style={styles.headerSubtitle}>{classGroup}</Text>
                    </View>
                </View>
            </View>

            {/* Subject List */}
            <View style={styles.listContainer}>
                {subjects.map(subject => {
                    const currentAssignment = assignments.find(a => a.subject === subject);
                    
                    return (
                        <View key={subject} style={styles.subjectCard}>
                            <View style={styles.cardHeader}>
                                <Icon name="book-open-page-variant" size={20} color={COLORS.textSub} style={{marginRight: 8}} />
                                <Text style={styles.subjectTitle}>{subject}</Text>
                            </View>
                            
                            {currentAssignment ? (
                                <View style={styles.assignedContainer}>
                                    <View style={styles.assignedInfo}>
                                        <Text style={styles.assignedLabel}>Assigned to:</Text>
                                        <Text style={styles.teacherName}>{currentAssignment.teacher_name}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => handleRemove(currentAssignment.id)}
                                    >
                                        <Icon name="trash-can-outline" size={18} color="#fff" />
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
                                            style={styles.picker}
                                        >
                                            <Picker.Item label="Select Teacher..." value="" color="#999"/>
                                            {teachers.map(teacher => (
                                                <Picker.Item 
                                                    key={teacher.id} 
                                                    label={teacher.full_name} 
                                                    value={teacher.id.toString()} 
                                                    color="#333"
                                                />
                                            ))}
                                        </Picker>
                                    </View>
                                    <TouchableOpacity
                                        style={[
                                            styles.assignButton, 
                                            (!selectedTeachers[subject] || saving) && styles.assignButtonDisabled
                                        ]}
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
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    listContainer: {
        paddingHorizontal: 15,
        paddingBottom: 30
    },

    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 15,
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

    // --- CARD STYLES ---
    subjectCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        borderWidth: 1,
        borderColor: '#f0f2f5'
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingBottom: 8
    },
    subjectTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textMain
    },
    
    // --- ASSIGNED STATE ---
    assignedContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#C8E6C9'
    },
    assignedInfo: {
        flex: 1,
    },
    assignedLabel: {
        fontSize: 11,
        color: '#2E7D32',
        marginBottom: 2
    },
    teacherName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1B5E20'
    },
    removeButton: {
        backgroundColor: '#ef5350',
        padding: 8,
        borderRadius: 6,
        marginLeft: 10
    },

    // --- UNASSIGNED STATE ---
    assignContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    pickerContainer: {
        flex: 1,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        backgroundColor: '#FAFAFA',
        height: 45,
        justifyContent: 'center',
        overflow: 'hidden'
    },
    picker: {
        width: '100%',
    },
    assignButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        elevation: 2
    },
    assignButtonDisabled: {
        backgroundColor: '#B0BEC5',
        elevation: 0
    },
    assignButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14
    }
});

export default TeacherAssignmentScreen;