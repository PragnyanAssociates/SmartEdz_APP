/**
 * File: src/screens/report/MarksEntryScreen.js
 * Purpose: Teachers/Admins enter marks with role-based editing permissions.
 * Updated: Header Card Design Implementation.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TextInput,
    TouchableOpacity, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Changed to MaterialCommunityIcons for better set

// --- CONSTANTS ---
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

const EDITABLE_EXAM_TYPES = [
    'Assignment-1', 'Unitest-1',
    'Assignment-2', 'Unitest-2',
    'Assignment-3', 'Unitest-3',
    'Assignment-4', 'Unitest-4',
    'SA1', 'SA2'
];

const ALL_EXAM_OPTIONS = ['Overall', ...EDITABLE_EXAM_TYPES];

const EXAM_KEY_MAPPING = {
    'Assignment-1': 'AT1', 'Unitest-1': 'UT1', 'Assignment-2': 'AT2',
    'Unitest-2': 'UT2', 'Assignment-3': 'AT3', 'Unitest-3': 'UT3',
    'Assignment-4': 'AT4', 'Unitest-4': 'UT4', 'SA1': 'SA1', 'SA2': 'SA2',
    'Overall': 'Total'
};

const EXAM_DISPLAY_MAPPING = {
    'AT1': 'Assignment-1', 'UT1': 'Unitest-1', 'AT2': 'Assignment-2',
    'UT2': 'Unitest-2', 'AT3': 'Assignment-3', 'UT3': 'Unitest-3',
    'AT4': 'Assignment-4', 'UT4': 'Unitest-4', 'SA1': 'SA1', 'SA2': 'SA2',
    'Total': 'Overall'
};

const MONTHS = [
    'June', 'July', 'August', 'September', 'October', 'November',
    'December', 'January', 'February', 'March', 'April', 'May'
];

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    tableHeader: '#34495e',
    inputBorder: '#cbd5e1'
};

const MarksEntryScreen = ({ route, navigation }) => {
    const { classGroup } = route.params;
    const subjects = CLASS_SUBJECTS[classGroup] || [];

    const { user } = useAuth();
    const userRole = user?.role || 'teacher';
    const userId = user?.id; 

    const [students, setStudents] = useState([]);
    const [marksData, setMarksData] = useState({});
    const [attendanceData, setAttendanceData] = useState({});
    const [teacherAssignments, setTeacherAssignments] = useState([]);

    const [selectedExam, setSelectedExam] = useState('Overall');
    const [viewMode, setViewMode] = useState('marks');
    const [sortOrder, setSortOrder] = useState('rollno');
    
    const [isEditing, setIsEditing] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchClassData();
    }, [classGroup]);
    
    useEffect(() => {
        setIsEditing(true);
    }, [selectedExam, viewMode]);

    const fetchClassData = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/reports/class-data/${classGroup}`);
            const { students, marks, attendance, assignments } = response.data;

            setStudents(students);
            setTeacherAssignments(assignments || []);

            const marksMap = {};
            students.forEach(student => {
                marksMap[student.id] = {};
                subjects.forEach(subject => {
                    marksMap[student.id][subject] = {};
                    EDITABLE_EXAM_TYPES.forEach(exam => {
                        marksMap[student.id][subject][exam] = '';
                    });
                });
            });

            marks.forEach(mark => {
                if (marksMap[mark.student_id] && marksMap[mark.student_id][mark.subject]) {
                    const displayExamType = EXAM_DISPLAY_MAPPING[mark.exam_type];
                    if (displayExamType && EDITABLE_EXAM_TYPES.includes(displayExamType)) {
                        marksMap[mark.student_id][mark.subject][displayExamType] =
                            mark.marks_obtained !== null ? mark.marks_obtained.toString() : '';
                    }
                }
            });

            setMarksData(marksMap);

            const attendanceMap = {};
            students.forEach(student => {
                attendanceMap[student.id] = {};
                MONTHS.forEach(month => {
                    attendanceMap[student.id][month] = { working_days: '', present_days: '' };
                });
            });

            attendance.forEach(att => {
                if (attendanceMap[att.student_id]) {
                    attendanceMap[att.student_id][att.month] = {
                        working_days: att.working_days !== null ? att.working_days.toString() : '',
                        present_days: att.present_days !== null ? att.present_days.toString() : ''
                    };
                }
            });

            setAttendanceData(attendanceMap);
        } catch (error) {
            console.error('Error fetching class data:', error);
            Alert.alert('Error', 'Failed to load class data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchClassData();
    }, [classGroup]);

    const updateMarks = (studentId, subject, examType, value) => {
        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subject]: {
                    ...prev[studentId][subject],
                    [examType]: value
                }
            }
        }));
    };

    const updateAttendance = (studentId, month, field, value) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [month]: {
                    ...prev[studentId][month],
                    [field]: value
                }
            }
        }));
    };

    const calculateOverallForSubject = (studentId, subject) => {
        const studentMarks = marksData[studentId]?.[subject] || {};
        let total = 0;
        EDITABLE_EXAM_TYPES.forEach(examType => {
            const marks = parseFloat(studentMarks[examType]) || 0;
            total += marks;
        });
        return total > 0 ? total : '';
    };

    const calculateStudentGrandTotal = (studentId) => {
        let total = 0;
        subjects.forEach(subject => {
            const overall = calculateOverallForSubject(studentId, subject);
            total += parseFloat(overall) || 0;
        });
        return total;
    };

    const getSortedStudents = () => {
        if (sortOrder === 'rollno') {
            return [...students].sort((a, b) => a.roll_no - b.roll_no);
        }
        const studentsWithTotals = students.map(student => ({
            ...student,
            totalMarks: calculateStudentGrandTotal(student.id)
        }));
        if (sortOrder === 'descending') {
            return studentsWithTotals.sort((a, b) => b.totalMarks - a.totalMarks);
        } else if (sortOrder === 'ascending') {
            return studentsWithTotals.sort((a, b) => a.totalMarks - b.totalMarks);
        }
        return studentsWithTotals;
    };

    const handleSave = async () => {
        if (viewMode === 'marks') {
            await saveMarks();
        } else {
            await saveAttendance();
        }
    };

    const saveMarks = async () => {
        setSaving(true);
        const marksPayload = [];
        students.forEach(student => {
            subjects.forEach(subject => {
                EDITABLE_EXAM_TYPES.forEach(examDisplayType => {
                    const examKey = EXAM_KEY_MAPPING[examDisplayType];
                    const marksValue = marksData[student.id]?.[subject]?.[examDisplayType] || '';
                    if (examKey) {
                        marksPayload.push({ student_id: student.id, class_group: classGroup, subject: subject, exam_type: examKey, marks_obtained: marksValue === '' ? null : marksValue });
                    }
                });
                const overallValue = calculateOverallForSubject(student.id, subject);
                marksPayload.push({ student_id: student.id, class_group: classGroup, subject: subject, exam_type: 'Total', marks_obtained: overallValue === '' ? null : overallValue });
            });
        });
        try {
            await apiClient.post('/reports/marks/bulk', { marksPayload });
            Alert.alert('Success', 'Marks saved successfully! Progress reports updated.');
            setIsEditing(false); 
            fetchClassData();
        } catch (error) {
            console.error('Error saving marks:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to save marks');
        } finally {
            setSaving(false);
        }
    };

    const saveAttendance = async () => {
        setSaving(true);
        const attendancePayload = [];
        students.forEach(student => {
            MONTHS.forEach(month => {
                const att = attendanceData[student.id]?.[month] || {};
                attendancePayload.push({ student_id: student.id, month, working_days: att.working_days === '' ? null : att.working_days, present_days: att.present_days === '' ? null : att.present_days });
            });
        });
        try {
            await apiClient.post('/reports/attendance/bulk', { attendancePayload });
            Alert.alert('Success', 'Attendance saved successfully!');
        } catch (error) {
            console.error('Error saving attendance:', error);
            Alert.alert('Error', 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    const sortedStudents = getSortedStudents();
    const isOverallView = selectedExam === 'Overall';
    const canEditScreen = !isOverallView && isEditing;

    return (
        <View style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <Icon name="file-document-edit-outline" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>{classGroup}</Text>
                        <Text style={styles.headerSubtitle}>Data Entry</Text>
                    </View>
                </View>
                
                {/* Admin Actions */}
                {userRole === 'admin' && (
                    <TouchableOpacity style={styles.headerActionBtn} onPress={() => navigation.navigate('TeacherAssignment', { classGroup })}>
                        <Icon name="account-plus" size={22} color="#008080" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Mode Toggle Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabButton, viewMode === 'marks' && styles.tabButtonActive]} onPress={() => setViewMode('marks')}>
                    <Text style={[styles.tabText, viewMode === 'marks' && styles.tabTextActive]}>Marks Entry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, viewMode === 'attendance' && styles.tabButtonActive]} onPress={() => setViewMode('attendance')}>
                    <Text style={[styles.tabText, viewMode === 'attendance' && styles.tabTextActive]}>Attendance</Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'marks' && (
                <>
                    {/* Filters for Marks */}
                    <View style={styles.filterContainer}>
                        <View style={styles.filterBox}>
                            <Picker selectedValue={selectedExam} onValueChange={setSelectedExam} style={styles.picker}>
                                {ALL_EXAM_OPTIONS.map(exam => <Picker.Item key={exam} label={exam} value={exam} />)}
                            </Picker>
                        </View>
                        <View style={styles.filterBox}>
                            <Picker selectedValue={sortOrder} onValueChange={setSortOrder} style={styles.picker}>
                                <Picker.Item label="Roll No" value="rollno" />
                                <Picker.Item label="High to Low" value="descending" />
                                <Picker.Item label="Low to High" value="ascending" />
                            </Picker>
                        </View>
                    </View>

                    <ScrollView>
                        <ScrollView horizontal>
                            <View style={styles.tableWrapper}>
                                <View style={styles.tableRow}>
                                    <View style={[styles.cellHeader, styles.cellRollNo]}><Text style={styles.headerText}>Roll No</Text></View>
                                    <View style={[styles.cellHeader, styles.cellName]}><Text style={styles.headerText}>Name</Text></View>
                                    {subjects.map(subject => (
                                        <View key={subject} style={[styles.cellHeader, styles.cellSubject]}><Text style={styles.headerText}>{subject}</Text></View>
                                    ))}
                                    <View style={[styles.cellHeader, styles.cellTotal]}><Text style={styles.headerText}>Total</Text></View>
                                    <View style={[styles.cellHeader, styles.cellTotal, styles.grandTotalHeader]}><Text style={styles.headerText}>Grand Total</Text></View>
                                </View>

                                {sortedStudents.map(student => {
                                    const studentGrandTotal = calculateStudentGrandTotal(student.id);
                                    return (
                                        <View key={student.id} style={styles.tableRow}>
                                            <View style={[styles.cell, styles.cellRollNo]}><Text style={styles.cellText}>{student.roll_no}</Text></View>
                                            <View style={[styles.cell, styles.cellName]}><Text style={styles.cellText}>{student.full_name}</Text></View>
                                            
                                            {subjects.map(subject => {
                                                const canUserEditSubject = () => {
                                                    if (userRole === 'admin') return true;
                                                    const assignment = teacherAssignments.find(a => a.subject === subject);
                                                    if (assignment) return assignment.teacher_id === userId;
                                                    return false;
                                                };

                                                const isEditable = canEditScreen && canUserEditSubject();
                                                const displayValue = isOverallView 
                                                    ? (calculateOverallForSubject(student.id, subject) || '').toString()
                                                    : (marksData[student.id]?.[subject]?.[selectedExam] || '');

                                                return (
                                                    <View key={subject} style={[styles.cell, styles.cellSubject]}>
                                                        <TextInput
                                                            style={[styles.input, !isEditable && styles.inputDisabled, isOverallView && styles.inputOverallView]}
                                                            keyboardType="numeric"
                                                            maxLength={isOverallView ? 4 : 3}
                                                            value={displayValue}
                                                            onChangeText={(val) => updateMarks(student.id, subject, selectedExam, val)}
                                                            editable={isEditable}
                                                            placeholder="-"
                                                            placeholderTextColor="#999"
                                                        />
                                                    </View>
                                                );
                                            })}

                                            <View style={[styles.cell, styles.cellTotal]}>
                                                <Text style={[styles.cellText, styles.overallText]}>
                                                    {subjects.reduce((sum, subject) => {
                                                        const marks = isOverallView ? parseFloat(calculateOverallForSubject(student.id, subject)) || 0 : parseFloat(marksData[student.id]?.[subject]?.[selectedExam]) || 0;
                                                        return sum + marks;
                                                    }, 0) || '-'}
                                                </Text>
                                            </View>
                                            <View style={[styles.cell, styles.cellTotal, styles.grandTotalCell]}>
                                                <Text style={[styles.cellText, styles.totalText]}>{studentGrandTotal || '-'}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </ScrollView>
                </>
            )}

            {viewMode === 'attendance' && (
                <ScrollView>
                    <ScrollView horizontal refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                        <View style={styles.tableWrapper}>
                            <View style={styles.tableRow}>
                                <View style={[styles.cellHeader, styles.cellRollNo]}><Text style={styles.headerText}>Roll No</Text></View>
                                <View style={[styles.cellHeader, styles.cellName]}><Text style={styles.headerText}>Name</Text></View>
                                {MONTHS.map(month => (
                                    <View key={month} style={[styles.cellHeader, styles.cellAttendance]}>
                                        <Text style={styles.headerText}>{month}</Text>
                                        <Text style={styles.subHeaderText}>(W / P)</Text>
                                    </View>
                                ))}
                            </View>
                            {students.map(student => (
                                <View key={student.id} style={styles.tableRow}>
                                    <View style={[styles.cell, styles.cellRollNo]}><Text style={styles.cellText}>{student.roll_no}</Text></View>
                                    <View style={[styles.cell, styles.cellName]}><Text style={styles.cellText}>{student.full_name}</Text></View>
                                    {MONTHS.map(month => {
                                        const att = attendanceData[student.id]?.[month] || {};
                                        return (
                                            <View key={month} style={[styles.cell, styles.cellAttendance]}>
                                                <View style={styles.attendanceInputContainer}>
                                                    <TextInput style={[styles.input, styles.attendanceInput]} keyboardType="numeric" maxLength={2} placeholder="W" value={att.working_days} onChangeText={(val) => updateAttendance(student.id, month, 'working_days', val)} />
                                                    <Text style={styles.attendanceSeparator}>/</Text>
                                                    <TextInput style={[styles.input, styles.attendanceInput]} keyboardType="numeric" maxLength={2} placeholder="P" value={att.present_days} onChangeText={(val) => updateAttendance(student.id, month, 'present_days', val)} />
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </ScrollView>
            )}

            {/* Action Buttons */}
            {viewMode === 'attendance' ? (
                <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </TouchableOpacity>
            ) : viewMode === 'marks' && !isOverallView ? (
                isEditing ? (
                    <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Marks</Text>}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
                        <Icon name="pencil" size={20} color="#fff" style={{marginRight: 5}}/>
                        <Text style={styles.editButtonText}>Edit Marks</Text>
                    </TouchableOpacity>
                )
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
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
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333333' },
    headerSubtitle: { fontSize: 13, color: '#666666' },
    headerActionBtn: {
        padding: 8,
        backgroundColor: '#f0fdfa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccfbf1'
    },

    // --- TABS ---
    tabContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 5, backgroundColor: COLORS.background, elevation: 0, marginBottom: 10 },
    tabButton: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center' },
    tabButtonActive: { borderBottomColor: COLORS.primary },
    tabText: { fontSize: 16, color: COLORS.textSub, fontWeight: '500' },
    tabTextActive: { color: COLORS.primary, fontWeight: 'bold' },

    // --- FILTERS ---
    filterContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 15, marginBottom: 10 },
    filterBox: { flex: 1, backgroundColor: '#FFF', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#cbd5e1', height: 45, justifyContent: 'center' },
    picker: { width: '100%', color: COLORS.textMain },

    // --- TABLE ---
    tableWrapper: { marginHorizontal: 15, paddingBottom: 20 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd' },
    cellHeader: { backgroundColor: COLORS.tableHeader, padding: 12, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#2c3e50' },
    cell: { backgroundColor: '#fff', padding: 8, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f0f2f5' },
    
    // Column Widths
    cellRollNo: { width: 70 },
    cellName: { width: 160 },
    cellSubject: { width: 90 },
    cellTotal: { width: 90, backgroundColor: '#e8f5e9' },
    grandTotalHeader: { backgroundColor: '#27ae60' },
    grandTotalCell: { backgroundColor: '#c8e6c9' },
    cellAttendance: { width: 120 },

    headerText: { fontSize: 13, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    subHeaderText: { fontSize: 10, color: '#ecf0f1', marginTop: 2 },
    cellText: { fontSize: 13, color: '#2c3e50', textAlign: 'center' },
    overallText: { fontWeight: 'bold', color: '#1b5e20' },
    totalText: { fontWeight: 'bold', color: '#1b5e20', fontSize: 14 },

    // Inputs
    input: { borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 6, padding: 5, textAlign: 'center', fontSize: 14, backgroundColor: '#fff', width: '100%', height: 40 },
    inputDisabled: { backgroundColor: '#f8fafc', color: '#94a3b8', borderWidth: 0 },
    inputOverallView: { backgroundColor: '#e9ecef', color: '#495057', fontWeight: 'bold' },
    
    attendanceInputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 5 },
    attendanceInput: { flex: 1, minWidth: 35, textAlign: 'center' },
    attendanceSeparator: { fontSize: 16, color: '#94a3b8' },

    // Buttons
    saveButton: { backgroundColor: COLORS.primary, padding: 14, margin: 15, borderRadius: 25, alignItems: 'center', elevation: 3 },
    saveButtonDisabled: { backgroundColor: '#95a5a6' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    
    editButton: { backgroundColor: '#e67e22', padding: 14, margin: 15, borderRadius: 25, alignItems: 'center', elevation: 3, flexDirection: 'row', justifyContent: 'center' },
    editButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default MarksEntryScreen;