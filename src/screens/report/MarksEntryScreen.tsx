/**
 * File: src/screens/report/MarksEntryScreen.js
 * Purpose: Teachers/Admins enter marks - Full editable table with all subjects
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TextInput,
    TouchableOpacity, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';


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


const EXAM_TYPES = [
    'Assignment-1', 'Assignment-2', 'Assignment-3', 'Assignment-4',
    'Unitest-1', 'Unitest-2', 'Unitest-3', 'Unitest-4',
    'SA1', 'SA2'
];


const MONTHS = [
    'June', 'July', 'August', 'September', 'October', 'November',
    'December', 'January', 'February', 'March', 'April', 'May'
];


const MarksEntryScreen = ({ route, navigation }) => {
    const { classGroup } = route.params;
    const subjects = CLASS_SUBJECTS[classGroup] || [];


    const { user } = useAuth();
    const userRole = user?.role || 'teacher';


    const [students, setStudents] = useState([]);
    const [marksData, setMarksData] = useState({});
    const [attendanceData, setAttendanceData] = useState({});
    const [teacherPermissions, setTeacherPermissions] = useState({});
    
    const [selectedExam, setSelectedExam] = useState('Assignment-1');
    const [viewMode, setViewMode] = useState('marks');
    const [sortOrder, setSortOrder] = useState('rollno');
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);


    useEffect(() => {
        fetchClassData();
    }, [classGroup]);


    useEffect(() => {
        if (userRole === 'admin') {
            navigation.setOptions({
                headerRight: () => (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('TeacherAssignment', { classGroup })}
                        style={{ marginRight: 15 }}
                    >
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                            Assign Teachers
                        </Text>
                    </TouchableOpacity>
                )
            });
        }
    }, [navigation, classGroup, userRole]);


    const fetchClassData = async () => {
        try {
            const response = await apiClient.get(`/reports/class-data/${classGroup}`);
            const { students, marks, attendance, teacherPermissions } = response.data;


            setStudents(students);
            setTeacherPermissions(teacherPermissions || {});


            // Organize marks by student -> subject -> exam_type
            const marksMap = {};
            students.forEach(student => {
                marksMap[student.id] = {};
                subjects.forEach(subject => {
                    marksMap[student.id][subject] = {};
                    EXAM_TYPES.forEach(exam => {
                        marksMap[student.id][subject][exam] = '';
                    });
                });
            });


            marks.forEach(mark => {
                if (marksMap[mark.student_id] && marksMap[mark.student_id][mark.subject]) {
                    marksMap[mark.student_id][mark.subject][mark.exam_type] = 
                        mark.marks_obtained !== null ? mark.marks_obtained.toString() : '';
                }
            });


            setMarksData(marksMap);


            // Organize attendance
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


    // Calculate Overall for a specific subject for a specific student
    // Overall = Sum of ALL entered marks across all exams
    const calculateOverallForSubject = (studentId, subject) => {
        const studentMarks = marksData[studentId]?.[subject] || {};
        
        let total = 0;
        EXAM_TYPES.forEach(examType => {
            const marks = parseFloat(studentMarks[examType]) || 0;
            total += marks;
        });
        
        return total > 0 ? total : '';
    };


    // Calculate student's total marks across all subjects (sum of all subject overalls)
    const calculateStudentTotal = (studentId) => {
        let total = 0;
        subjects.forEach(subject => {
            const overall = calculateOverallForSubject(studentId, subject);
            total += parseFloat(overall) || 0;
        });
        return total;
    };


    // Sort students based on selected sort order
    const getSortedStudents = () => {
        if (sortOrder === 'rollno') {
            return [...students];
        }
        
        const studentsWithTotals = students.map(student => ({
            ...student,
            totalMarks: calculateStudentTotal(student.id)
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
                // Save all exam types including calculated Overall
                EXAM_TYPES.forEach(examType => {
                    const marksValue = marksData[student.id]?.[subject]?.[examType] || '';
                    
                    marksPayload.push({
                        student_id: student.id,
                        class_group: classGroup,
                        subject: subject,
                        exam_type: examType,
                        marks_obtained: marksValue === '' ? null : marksValue
                    });
                });


                // Calculate and save Overall
                const overallValue = calculateOverallForSubject(student.id, subject);
                marksPayload.push({
                    student_id: student.id,
                    class_group: classGroup,
                    subject: subject,
                    exam_type: 'Overall',
                    marks_obtained: overallValue === '' ? null : overallValue
                });
            });
        });


        try {
            await apiClient.post('/reports/marks/bulk', { marksPayload });
            Alert.alert('Success', 'Marks saved successfully! Progress reports updated.');
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
                attendancePayload.push({
                    student_id: student.id,
                    month,
                    working_days: att.working_days === '' ? null : att.working_days,
                    present_days: att.present_days === '' ? null : att.present_days
                });
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


    const toggleSortOrder = () => {
        if (sortOrder === 'rollno') {
            setSortOrder('descending');
        } else if (sortOrder === 'descending') {
            setSortOrder('ascending');
        } else {
            setSortOrder('rollno');
        }
    };


    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#2c3e50" />
            </View>
        );
    }


    const sortedStudents = getSortedStudents();


    return (
        <View style={styles.container}>
            {/* Mode Selection */}
            <View style={styles.modeToggle}>
                <TouchableOpacity
                    style={[styles.modeButton, viewMode === 'marks' && styles.modeButtonActive]}
                    onPress={() => setViewMode('marks')}
                >
                    <Text style={[styles.modeButtonText, viewMode === 'marks' && styles.modeButtonTextActive]}>
                        Marks Entry
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.modeButton, viewMode === 'attendance' && styles.modeButtonActive]}
                    onPress={() => setViewMode('attendance')}
                >
                    <Text style={[styles.modeButtonText, viewMode === 'attendance' && styles.modeButtonTextActive]}>
                        Attendance
                    </Text>
                </TouchableOpacity>
            </View>


            {/* Marks View */}
            {viewMode === 'marks' && (
                <>
                    {/* Exam Dropdown + Sort Filter */}
                    <View style={styles.controlsRow}>
                        <View style={styles.pickerSection}>
                            <Text style={styles.label}>Exam:</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={selectedExam}
                                    onValueChange={setSelectedExam}
                                >
                                    {EXAM_TYPES.map(exam => (
                                        <Picker.Item key={exam} label={exam} value={exam} />
                                    ))}
                                </Picker>
                            </View>
                        </View>


                        <TouchableOpacity style={styles.sortButton} onPress={toggleSortOrder}>
                            <Icon 
                                name={
                                    sortOrder === 'rollno' ? 'list' : 
                                    sortOrder === 'descending' ? 'arrow-down' : 
                                    'arrow-up'
                                } 
                                size={20} 
                                color="#fff" 
                            />
                            <Text style={styles.sortButtonText}>
                                {sortOrder === 'rollno' ? 'Roll No' : 
                                 sortOrder === 'descending' ? 'High→Low' : 'Low→High'}
                            </Text>
                        </TouchableOpacity>
                    </View>


                    <ScrollView 
                        horizontal 
                        style={styles.tableScrollView}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    >
                        <View>
                            {/* Header Row */}
                            <View style={styles.tableRow}>
                                <View style={[styles.cellHeader, styles.cellRollNo]}>
                                    <Text style={styles.headerText}>Roll No</Text>
                                </View>
                                <View style={[styles.cellHeader, styles.cellName]}>
                                    <Text style={styles.headerText}>Name</Text>
                                </View>
                                {/* All Subjects as Columns */}
                                {subjects.map(subject => (
                                    <View key={subject} style={[styles.cellHeader, styles.cellSubject]}>
                                        <Text style={styles.headerText}>{subject}</Text>
                                    </View>
                                ))}
                                {/* Overall Column */}
                                <View style={[styles.cellHeader, styles.cellTotal]}>
                                    <Text style={styles.headerText}>Overall</Text>
                                </View>
                                {/* Total Column */}
                                <View style={[styles.cellHeader, styles.cellTotal]}>
                                    <Text style={styles.headerText}>Total</Text>
                                </View>
                            </View>


                            {/* Student Rows */}
                            {sortedStudents.map(student => {
                                const studentTotal = calculateStudentTotal(student.id);
                                
                                return (
                                    <View key={student.id} style={styles.tableRow}>
                                        <View style={[styles.cell, styles.cellRollNo]}>
                                            <Text style={styles.cellText}>{student.roll_no}</Text>
                                        </View>
                                        <View style={[styles.cell, styles.cellName]}>
                                            <Text style={styles.cellText}>{student.full_name}</Text>
                                        </View>
                                        
                                        {/* Each Subject Column - Editable marks for selected exam */}
                                        {subjects.map(subject => {
                                            const permission = teacherPermissions[subject];
                                            const canEdit = permission?.canEdit || userRole === 'admin';
                                            const displayValue = marksData[student.id]?.[subject]?.[selectedExam] || '';


                                            return (
                                                <View key={subject} style={[styles.cell, styles.cellSubject]}>
                                                    <TextInput
                                                        style={[styles.input, !canEdit && styles.inputDisabled]}
                                                        keyboardType="numeric"
                                                        maxLength={3}
                                                        value={displayValue}
                                                        onChangeText={(val) => updateMarks(student.id, subject, selectedExam, val)}
                                                        editable={canEdit}
                                                        placeholder="-"
                                                    />
                                                </View>
                                            );
                                        })}


                                        {/* Overall Column - Shows sum of all subjects for selected exam */}
                                        <View style={[styles.cell, styles.cellTotal]}>
                                            <Text style={[styles.cellText, styles.overallText]}>
                                                {subjects.reduce((sum, subject) => {
                                                    const marks = parseFloat(marksData[student.id]?.[subject]?.[selectedExam]) || 0;
                                                    return sum + marks;
                                                }, 0) || '-'}
                                            </Text>
                                        </View>


                                        {/* Total Column - Sum of ALL subjects' overall marks */}
                                        <View style={[styles.cell, styles.cellTotal]}>
                                            <Text style={[styles.cellText, styles.totalText]}>
                                                {studentTotal || '-'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}


                            {/* Total Row at Bottom */}
                            <View style={[styles.tableRow, styles.totalRow]}>
                                <View style={[styles.cellHeader, styles.cellRollNo]}>
                                    <Text style={styles.headerText}>-</Text>
                                </View>
                                <View style={[styles.cellHeader, styles.cellName]}>
                                    <Text style={styles.headerText}>Total</Text>
                                </View>
                                
                                {/* Calculate column totals for each subject */}
                                {subjects.map(subject => {
                                    const columnTotal = sortedStudents.reduce((sum, student) => {
                                        const marks = parseFloat(marksData[student.id]?.[subject]?.[selectedExam]) || 0;
                                        return sum + marks;
                                    }, 0);


                                    return (
                                        <View key={subject} style={[styles.cellHeader, styles.cellSubject]}>
                                            <Text style={styles.headerText}>{columnTotal || '-'}</Text>
                                        </View>
                                    );
                                })}


                                {/* Overall total */}
                                <View style={[styles.cellHeader, styles.cellTotal]}>
                                    <Text style={styles.headerText}>
                                        {sortedStudents.reduce((sum, student) => {
                                            const studentExamTotal = subjects.reduce((subSum, subject) => {
                                                const marks = parseFloat(marksData[student.id]?.[subject]?.[selectedExam]) || 0;
                                                return subSum + marks;
                                            }, 0);
                                            return sum + studentExamTotal;
                                        }, 0) || '-'}
                                    </Text>
                                </View>


                                {/* Grand Total */}
                                <View style={[styles.cellHeader, styles.cellTotal]}>
                                    <Text style={styles.headerText}>
                                        {sortedStudents.reduce((sum, student) => {
                                            return sum + calculateStudentTotal(student.id);
                                        }, 0) || '-'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </>
            )}


            {/* Attendance View */}
            {viewMode === 'attendance' && (
                <ScrollView 
                    horizontal 
                    style={styles.tableScrollView}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    <View>
                        <View style={styles.tableRow}>
                            <View style={[styles.cellHeader, styles.cellRollNo]}>
                                <Text style={styles.headerText}>Roll No</Text>
                            </View>
                            <View style={[styles.cellHeader, styles.cellName]}>
                                <Text style={styles.headerText}>Name</Text>
                            </View>
                            {MONTHS.map(month => (
                                <View key={month} style={[styles.cellHeader, styles.cellAttendance]}>
                                    <Text style={styles.headerText}>{month}</Text>
                                    <Text style={styles.subHeaderText}>(W / P)</Text>
                                </View>
                            ))}
                        </View>


                        {students.map(student => (
                            <View key={student.id} style={styles.tableRow}>
                                <View style={[styles.cell, styles.cellRollNo]}>
                                    <Text style={styles.cellText}>{student.roll_no}</Text>
                                </View>
                                <View style={[styles.cell, styles.cellName]}>
                                    <Text style={styles.cellText}>{student.full_name}</Text>
                                </View>
                                {MONTHS.map(month => {
                                    const att = attendanceData[student.id]?.[month] || {};
                                    return (
                                        <View key={month} style={[styles.cell, styles.cellAttendance]}>
                                            <View style={styles.attendanceInputContainer}>
                                                <TextInput
                                                    style={[styles.input, styles.attendanceInput]}
                                                    keyboardType="numeric"
                                                    maxLength={2}
                                                    placeholder="W"
                                                    value={att.working_days}
                                                    onChangeText={(val) => updateAttendance(student.id, month, 'working_days', val)}
                                                />
                                                <Text style={styles.attendanceSeparator}>/</Text>
                                                <TextInput
                                                    style={[styles.input, styles.attendanceInput]}
                                                    keyboardType="numeric"
                                                    maxLength={2}
                                                    placeholder="P"
                                                    value={att.present_days}
                                                    onChangeText={(val) => updateAttendance(student.id, month, 'present_days', val)}
                                                />
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}


            {/* Save Button */}
            <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5'
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modeToggle: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd'
    },
    modeButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: '#ecf0f1',
        marginHorizontal: 5,
        borderRadius: 8
    },
    modeButtonActive: {
        backgroundColor: '#2c3e50'
    },
    modeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#7f8c8d'
    },
    modeButtonTextActive: {
        color: '#fff'
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        justifyContent: 'space-between'
    },
    pickerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginRight: 10,
        color: '#2c3e50'
    },
    pickerContainer: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#bdc3c7',
        borderRadius: 8,
        backgroundColor: '#fff'
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3498db',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        gap: 5
    },
    sortButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14
    },
    tableScrollView: {
        flex: 1
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd'
    },
    totalRow: {
        backgroundColor: '#e8f5e9'
    },
    cellHeader: {
        backgroundColor: '#34495e',
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: '#2c3e50'
    },
    cell: {
        backgroundColor: '#fff',
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: '#ecf0f1'
    },
    cellRollNo: {
        width: 80
    },
    cellName: {
        width: 150
    },
    cellSubject: {
        width: 100
    },
    cellTotal: {
        width: 100,
        backgroundColor: '#d4edda'
    },
    cellAttendance: {
        width: 120
    },
    headerText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center'
    },
    subHeaderText: {
        fontSize: 11,
        color: '#ecf0f1',
        marginTop: 2
    },
    cellText: {
        fontSize: 14,
        color: '#2c3e50',
        textAlign: 'center'
    },
    overallText: {
        fontWeight: '600',
        color: '#e67e22',
        fontSize: 15
    },
    totalText: {
        fontWeight: 'bold',
        color: '#27ae60',
        fontSize: 16
    },
    input: {
        borderWidth: 1,
        borderColor: '#bdc3c7',
        borderRadius: 6,
        padding: 8,
        textAlign: 'center',
        fontSize: 14,
        backgroundColor: '#fff',
        width: '100%'
    },
    inputDisabled: {
        backgroundColor: '#ecf0f1',
        color: '#95a5a6'
    },
    attendanceInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%'
    },
    attendanceInput: {
        flex: 1,
        minWidth: 40
    },
    attendanceSeparator: {
        marginHorizontal: 4,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#7f8c8d'
    },
    saveButton: {
        backgroundColor: '#27ae60',
        padding: 16,
        margin: 15,
        borderRadius: 10,
        alignItems: 'center',
        elevation: 3
    },
    saveButtonDisabled: {
        backgroundColor: '#95a5a6'
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    }
});


export default MarksEntryScreen;