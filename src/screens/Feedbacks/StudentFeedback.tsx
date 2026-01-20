import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

// --- Types ---
interface StudentFeedbackRow {
    student_id: number;
    full_name: string;
    roll_no: string;
    behavior_status: 'Good' | 'Average' | 'Poor' | null;
    remarks: string;
}

interface Teacher {
    id: number;
    full_name: string;
}

const StudentFeedback = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    
    // Filters
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
    
    const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Data
    const [students, setStudents] = useState<StudentFeedbackRow[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    // --- 1. Initial Setup based on Role ---
    useEffect(() => {
        if (!user) return;

        if (user.role === 'admin') {
            fetchTeachers();
        } else if (user.role === 'teacher') {
            setSelectedTeacherId(user.id);
            fetchAssignedClasses(user.id);
        }
    }, [user]);

    // --- 2. API Calls ---

    const fetchTeachers = async () => {
        try {
            const response = await apiClient.get('/teachers');
            setTeachers(response.data);
        } catch (error) {
            console.error('Error fetching teachers', error);
        }
    };

    const fetchAssignedClasses = async (teacherId: number) => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/teacher-classes/${teacherId}`);
            const classes = response.data;
            setAssignedClasses(classes);
            if (classes.length > 0) {
                setSelectedClass(classes[0]);
            } else {
                setSelectedClass('');
                setStudents([]);
            }
        } catch (error) {
            Alert.alert('Error', 'Could not load assigned classes.');
        } finally {
            setLoading(false);
        }
    };

    const fetchStudentData = useCallback(async () => {
        if (!selectedTeacherId || !selectedClass) return;

        setLoading(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const response = await apiClient.get('/feedback/students', {
                params: {
                    class_group: selectedClass,
                    teacher_id: selectedTeacherId,
                    date: dateStr
                }
            });
            // Ensure status is null if not set, for UI logic
            const formattedData = response.data.map((s: any) => ({
                ...s,
                behavior_status: s.behavior_status || null,
                remarks: s.remarks || ''
            }));
            setStudents(formattedData);
            setHasChanges(false);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load student list.');
        } finally {
            setLoading(false);
        }
    }, [selectedTeacherId, selectedClass, selectedDate]);

    // Fetch students whenever filters change
    useEffect(() => {
        if (selectedTeacherId && selectedClass) {
            fetchStudentData();
        }
    }, [fetchStudentData]);

    const handleSave = async () => {
        if (!selectedTeacherId || !selectedClass) return;
        
        setLoading(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const payload = {
                teacher_id: selectedTeacherId,
                class_group: selectedClass,
                date: dateStr,
                feedback_data: students.map(s => ({
                    student_id: s.student_id,
                    behavior_status: s.behavior_status,
                    remarks: s.remarks
                }))
            };

            await apiClient.post('/feedback', payload);
            Alert.alert("Success", "Student behavior saved successfully!");
            setHasChanges(false);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save feedback.");
        } finally {
            setLoading(false);
        }
    };

    // --- 3. UI Handlers ---

    const updateStudentFeedback = (id: number, field: keyof StudentFeedbackRow, value: any) => {
        // Admin is read-only usually, but if you want admin to edit, remove this check
        if (user?.role === 'admin') return; 

        setStudents(prev => prev.map(s => {
            if (s.student_id === id) {
                return { ...s, [field]: value };
            }
            return s;
        }));
        setHasChanges(true);
    };

    const onAdminSelectTeacher = (teacherIdStr: string) => {
        const tId = parseInt(teacherIdStr);
        setSelectedTeacherId(tId);
        fetchAssignedClasses(tId);
    };

    // --- Render Components ---

    const StatusButton = ({ label, currentStatus, targetStatus, color, onPress, disabled }: any) => {
        const isSelected = currentStatus === targetStatus;
        return (
            <TouchableOpacity 
                style={[
                    styles.statusBtn, 
                    isSelected ? { backgroundColor: color, borderColor: color } : { borderColor: '#ccc' }
                ]}
                onPress={onPress}
                disabled={disabled}
            >
                <Text style={[styles.statusBtnText, isSelected && { color: '#FFF' }]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Student Behaviour</Text>
                <Text style={styles.dateText}>{selectedDate.toDateString()}</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.calIcon}>
                    <Icon name="calendar" size={24} color="#008080" />
                </TouchableOpacity>
            </View>

            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (date) setSelectedDate(date);
                    }}
                />
            )}

            {/* Filters */}
            <View style={styles.filterContainer}>
                {user?.role === 'admin' && (
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={selectedTeacherId?.toString()}
                            onValueChange={onAdminSelectTeacher}
                            style={styles.picker}
                        >
                            <Picker.Item label="-- Select Teacher --" value="" />
                            {teachers.map(t => (
                                <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />
                            ))}
                        </Picker>
                    </View>
                )}

                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={selectedClass}
                        onValueChange={setSelectedClass}
                        enabled={assignedClasses.length > 0}
                        style={styles.picker}
                    >
                        {assignedClasses.length === 0 ? (
                            <Picker.Item label="No Assigned Classes" value="" />
                        ) : (
                            assignedClasses.map(c => <Picker.Item key={c} label={c} value={c} />)
                        )}
                    </Picker>
                </View>
            </View>

            {/* Table Header */}
            <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: 40 }]}>Roll</Text>
                <Text style={[styles.th, { flex: 1 }]}>Name</Text>
                <Text style={[styles.th, { width: 140, textAlign: 'center' }]}>Feedback</Text>
                <Text style={[styles.th, { width: 80 }]}>Remarks</Text>
            </View>

            {/* List */}
            {loading ? (
                <ActivityIndicator size="large" color="#008080" style={{ marginTop: 20 }} />
            ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
                    {students.length > 0 ? (
                        students.map((item, index) => (
                            <View key={item.student_id} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                                <Text style={[styles.td, { width: 40, fontWeight: 'bold' }]}>{item.roll_no || '-'}</Text>
                                <Text style={[styles.td, { flex: 1 }]}>{item.full_name}</Text>
                                
                                {/* Status Buttons */}
                                <View style={{ width: 140, flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <StatusButton 
                                        label="G" targetStatus="Good" currentStatus={item.behavior_status} 
                                        color="#4CAF50" // Green
                                        disabled={user?.role === 'admin'}
                                        onPress={() => updateStudentFeedback(item.student_id, 'behavior_status', 'Good')}
                                    />
                                    <StatusButton 
                                        label="A" targetStatus="Average" currentStatus={item.behavior_status} 
                                        color="#2196F3" // Blue
                                        disabled={user?.role === 'admin'}
                                        onPress={() => updateStudentFeedback(item.student_id, 'behavior_status', 'Average')}
                                    />
                                    <StatusButton 
                                        label="P" targetStatus="Poor" currentStatus={item.behavior_status} 
                                        color="#F44336" // Red
                                        disabled={user?.role === 'admin'}
                                        onPress={() => updateStudentFeedback(item.student_id, 'behavior_status', 'Poor')}
                                    />
                                </View>

                                {/* Remarks Input */}
                                <View style={{ width: 80, marginLeft: 5 }}>
                                    <TextInput 
                                        style={styles.input}
                                        placeholder="..."
                                        value={item.remarks}
                                        editable={user?.role !== 'admin'}
                                        onChangeText={(text) => updateStudentFeedback(item.student_id, 'remarks', text)}
                                    />
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>
                            {assignedClasses.length === 0 
                                ? "You are not assigned to any classes in the timetable." 
                                : "No students found."}
                        </Text>
                    )}
                </ScrollView>
            )}

            {/* Save Button (Only for Teachers) */}
            {user?.role === 'teacher' && (
                <View style={styles.footer}>
                    <TouchableOpacity 
                        style={[styles.saveBtn, (!hasChanges || loading) && { opacity: 0.6 }]} 
                        onPress={handleSave}
                        disabled={!hasChanges || loading}
                    >
                        <Text style={styles.saveBtnText}>SAVE FEEDBACK</Text>
                    </TouchableOpacity>
                </View>
            )}

             {/* Legend (Only for visual clarity) */}
             <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={styles.legendText}>Good</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
                    <Text style={styles.legendText}>Average</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                    <Text style={styles.legendText}>Poor</Text>
                </View>
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9F9F9' },
    header: {
        padding: 15, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderBottomWidth: 1, borderBottomColor: '#EEE', elevation: 2
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    dateText: { fontSize: 14, color: '#666' },
    calIcon: { padding: 5 },
    
    filterContainer: { padding: 10, backgroundColor: '#FFF', marginBottom: 5 },
    pickerWrapper: {
        borderWidth: 1, borderColor: '#DDD', borderRadius: 8, marginBottom: 10,
        backgroundColor: '#FAFAFA', overflow: 'hidden', height: 45, justifyContent: 'center'
    },
    picker: { width: '100%', color: '#333' },
    
    tableHeader: {
        flexDirection: 'row', backgroundColor: '#E0F2F1', paddingVertical: 10, paddingHorizontal: 5,
        borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#B2DFDB'
    },
    th: { fontWeight: 'bold', color: '#00695C', fontSize: 13 },
    
    row: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5,
        borderBottomWidth: 1, borderBottomColor: '#EEE', backgroundColor: '#FFF', minHeight: 50
    },
    rowAlt: { backgroundColor: '#F4F6F8' },
    td: { fontSize: 13, color: '#333' },
    
    statusBtn: {
        width: 35, height: 35, borderRadius: 5, borderWidth: 1,
        justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF'
    },
    statusBtnText: { fontWeight: 'bold', color: '#555', fontSize: 12 },
    
    input: {
        borderBottomWidth: 1, borderBottomColor: '#CCC', height: 35, fontSize: 12, padding: 0
    },
    
    footer: {
        position: 'absolute', bottom: 30, left: 0, right: 0, paddingHorizontal: 20,
        justifyContent: 'center', alignItems: 'center'
    },
    saveBtn: {
        backgroundColor: '#008080', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25,
        elevation: 5, width: '100%', alignItems: 'center'
    },
    saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
    
    emptyText: { textAlign: 'center', marginTop: 40, color: '#999', fontSize: 14 },
    
    legendContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 5, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#EEE' },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
    legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
    legendText: { fontSize: 11, color: '#666' }
});

export default StudentFeedback;