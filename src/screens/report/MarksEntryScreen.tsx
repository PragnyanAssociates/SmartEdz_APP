/**
 * File: src/screens/report/MarksEntryScreen.js
 * Purpose: Main screen for entering/editing student marks and attendance with Overall calculation
 */
import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    ActivityIndicator, Alert, TextInput, Dimensions
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';

const SCREEN_WIDTH = Dimensions.get('window').width;

const CLASS_SUBJECTS = {
    'LKG': ['All Subjects'],
    'UKG': ['All Subjects'],
    '1st Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    '2nd Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    '3rd Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    '4th Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    '5th Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    '6th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    '7th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    '8th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    '9th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    '10th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social']
};

const EXAM_TYPES = [
    'Assignment-1', 'Assignment-2', 'Assignment-3', 'Assignment-4',
    'Unitest-1', 'Unitest-2', 'Unitest-3', 'Unitest-4',
    'SA1', 'SA2', 'Overall'
];

const MONTHS = [
    'June', 'July', 'August', 'September', 'October',
    'November', 'December', 'January', 'February', 
    'March', 'April', 'May'
];

const MarksEntryScreen = ({ route, navigation }) => {
    const { classGroup } = route.params;
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [students, setStudents] = useState([]);
    const [marksData, setMarksData] = useState({});
    const [attendanceData, setAttendanceData] = useState({});
    const [teacherPermissions, setTeacherPermissions] = useState({});
    const [academicYear, setAcademicYear] = useState('');

    const [activeTab, setActiveTab] = useState('marks');
    const [selectedExam, setSelectedExam] = useState('Assignment-1');

    const subjects = CLASS_SUBJECTS[classGroup] || [];
    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        fetchClassData();
    }, [classGroup]);

    const fetchClassData = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/reports/class-data/${classGroup}`);
            const { students, marks, attendance, teacherPermissions, academicYear } = response.data;

            setStudents(students);
            setAcademicYear(academicYear);
            setTeacherPermissions(teacherPermissions || {});

            // Initialize marks data
            const marksMap = {};
            students.forEach(student => {
                marksMap[student.id] = {};
                subjects.forEach(subject => {
                    marksMap[student.id][subject] = {};
                    EXAM_TYPES.forEach(examType => {
                        marksMap[student.id][subject][examType] = '';
                    });
                });
            });

            // Fill existing marks
            marks.forEach(mark => {
                if (marksMap[mark.student_id] && marksMap[mark.student_id][mark.subject]) {
                    marksMap[mark.student_id][mark.subject][mark.exam_type] = 
                        mark.marks_obtained !== null ? mark.marks_obtained.toString() : '';
                }
            });

            setMarksData(marksMap);

            // Initialize attendance data
            const attendanceMap = {};
            students.forEach(student => {
                attendanceMap[student.id] = {};
                MONTHS.forEach(month => {
                    attendanceMap[student.id][month] = { workingDays: '', presentDays: '' };
                });
            });

            // Fill existing attendance
            attendance.forEach(att => {
                if (attendanceMap[att.student_id]) {
                    attendanceMap[att.student_id][att.month] = {
                        workingDays: att.working_days !== null ? att.working_days.toString() : '',
                        presentDays: att.present_days !== null ? att.present_days.toString() : ''
                    };
                }
            });

            setAttendanceData(attendanceMap);
        } catch (error) {
            console.error('Error fetching class data:', error);
            Alert.alert('Error', 'Failed to load class data');
        } finally {
            setLoading(false);
        }
    };

    // Calculate Overall marks based on all other exams
    const calculateOverall = (studentId, subject) => {
        const marks = marksData[studentId][subject];
        let totalMarks = 0;
        let totalExams = 0;

        // All exams except Overall
        const examTypesToSum = EXAM_TYPES.filter(e => e !== 'Overall');

        examTypesToSum.forEach(examType => {
            const mark = marks[examType];
            if (mark !== '' && mark !== null) {
                const numMark = parseFloat(mark);
                if (!isNaN(numMark)) {
                    totalMarks += numMark;
                    totalExams += 1;
                }
            }
        });

        // If no exams have marks yet, return empty
        if (totalExams === 0) return '';

        // Calculate average and round to 2 decimal places
        const average = totalMarks / totalExams;
        return Math.round(average * 100) / 100;
    };

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

    const handleSaveMarks = async () => {
        setSaving(true);
        try {
            const marksPayload = [];
            students.forEach(student => {
                subjects.forEach(subject => {
                    EXAM_TYPES.forEach(examType => {
                        let marksValue = marksData[student.id][subject][examType];

                        // Auto-calculate Overall if it's empty
                        if (examType === 'Overall' && (marksValue === '' || marksValue === null)) {
                            marksValue = calculateOverall(student.id, subject);
                        }

                        if (marksValue !== '') {
                            marksPayload.push({
                                student_id: student.id,
                                class_group: classGroup,
                                subject: subject,
                                exam_type: examType,
                                marks_obtained: marksValue
                            });
                        }
                    });
                });
            });

            if (marksPayload.length > 0) {
                await apiClient.post('/reports/marks/bulk', { marksPayload });
            }

            Alert.alert('Success', 'Marks saved successfully!');
            fetchClassData(); // Refresh data
        } catch (error) {
            console.error('Error saving marks:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to save marks');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAttendance = async () => {
        setSaving(true);
        try {
            const attendancePayload = [];
            students.forEach(student => {
                MONTHS.forEach(month => {
                    const att = attendanceData[student.id][month];
                    if (att.workingDays !== '' || att.presentDays !== '') {
                        attendancePayload.push({
                            student_id: student.id,
                            month: month,
                            working_days: att.workingDays,
                            present_days: att.presentDays
                        });
                    }
                });
            });

            if (attendancePayload.length > 0) {
                await apiClient.post('/reports/attendance/bulk', { attendancePayload });
            }

            Alert.alert('Success', 'Attendance saved successfully!');
            fetchClassData();
        } catch (error) {
            console.error('Error saving attendance:', error);
            Alert.alert('Error', 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#2c3e50" />
            </View>
        );
    }

    // Render Marks Table
    const renderMarksTable = () => {
        return (
            <View style={styles.tableContainer}>
                <Text style={styles.sectionTitle}>Academic Year: {academicYear}</Text>
                <Text style={styles.infoText}>Select Exam Type:</Text>

                {/* Exam Type Selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.examTypeScroll}>
                    {EXAM_TYPES.map(examType => (
                        <TouchableOpacity
                            key={examType}
                            style={[
                                styles.examTypeButton,
                                selectedExam === examType && styles.examTypeButtonActive
                            ]}
                            onPress={() => setSelectedExam(examType)}
                        >
                            <Text style={[
                                styles.examTypeText,
                                selectedExam === examType && styles.examTypeTextActive
                            ]}>
                                {examType}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Marks Entry for Selected Exam */}
                <ScrollView horizontal>
                    <View>
                        {/* Header Row */}
                        <View style={styles.tableRow}>
                            <Text style={[styles.tableHeader, styles.rollNoColumn]}>Roll No</Text>
                            <Text style={[styles.tableHeader, styles.nameColumn]}>Student Name</Text>
                            {subjects.map(subject => {
                                const permission = teacherPermissions[subject] || {};
                                const canEdit = permission.canEdit;
                                const bgColor = canEdit ? '#d4edda' : '#fff3cd';
                                
                                return (
                                    <View key={subject} style={[styles.tableHeader, styles.subjectColumn, { backgroundColor: bgColor }]}>
                                        <Text style={styles.headerText}>{subject}</Text>
                                        {!isAdmin && (
                                            <Text style={styles.permissionText}>
                                                {canEdit ? '(You)' : `(${permission.teacherName || 'Unassigned'})`}
                                            </Text>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        {/* Student Rows */}
                        {students.map(student => (
                            <View key={student.id} style={styles.tableRow}>
                                <Text style={[styles.tableCell, styles.rollNoColumn]}>{student.roll_no}</Text>
                                <Text style={[styles.tableCell, styles.nameColumn]}>{student.full_name}</Text>
                                {subjects.map(subject => {
                                    const permission = teacherPermissions[subject] || {};
                                    const canEdit = permission.canEdit;
                                    const isOverall = selectedExam === 'Overall';

                                    // Show calculated Overall value
                                    let displayValue = marksData[student.id][subject][selectedExam];
                                    if (isOverall && (displayValue === '' || displayValue === null)) {
                                        displayValue = calculateOverall(student.id, subject);
                                    }

                                    return (
                                        <TextInput
                                            key={subject}
                                            style={[
                                                styles.tableCell,
                                                styles.subjectColumn,
                                                styles.input,
                                                !canEdit && styles.inputDisabled,
                                                isOverall && styles.overallInput
                                            ]}
                                            value={displayValue.toString()}
                                            onChangeText={(value) => updateMarks(student.id, subject, selectedExam, value)}
                                            keyboardType="numeric"
                                            editable={canEdit && !isOverall}
                                            placeholder="-"
                                        />
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </ScrollView>

                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSaveMarks}
                    disabled={saving}
                >
                    <Text style={styles.saveButtonText}>
                        {saving ? 'Saving...' : 'Save All Marks'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    // Render Attendance Table
    const renderAttendanceTable = () => {
        return (
            <View style={styles.tableContainer}>
                <Text style={styles.sectionTitle}>Monthly Attendance - {academicYear}</Text>

                <ScrollView horizontal>
                    <View>
                        {/* Header Row */}
                        <View style={styles.tableRow}>
                            <Text style={[styles.tableHeader, styles.rollNoColumn]}>Roll No</Text>
                            <Text style={[styles.tableHeader, styles.nameColumn]}>Student Name</Text>
                            {MONTHS.map(month => (
                                <View key={month} style={[styles.tableHeader, styles.attendanceColumn]}>
                                    <Text style={styles.headerText}>{month}</Text>
                                    <Text style={styles.subHeaderText}>(W / P)</Text>
                                </View>
                            ))}
                        </View>

                        {/* Student Rows */}
                        {students.map(student => (
                            <View key={student.id} style={styles.tableRow}>
                                <Text style={[styles.tableCell, styles.rollNoColumn]}>{student.roll_no}</Text>
                                <Text style={[styles.tableCell, styles.nameColumn]}>{student.full_name}</Text>
                                {MONTHS.map(month => (
                                    <View key={month} style={[styles.tableCell, styles.attendanceColumn]}>
                                        <TextInput
                                            style={[styles.input, styles.attendanceInput]}
                                            value={attendanceData[student.id][month].workingDays}
                                            onChangeText={(value) => updateAttendance(student.id, month, 'workingDays', value)}
                                            keyboardType="numeric"
                                            placeholder="W"
                                        />
                                        <Text style={styles.slashText}>/</Text>
                                        <TextInput
                                            style={[styles.input, styles.attendanceInput]}
                                            value={attendanceData[student.id][month].presentDays}
                                            onChangeText={(value) => updateAttendance(student.id, month, 'presentDays', value)}
                                            keyboardType="numeric"
                                            placeholder="P"
                                        />
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>
                </ScrollView>

                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSaveAttendance}
                    disabled={saving}
                >
                    <Text style={styles.saveButtonText}>
                        {saving ? 'Saving...' : 'Save All Attendance'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header with Teacher Assignment Button (Admin Only) */}
            {isAdmin && (
                <TouchableOpacity
                    style={styles.assignButton}
                    onPress={() => navigation.navigate('TeacherAssignment', { classGroup })}
                >
                    <Text style={styles.assignButtonText}>Assign Teachers to Subjects</Text>
                </TouchableOpacity>
            )}

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'marks' && styles.activeTab]}
                    onPress={() => setActiveTab('marks')}
                >
                    <Text style={[styles.tabText, activeTab === 'marks' && styles.activeTabText]}>
                        Marks Entry
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'attendance' && styles.activeTab]}
                    onPress={() => setActiveTab('attendance')}
                >
                    <Text style={[styles.tabText, activeTab === 'attendance' && styles.activeTabText]}>
                        Attendance
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.contentContainer}>
                {activeTab === 'marks' ? renderMarksTable() : renderAttendanceTable()}
            </ScrollView>
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
    assignButton: {
        backgroundColor: '#3498db',
        padding: 15,
        margin: 10,
        borderRadius: 8,
        alignItems: 'center'
    },
    assignButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd'
    },
    tab: {
        flex: 1,
        paddingVertical: 15,
        alignItems: 'center',
        borderBottomWidth: 3,
        borderBottomColor: 'transparent'
    },
    activeTab: {
        borderBottomColor: '#2c3e50'
    },
    tabText: {
        fontSize: 16,
        color: '#7f8c8d',
        fontWeight: '500'
    },
    activeTabText: {
        color: '#2c3e50',
        fontWeight: 'bold'
    },
    contentContainer: {
        flex: 1
    },
    tableContainer: {
        padding: 15
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 10
    },
    infoText: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 10
    },
    examTypeScroll: {
        marginBottom: 15
    },
    examTypeButton: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginRight: 10,
        backgroundColor: '#ecf0f1',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#bdc3c7'
    },
    examTypeButtonActive: {
        backgroundColor: '#2c3e50',
        borderColor: '#2c3e50'
    },
    examTypeText: {
        fontSize: 14,
        color: '#7f8c8d',
        fontWeight: '500'
    },
    examTypeTextActive: {
        color: '#fff',
        fontWeight: 'bold'
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd'
    },
    tableHeader: {
        padding: 12,
        fontWeight: 'bold',
        backgroundColor: '#34495e',
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: '#fff'
    },
    headerText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
        textAlign: 'center'
    },
    subHeaderText: {
        color: '#fff',
        fontSize: 11,
        textAlign: 'center',
        marginTop: 2
    },
    permissionText: {
        color: '#fff',
        fontSize: 10,
        marginTop: 2,
        fontStyle: 'italic'
    },
    tableCell: {
        padding: 10,
        backgroundColor: '#fff',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: '#ddd'
    },
    rollNoColumn: {
        width: 80,
        textAlign: 'center'
    },
    nameColumn: {
        width: 150
    },
    subjectColumn: {
        width: 100
    },
    attendanceColumn: {
        width: 100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 8,
        textAlign: 'center',
        backgroundColor: '#fff'
    },
    inputDisabled: {
        backgroundColor: '#f5f5f5',
        color: '#999'
    },
    overallInput: {
        backgroundColor: '#fff3cd',
        fontWeight: 'bold',
        color: '#856404'
    },
    attendanceInput: {
        width: 35,
        padding: 5,
        fontSize: 12
    },
    slashText: {
        marginHorizontal: 3,
        fontSize: 14,
        color: '#7f8c8d'
    },
    saveButton: {
        backgroundColor: '#27ae60',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20
    },
    saveButtonDisabled: {
        backgroundColor: '#95a5a6'
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    }
});

export default MarksEntryScreen;
