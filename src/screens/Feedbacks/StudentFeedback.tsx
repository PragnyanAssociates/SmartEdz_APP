import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
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
        } catch (error) { console.error('Error fetching teachers', error); }
    };

    const fetchAssignedClasses = async (teacherId: number) => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/teacher-classes/${teacherId}`);
            const classes = response.data;
            setAssignedClasses(classes);
            if (classes.length > 0) setSelectedClass(classes[0]);
            else {
                setSelectedClass('');
                setStudents([]);
            }
        } catch (error) { Alert.alert('Error', 'Could not load assigned classes.'); } 
        finally { setLoading(false); }
    };

    const fetchStudentData = useCallback(async () => {
        if (!selectedTeacherId || !selectedClass) return;

        setLoading(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const response = await apiClient.get('/feedback/students', {
                params: { class_group: selectedClass, teacher_id: selectedTeacherId, date: dateStr }
            });
            
            const formattedData = response.data.map((s: any) => ({
                ...s,
                behavior_status: s.behavior_status || null, // Default to null if undefined
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

    // Fetch data when filters change
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
            Alert.alert("Success", "Student behavior updated!");
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
        if (user?.role === 'admin') return; 
        setStudents(prev => prev.map(s => {
            if (s.student_id === id) return { ...s, [field]: value };
            return s;
        }));
        setHasChanges(true);
    };

    const onDateChange = (event: any, date?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (date) setSelectedDate(date);
    };

    // --- Components ---
    const StatusButton = ({ label, currentStatus, targetStatus, color, onPress, disabled }: any) => {
        const isSelected = currentStatus === targetStatus;
        return (
            <TouchableOpacity 
                style={[
                    styles.statusBtn, 
                    isSelected ? { backgroundColor: color, borderColor: color } : { borderColor: '#E0E0E0', backgroundColor: '#FFF' }
                ]}
                onPress={onPress}
                disabled={disabled}
            >
                <Text style={[styles.statusBtnText, isSelected ? { color: '#FFF' } : { color: '#757575' }]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    const formattedDate = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                         <MaterialIcons name="fact-check" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Behaviour</Text>
                        <Text style={styles.headerSubtitle}>Daily Tracking</Text>
                    </View>
                </View>
                
                {/* Date Picker Button (Top Right) */}
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateBadge}>
                    <Text style={styles.dateText}>{formattedDate}</Text>
                    <MaterialIcons name="calendar-today" size={16} color="#008080" />
                </TouchableOpacity>
            </View>

            {showDatePicker && (
                <DateTimePicker value={selectedDate} mode="date" display="default" onChange={onDateChange} />
            )}

            {/* Filters */}
            <View style={styles.filterContainer}>
                {user?.role === 'admin' && (
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={selectedTeacherId?.toString()}
                            onValueChange={(itemValue) => {
                                const tId = parseInt(itemValue);
                                setSelectedTeacherId(tId);
                                fetchAssignedClasses(tId);
                            }}
                            style={styles.picker}
                        >
                            <Picker.Item label="-- Select Teacher --" value="" color="#94a3b8"/>
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
                        dropdownIconColor="#008080"
                    >
                        {assignedClasses.length === 0 ? (
                            <Picker.Item label="No Classes Found" value="" color="#94a3b8" />
                        ) : (
                            assignedClasses.map(c => <Picker.Item key={c} label={c} value={c} />)
                        )}
                    </Picker>
                </View>
            </View>

            {/* Table Header */}
            <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: 40 }]}>Roll</Text>
                <Text style={[styles.th, { flex: 1 }]}>Student Name</Text>
                <Text style={[styles.th, { width: 130, textAlign: 'center' }]}>Status</Text>
                <Text style={[styles.th, { width: 80, marginLeft: 5 }]}>Remarks</Text>
            </View>

            {/* List */}
            {loading ? (
                <ActivityIndicator size="large" color="#008080" style={{ marginTop: 40 }} />
            ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    {students.length > 0 ? (
                        students.map((item, index) => (
                            <View key={item.student_id} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                                {/* Roll & Name */}
                                <Text style={[styles.td, { width: 40, fontWeight: 'bold', color: '#333' }]}>{item.roll_no || '-'}</Text>
                                <Text style={[styles.td, { flex: 1, color: '#444' }]} numberOfLines={1}>{item.full_name}</Text>
                                
                                {/* Status Buttons */}
                                <View style={{ width: 130, flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <StatusButton 
                                        label="G" targetStatus="Good" currentStatus={item.behavior_status} 
                                        color="#00C853" // Green
                                        disabled={user?.role === 'admin'}
                                        onPress={() => updateStudentFeedback(item.student_id, 'behavior_status', 'Good')}
                                    />
                                    <StatusButton 
                                        label="A" targetStatus="Average" currentStatus={item.behavior_status} 
                                        color="#2962FF" // Blue
                                        disabled={user?.role === 'admin'}
                                        onPress={() => updateStudentFeedback(item.student_id, 'behavior_status', 'Average')}
                                    />
                                    <StatusButton 
                                        label="P" targetStatus="Poor" currentStatus={item.behavior_status} 
                                        color="#D50000" // Red
                                        disabled={user?.role === 'admin'}
                                        onPress={() => updateStudentFeedback(item.student_id, 'behavior_status', 'Poor')}
                                    />
                                </View>

                                {/* Remarks Input (Scrollable if long text) */}
                                <View style={{ width: 80, marginLeft: 8 }}>
                                    <TextInput 
                                        style={styles.input}
                                        placeholder="..."
                                        placeholderTextColor="#BDBDBD"
                                        value={item.remarks}
                                        editable={user?.role !== 'admin'}
                                        onChangeText={(text) => updateStudentFeedback(item.student_id, 'remarks', text)}
                                    />
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyContainer}>
                             <MaterialIcons name="person-off" size={40} color="#CFD8DC" />
                             <Text style={styles.emptyText}>
                                {assignedClasses.length === 0 ? "No classes assigned." : "No students found."}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Footer Actions (Legend & Save) */}
            <View style={styles.footerContainer}>
                <View style={styles.legendContainer}>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#00C853' }]} /><Text style={styles.legendText}>Good</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2962FF' }]} /><Text style={styles.legendText}>Avg</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#D50000' }]} /><Text style={styles.legendText}>Poor</Text></View>
                </View>

                {user?.role === 'teacher' && hasChanges && (
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff"/> : (
                            <>
                                <MaterialIcons name="save" size={20} color="#fff" style={{marginRight:5}} />
                                <Text style={styles.saveBtnText}>Save</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F6F8' }, 
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '94%', 
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 2,
        shadowColor: '#000', 
        shadowOpacity: 0.05, 
        shadowRadius: 3, 
        shadowOffset: { width: 0, height: 1 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 42,
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    headerSubtitle: { fontSize: 12, color: '#666' },
    
    dateBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2F1', 
        paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: '#B2DFDB'
    },
    dateText: { marginRight: 6, color: '#00796B', fontWeight: 'bold', fontSize: 13 },
    
    // Filters
    filterContainer: { paddingHorizontal: 15, marginBottom: 5 },
    pickerWrapper: {
        borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, marginBottom: 10,
        backgroundColor: '#fff', overflow: 'hidden', height: 45, justifyContent: 'center'
    },
    picker: { width: '100%', color: '#333' },
    
    // Table
    tableHeader: {
        flexDirection: 'row', backgroundColor: '#E8EAF6', paddingVertical: 12, paddingHorizontal: 15,
        borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#C5CAE9'
    },
    th: { fontWeight: 'bold', color: '#3F51B5', fontSize: 13 },
    
    // Rows
    row: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0', backgroundColor: '#FFF', minHeight: 60
    },
    rowAlt: { backgroundColor: '#FAFAFA' },
    td: { fontSize: 13 },
    
    // Buttons
    statusBtn: {
        width: 38, height: 38, borderRadius: 8, borderWidth: 1,
        justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF'
    },
    statusBtnText: { fontWeight: 'bold', fontSize: 14 },
    
    // Input
    input: {
        borderBottomWidth: 1, borderBottomColor: '#CFD8DC', height: 40, fontSize: 13, padding: 0, color: '#333'
    },
    
    // Footer
    footerContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', 
        borderTopWidth: 1, borderTopColor: '#EEEEEE', paddingVertical: 10, paddingHorizontal: 15,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 10
    },
    legendContainer: { flexDirection: 'row', alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
    legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
    legendText: { fontSize: 12, color: '#666' },

    saveBtn: {
        backgroundColor: '#333', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25,
        flexDirection: 'row', alignItems: 'center', elevation: 2
    },
    saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { textAlign: 'center', marginTop: 10, color: '#B0BEC5', fontSize: 14 },
});

export default StudentFeedback;