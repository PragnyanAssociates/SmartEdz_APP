/**
 * File: src/screens/report/MarksEntryScreen.js
 * V4 Final: Fixes syntax error and fully implements the Attendance tab layout.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, FlatList } from 'react-native';
import apiClient from '../../api/client';
import { Picker } from '@react-native-picker/picker';

const config = {
    subjects: {
        'LKG': ['All Subjects'], 'UKG': ['All Subjects'],
        '1st Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], '2nd Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
        '3rd Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], '4th Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
        '5th Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
        '6th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], '7th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
        '8th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], '9th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
        '10th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    },
    exams: ['FA-1', 'FA-2', 'FA-3', 'FA-4', 'UT-1', 'UT-2', 'UT-3', 'UT-4', 'SA-1', 'SA-2'],
    attendanceMonths: ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May']
};

const MarksEntryScreen = ({ route }) => {
    const classGroup = route?.params?.classGroup;

    const [activeTab, setActiveTab] = useState('marks');
    const [students, setStudents] = useState([]);
    const [marks, setMarks] = useState({});
    const [attendance, setAttendance] = useState({});
    const [academicYear, setAcademicYear] = useState('');
    const [selectedExam, setSelectedExam] = useState(config.exams[0]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const subjectsForClass = useMemo(() => config.subjects[classGroup] || [], [classGroup]);

    useEffect(() => {
        if (!classGroup) { setLoading(false); return; }
        const fetchClassData = async () => {
            setLoading(true);
            try {
                const res = await apiClient.get(`/reports/class-data/${classGroup}`);
                const { students, marks: fetchedMarks, attendance: fetchedAttendance, academicYear } = res.data;
                
                setStudents(students);
                setAcademicYear(academicYear);

                const marksData = fetchedMarks.reduce((acc, m) => {
                    if (!acc[m.student_id]) acc[m.student_id] = {};
                    if (!acc[m.student_id][m.subject]) acc[m.student_id][m.subject] = {};
                    acc[m.student_id][m.subject][m.exam_type] = m.marks_obtained?.toString() || '';
                    return acc;
                }, {});
                setMarks(marksData);

                const attendanceData = fetchedAttendance.reduce((acc, a) => {
                    if (!acc[a.student_id]) acc[a.student_id] = {};
                    acc[a.student_id][a.month] = {
                        working_days: a.working_days?.toString() || '',
                        present_days: a.present_days?.toString() || '',
                    };
                    return acc;
                }, {});
                setAttendance(attendanceData);

            } catch (error) {
                Alert.alert('Error', 'Could not load data for this class.');
            } finally {
                setLoading(false);
            }
        };
        fetchClassData();
    }, [classGroup]);
    
    const handleMarkChange = useCallback((studentId, subject, value) => {
        setMarks(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [subject]: { ...((prev[studentId] && prev[studentId][subject]) || {}), [selectedExam]: value, }, }, }));
    }, [selectedExam]);

    const handleAttendanceChange = useCallback((studentId, month, field, value) => {
        setAttendance(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [month]: { ...((prev[studentId] && prev[studentId][month]) || {}), [field]: value, }, }, }));
    }, []);

    const onSave = async () => {
        setSaving(true);
        try {
            const marksPayload = [];
            Object.keys(marks).forEach(studentId => {
                Object.keys(marks[studentId]).forEach(subject => {
                    Object.keys(marks[studentId][subject]).forEach(examType => {
                        marksPayload.push({ student_id: studentId, class_group: classGroup, subject: subject, exam_type: examType, marks_obtained: marks[studentId][subject][examType], });
                    });
                });
            });

            const attendancePayload = [];
            Object.keys(attendance).forEach(studentId => {
                Object.keys(attendance[studentId]).forEach(month => {
                    attendancePayload.push({ student_id: studentId, month: month, ...attendance[studentId][month], });
                });
            });

            await apiClient.post('/reports/marks/bulk', { marksPayload });
            await apiClient.post('/reports/attendance/bulk', { attendancePayload });

            Alert.alert('Success', 'All data saved successfully!');
        } catch (error) {
            Alert.alert('Error', 'Failed to save data.');
        } finally {
            setSaving(false);
        }
    };

    const calculateRowTotal = useCallback((studentId) => {
        return subjectsForClass.reduce((sum, subject) => sum + (parseInt(marks[studentId]?.[subject]?.[selectedExam], 10) || 0), 0);
    }, [marks, selectedExam, subjectsForClass]);

    const calculateColumnTotal = useCallback((subject) => {
        return students.reduce((sum, student) => sum + (parseInt(marks[student.id]?.[subject]?.[selectedExam], 10) || 0), 0);
    }, [marks, selectedExam, students]);

    const grandTotal = useMemo(() => {
        return subjectsForClass.reduce((sum, subject) => sum + calculateColumnTotal(subject), 0);
    }, [subjectsForClass, calculateColumnTotal]);

    const renderMarksTab = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.controlsContainer}>
                <Text style={styles.label}>Select Exam:</Text>
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={selectedExam} onValueChange={(itemValue) => setSelectedExam(itemValue)}>
                        {config.exams.map(exam => <Picker.Item key={exam} label={exam} value={exam} />)}
                    </Picker>
                </View>
            </View>
            <ScrollView horizontal bounces={false}>
                <View>
                    <View style={styles.tableRowHeader}>
                        <Text style={[styles.headerText, styles.rollNoCell]}>Roll</Text>
                        <Text style={[styles.headerText, styles.nameCell]}>Student Name</Text>
                        {subjectsForClass.map(subject => <Text key={subject} style={[styles.headerText, styles.subjectCell]}>{subject.substring(0, 3)}</Text>)}
                        <Text style={[styles.headerText, styles.totalCell]}>Total</Text>
                    </View>
                    <FlatList
                        data={students}
                        keyExtractor={item => item.id.toString()}
                        renderItem={({ item: student }) => (
                            <View style={styles.tableRow}>
                                <Text style={[styles.cell, styles.rollNoCell]}>{student.roll_no || '-'}</Text>
                                <Text style={[styles.cell, styles.nameCell]}>{student.full_name}</Text>
                                {subjectsForClass.map(subject => (
                                    <TextInput key={subject} style={[styles.cell, styles.subjectCell, styles.input]} keyboardType="number-pad" maxLength={3} placeholder="-" value={marks[student.id]?.[subject]?.[selectedExam] || ''} onChangeText={text => handleMarkChange(student.id, subject, text)} />
                                ))}
                                <Text style={[styles.cell, styles.totalCell, styles.boldText]}>{calculateRowTotal(student.id)}</Text>
                            </View>
                        )}
                    />
                    <View style={styles.tableRowHeader}>
                        <Text style={[styles.headerText, styles.rollNoCell]}></Text>
                        <Text style={[styles.headerText, styles.nameCell]}>Total</Text>
                        {subjectsForClass.map(subject => (<Text key={subject} style={[styles.headerText, styles.subjectCell, styles.boldText]}>{calculateColumnTotal(subject)}</Text>))}
                        <Text style={[styles.headerText, styles.totalCell, styles.boldText]}>{grandTotal}</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );

    // ==========================================================
    // ★★★ FIX APPLIED HERE ★★★
    // The incomplete function is now fully implemented.
    // ==========================================================
    const renderAttendanceTab = () => (
        <ScrollView horizontal bounces={false}>
            <View>
                <View style={styles.tableRowHeader}>
                    <Text style={[styles.headerText, styles.rollNoCell]}>Roll</Text>
                    <Text style={[styles.headerText, styles.nameCell]}>Student Name</Text>
                    {config.attendanceMonths.map(month => (
                        <Text key={month} style={[styles.headerText, styles.attendanceHeaderCell]}>{month}</Text>
                    ))}
                </View>
                <FlatList
                    data={students}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item: student }) => (
                        <View style={styles.tableRow}>
                            <Text style={[styles.cell, styles.rollNoCell]}>{student.roll_no || '-'}</Text>
                            <Text style={[styles.cell, styles.nameCell]}>{student.full_name}</Text>
                            {config.attendanceMonths.map(month => (
                                <View key={month} style={[styles.cell, styles.attendanceInputCell]}>
                                    <TextInput
                                        style={styles.attendanceInput}
                                        placeholder="W"
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        value={attendance[student.id]?.[month]?.working_days || ''}
                                        onChangeText={text => handleAttendanceChange(student.id, month, 'working_days', text)}
                                    />
                                    <TextInput
                                        style={styles.attendanceInput}
                                        placeholder="P"
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        value={attendance[student.id]?.[month]?.present_days || ''}
                                        onChangeText={text => handleAttendanceChange(student.id, month, 'present_days', text)}
                                    />
                                </View>
                            ))}
                        </View>
                    )}
                />
            </View>
        </ScrollView>
    );

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#0000ff" /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => setActiveTab('marks')} style={[styles.tab, activeTab === 'marks' && styles.activeTab]}>
                    <Text style={[styles.tabText, activeTab === 'marks' && styles.activeTabText]}>Marks Entry</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('attendance')} style={[styles.tab, activeTab === 'attendance' && styles.activeTab]}>
                    <Text style={[styles.tabText, activeTab === 'attendance' && styles.activeTabText]}>Attendance Entry</Text>
                </TouchableOpacity>
            </View>
            
            {academicYear && <Text style={styles.yearHeader}>Academic Year: {academicYear}</Text>}

            <View style={{ flex: 1 }}>
                {students.length === 0 ? (
                    <Text style={styles.emptyText}>No students found in {classGroup}.</Text>
                ) : (
                    activeTab === 'marks' ? renderMarksTab() : renderAttendanceTab()
                )}
            </View>
            
            <View style={styles.buttonContainer}>
                <Button title={saving ? "Saving..." : "Save All Changes"} onPress={onSave} disabled={saving || students.length === 0} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabContainer: { flexDirection: 'row', marginHorizontal: 10, marginTop: 10 },
    tab: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc' },
    activeTab: { backgroundColor: '#2c3e50', borderColor: '#2c3e50' },
    tabText: { color: '#333', fontWeight: 'bold' },
    activeTabText: { color: '#fff' },
    yearHeader: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: '#1E8449', marginVertical: 10, padding: 8, backgroundColor: '#D5F5E3', borderRadius: 5, marginHorizontal: 10 },
    controlsContainer: { paddingHorizontal: 10, paddingTop: 10 },
    label: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, color: '#333' },
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#fff', marginBottom: 15 },
    tableRowHeader: { flexDirection: 'row', backgroundColor: '#e0e9f5', borderBottomWidth: 1, borderColor: '#999' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', alignItems: 'stretch' },
    cell: { padding: 10, textAlignVertical: 'center', borderRightWidth: 1, borderColor: '#eee' },
    headerText: { padding: 10, textAlign: 'center', fontWeight: 'bold', color: '#004085', borderRightWidth: 1, borderColor: '#ccc' },
    boldText: { fontWeight: 'bold' },
    rollNoCell: { width: 60, textAlign: 'center' },
    nameCell: { width: 180, textAlign: 'left' },
    subjectCell: { width: 80, textAlign: 'center' },
    totalCell: { width: 80, backgroundColor: '#f8f9fa', textAlign: 'center'},
    input: { padding: 10, margin: 0, height: '100%', textAlign: 'center' },
    attendanceHeaderCell: { width: 140 },
    attendanceInputCell: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', width: 140 },
    attendanceInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 4, width: 55, padding: 8, textAlign: 'center' },
    buttonContainer: { padding: 10, backgroundColor: '#f0f2f5', borderTopWidth: 1, borderColor: '#ccc' },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#666' },
});

export default MarksEntryScreen;