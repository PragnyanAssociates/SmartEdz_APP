import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView,
    TouchableOpacity, ActivityIndicator, Alert, TextInput, Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// --- Constants ---
const PRIMARY_COLOR = '#673AB7'; // Deep Purple
const ACCENT_COLOR = '#FFC107'; // Amber for alerts/highlights
const BORDER_COLOR = '#E0E0E0';
const HEADER_COLOR = '#F5F5F5';
const TEXT_COLOR_DARK = '#212121';
const TEXT_COLOR_MEDIUM = '#616161';
const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const SUBJECT_COLUMN_WIDTH = 80;

const ALL_EXAM_TYPES = [
    'Assignment 1', 'Assignment 2', 'Assignment 3', 'Assignment 4',
    'Unit Test 1', 'Unit Test 2', 'Unit Test 3', 'Unit Test 4',
    'SA 1', 'SA 2'
];

// --- Type Definitions ---
interface StudentMark {
    student_id: number;
    full_name: string;
    roll_no: string;
    marks: { [subject: string]: number | undefined }; 
    totalMarks?: { [subject: string]: { [exam: string]: number } }; 
}

interface ExamConfig {
    subjects: string[];
    examTypes: string[];
}


// --- 1. Class Selection Screen ---

const ClassListScreen = ({ onSelectClass }) => (
    <ScrollView style={styles.classListContainer} contentContainerStyle={{ paddingVertical: 20 }}>
        {CLASS_GROUPS.map(classGroup => (
            <TouchableOpacity
                key={classGroup}
                style={styles.classButton}
                onPress={() => onSelectClass(classGroup)}
            >
                <Icon name="school" size={24} color="#FFF" style={{ marginRight: 15 }} />
                <Text style={styles.classButtonText}>{classGroup}</Text>
                <Icon name="chevron-right" size={24} color="#FFF" />
            </TouchableOpacity>
        ))}
    </ScrollView>
);


// --- 2. Mark Input Grid Component (Admin/Teacher) ---

const MarkInputGrid = ({ classGroup, config, onGoBack }) => {
    const { user } = useAuth();
    const [marksData, setMarksData] = useState<StudentMark[]>([]);
    const [selectedExam, setSelectedExam] = useState('Overall'); 
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [allExamMarks, setAllExamMarks] = useState<StudentMark[]>([]); 
    
    const isOverallView = selectedExam === 'Overall';
    
    const teacherSubjects = useMemo(() => {
        if (user?.role === 'admin') return config.subjects; 
        try {
            const parsedSubjects = JSON.parse(user?.subjects_taught || '[]');
            return Array.isArray(parsedSubjects) ? parsedSubjects : [];
        } catch {
            return [];
        }
    }, [user, config.subjects]);
    
    // --- Data Fetching Logic (Omitted for brevity, assumed functional) ---
    const fetchAllMarks = useCallback(async () => {
        if (!classGroup || !config.examTypes.length) { setLoading(false); return; }
        setLoading(true);
        const marksPromises = config.examTypes.map(examType => apiClient.get(`/reportcard/marks/${classGroup}/${examType}`));
        try {
            const results = await Promise.all(marksPromises);
            const studentBaseMap = {};
            results.flatMap(r => r.data).forEach(student => {
                if (!studentBaseMap[student.student_id]) {
                    studentBaseMap[student.student_id] = { student_id: student.student_id, full_name: student.full_name, roll_no: student.roll_no, totalMarks: {} };
                    config.subjects.forEach(subject => { studentBaseMap[student.student_id].totalMarks[subject] = {}; });
                }
            });
            results.forEach((response, index) => {
                const examType = config.examTypes[index];
                response.data.forEach(student => {
                    const studentId = student.student_id;
                    if (studentBaseMap[studentId]) { 
                        config.subjects.forEach(subject => {
                             const mark = student.marks[subject];
                             if (mark !== undefined && mark !== null) { studentBaseMap[studentId].totalMarks[subject][examType] = mark; }
                        });
                    }
                });
            });
            setAllExamMarks(Object.values(studentBaseMap));
            if (selectedExam === 'Overall') {
                 setMarksData(Object.values(studentBaseMap).map(s => ({ student_id: s.student_id, full_name: s.full_name, roll_no: s.roll_no, marks: {} })));
            }
        } catch (error) {
            console.error("Failed to fetch all marks:", error);
        } finally {
            setLoading(false);
        }
    }, [classGroup, config.examTypes, config.subjects, selectedExam]);

    const fetchSpecificMarks = useCallback(async () => {
        if (!classGroup || !selectedExam || isOverallView) { setLoading(false); return; }
        setLoading(true);
        try {
            const response = await apiClient.get(`/reportcard/marks/${classGroup}/${selectedExam}`);
            setMarksData(response.data); 
        } catch (error) {
            Alert.alert('Error', 'Failed to load marks data for the selected exam.');
            setMarksData([]);
        } finally {
            setLoading(false);
        }
    }, [classGroup, selectedExam, isOverallView]);
    
    
    useEffect(() => { fetchAllMarks(); }, [fetchAllMarks]);
    useEffect(() => {
        if (!isOverallView) { fetchSpecificMarks(); } 
        else { setMarksData(allExamMarks.map(s => ({ student_id: s.student_id, full_name: s.full_name, roll_no: s.roll_no, marks: {} }))); }
    }, [isOverallView, fetchSpecificMarks, allExamMarks]);

    // --- End Data Fetching Logic ---

    const handleExamTypeChange = (itemValue) => setSelectedExam(itemValue);

    const handleMarkChange = (student_id: number, subject: string, value: string) => {
        if (isOverallView) return; 
        const mark = value === '' ? undefined : parseInt(value, 10);
        
        setMarksData(prevData =>
            prevData.map(student => (student.student_id === student_id ? 
                { ...student, marks: { ...student.marks, [subject]: mark } } : student))
        );
    };
    
    const calculateMark = (studentId: number, subject: string, calculateRowTotal: boolean): number => {
        const student = (isOverallView ? allExamMarks : marksData).find(s => s.student_id === studentId);
        if (!student) return 0;
        
        if (isOverallView) {
            if (calculateRowTotal) { return config.subjects.reduce((sum, subj) => sum + calculateMark(studentId, subj, false), 0); }
            if (!student.totalMarks?.[subject]) return 0;
            return Object.values(student.totalMarks[subject]).reduce((sum, mark) => sum + (mark || 0), 0);
        } else {
            if (calculateRowTotal) {
                return config.subjects.reduce((sum, subj) => {
                    const mark = student.marks[subj];
                    return sum + (typeof mark === 'number' && !isNaN(mark) ? mark : 0);
                }, 0);
            } else {
                 const mark = student.marks[subject];
                 return (typeof mark === 'number' && !isNaN(mark) ? mark : 0);
            }
        }
    };


    const handleSave = async () => {
        if (isOverallView || isSaving) return;
        
        const marksToSave = marksData.map(student => {
            const filteredMarks = {};
            Object.entries(student.marks).forEach(([subject, mark]) => {
                if ((user?.role === 'admin' || teacherSubjects.includes(subject))) {
                    filteredMarks[subject] = mark; 
                }
            });
            return { student_id: student.student_id, marks: filteredMarks };
        });

        setIsSaving(true);
        try {
            await apiClient.post('/reportcard/marks', {
                classGroup,
                examType: selectedExam,
                marksData: marksToSave,
                teacherId: user.id
            });
            Alert.alert('Success', `${selectedExam} marks saved successfully.`);
            fetchAllMarks(); 
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to save marks.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user || loading) {
        return <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 50 }} />;
    }
    
    const studentsToDisplay = marksData; 

    if (studentsToDisplay.length === 0) {
         return (
            <View style={styles.gridContainer}>
                <View style={styles.gridHeader}>
                    <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                        <Icon name="arrow-left" size={24} color={PRIMARY_COLOR} />
                    </TouchableOpacity>
                    <Text style={styles.gridClassTitle}>{classGroup} - Mark Entry</Text>
                </View>
                <Text style={styles.noDataText}>No students found in this class.</Text>
            </View>
        );
    }
    
    const fixedWidth = 50 + 150; // Roll No + Name
    const subjectsWidth = config.subjects.length * SUBJECT_COLUMN_WIDTH;
    const totalColumnWidth = fixedWidth + subjectsWidth + 60; 
    
    const teacherAssignmentInfo = teacherSubjects.length === config.subjects.length && user?.role === 'admin' 
        ? 'Admin (All Subjects)'
        : teacherSubjects.join(', ') || 'None Assigned';


    return (
        <View style={styles.gridContainer}>
            
            {/* Header: Back Button + Class Title */}
            <View style={styles.gridHeader}>
                <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                    <Icon name="arrow-left" size={24} color={PRIMARY_COLOR} />
                </TouchableOpacity>
                <Text style={styles.gridClassTitle}>{classGroup} - Mark Entry</Text>
            </View>

            {/* Teacher/Subject Assignment Info */}
            <View style={styles.teacherInfoBox}>
                <Text style={styles.teacherInfoLabel}>Assigned Teacher/Subject(s):</Text>
                <Text style={styles.teacherInfoValue}>{user.full_name} ({teacherAssignmentInfo})</Text> 
            </View>
            
            {/* Exam Type Dropdown */}
            <View style={styles.pickerWrapperHorizontal}>
                <Text style={styles.pickerLabel}>Exam Type:</Text>
                <View style={styles.pickerStyle}>
                    <Picker
                        selectedValue={selectedExam}
                        onValueChange={handleExamTypeChange}
                        style={styles.picker}
                    >
                        <Picker.Item key='Overall' label='Overall Marks (Total)' value='Overall' />
                        {config.examTypes.map(type => (
                            <Picker.Item key={type} label={type} value={type} />
                        ))}
                    </Picker>
                </View>
            </View>
            
            {/* Attendance Note */}
            <View style={styles.attendanceNote}>
                <Icon name="calendar-check" size={14} color={PRIMARY_COLOR} />
                <Text style={styles.attendanceNoteText}>Attendance days are tracked in the dedicated Attendance module, not manually entered here.</Text>
            </View>

            
            {/* Mark Entry Table */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={{ width: totalColumnWidth }}>
                    {/* Header Row (Roll No, Name, Subject 1, Subject 2, ..., Total) */}
                    <View style={styles.marksInputHeader}>
                        <Text style={[styles.marksInputCell, styles.headerCell, { width: 50, borderRightWidth: 0 }]}>Roll No</Text>
                        <Text style={[styles.marksInputCell, styles.headerCell, { width: 150 }]}>Name</Text>
                        
                        {config.subjects.map(subject => (
                            <Text 
                                key={subject} 
                                style={[styles.marksInputCell, styles.headerCell, { 
                                    width: SUBJECT_COLUMN_WIDTH, 
                                    backgroundColor: teacherSubjects.includes(subject) || user?.role === 'admin' ? PRIMARY_COLOR : TEXT_COLOR_MEDIUM 
                                }]}
                            >
                                {subject}
                            </Text>
                        ))}
                        
                        <Text style={[styles.marksInputCell, styles.headerCell, { width: 60, backgroundColor: ACCENT_COLOR, color: TEXT_COLOR_DARK }]}>Total</Text>
                    </View>
                    
                    {/* Data Rows (Student Line by Line - Compacted) */}
                    {studentsToDisplay.map((student, index) => (
                        <View key={student.student_id} style={[styles.marksInputRow, index % 2 !== 0 && {backgroundColor: HEADER_COLOR}]}>
                            <Text style={[styles.marksInputCell, { width: 50, fontWeight: 'bold', borderRightWidth: 0 }]}>{student.roll_no}</Text>
                            <Text style={[styles.marksInputCell, { width: 150, textAlign: 'left', paddingLeft: 10 }]} numberOfLines={2}>{student.full_name}</Text>
                            
                            {config.subjects.map(subject => {
                                const isEditable = !isOverallView && (user?.role === 'admin' || teacherSubjects.includes(subject));
                                
                                const displayMark = isOverallView 
                                    ? calculateMark(student.student_id, subject, false) 
                                    : (student.marks[subject]?.toString() ?? '');
                                
                                return (
                                    <View 
                                        key={subject} 
                                        style={[styles.marksInputCell, { width: SUBJECT_COLUMN_WIDTH, padding: 0 }]}
                                    >
                                        <TextInput
                                            style={[
                                                styles.marksInputField, 
                                                !isEditable && styles.marksInputDisabled
                                            ]}
                                            keyboardType="numeric"
                                            value={displayMark.toString()}
                                            onChangeText={(text) => handleMarkChange(student.student_id, subject, text)}
                                            editable={isEditable}
                                            placeholder={isEditable ? '0' : '-'}
                                        />
                                    </View>
                                );
                            })}
                            
                            <Text style={[styles.marksInputCell, { width: 60, fontWeight: 'bold', backgroundColor: '#FFD54F' }]}>
                                {calculateMark(student.student_id, '', true)}
                            </Text>
                        </View>
                    ))}
                    
                    {/* Total Row (Column Sums) */}
                     <View style={[styles.marksInputRow, styles.totalRow]}>
                        <Text style={[styles.marksInputCell, { width: 50, fontWeight: '900', color: PRIMARY_COLOR, borderRightWidth: 0 }]}>Total</Text>
                        <Text style={[styles.marksInputCell, { width: 150 }]}></Text>
                        
                        {config.subjects.map(subject => {
                             const subjectColumnTotal = studentsToDisplay.reduce((sum, student) => {
                                 const markValue = calculateMark(student.student_id, subject, false);
                                 return sum + markValue;
                             }, 0);

                            return (
                                <Text 
                                    key={subject} 
                                    style={[styles.marksInputCell, styles.totalCell, { width: SUBJECT_COLUMN_WIDTH, borderRightColor: '#9C27B0' }]}
                                >
                                    {subjectColumnTotal}
                                </Text>
                            );
                        })}
                        
                        <Text style={[styles.marksInputCell, styles.totalCell, { width: 60, backgroundColor: PRIMARY_COLOR, color: 'white' }]}>
                             {studentsToDisplay.reduce((grandTotal, student) => {
                                 return grandTotal + calculateMark(student.student_id, '', true);
                             }, 0)}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {!isOverallView && (
                <TouchableOpacity 
                    style={styles.saveButton} 
                    onPress={handleSave} 
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color='white' />
                    ) : (
                        <Text style={styles.saveButtonText}>SAVE MARKS</Text>
                    )}
                </TouchableOpacity>
            )}
            
            {isOverallView && (
                 <View style={styles.overallInfoContainer}>
                    <Text style={styles.overallInfoText}>
                        <Icon name="information-outline" size={16} color={PRIMARY_COLOR} /> This view displays the calculated sum of all entered marks (Read Only).
                    </Text>
                 </View>
            )}
        </View>
    );
};


// --- 3. Main Report Card Router for Admin/Teacher ---

const AdminTeacherMarkEntry = () => {
    const { user } = useAuth();
    
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [examConfig, setExamConfig] = useState<ExamConfig | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(false);
    
    useEffect(() => {
        const fetchConfig = async () => {
            if (!selectedClass) return;
            setLoadingConfig(true);
            try {
                const response = await apiClient.get(`/reportcard/config/${selectedClass}`);
                setExamConfig(response.data);
            } catch (error: any) {
                Alert.alert('Error', error.response?.data?.message || 'Failed to load class configuration.');
                setExamConfig(null);
            } finally {
                setLoadingConfig(false);
            }
        };
        fetchConfig();
    }, [selectedClass]);


    if (!user || user.role === 'student') {
        return <Text style={styles.noDataText}>Access Denied. This module is for Admin/Teacher only.</Text>;
    }

    if (!selectedClass) {
        // Step 1: Class Selection 
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Report Card Management</Text>
                </View>
                <ClassListScreen onSelectClass={setSelectedClass} />
            </SafeAreaView>
        );
    }
    
    // Step 2: Mark Input Grid
    if (loadingConfig) {
        return <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 50 }} />;
    }
    
    if (!examConfig) {
         return <Text style={styles.noDataText}>Configuration failed for {selectedClass}.</Text>;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
                <MarkInputGrid 
                    classGroup={selectedClass} 
                    config={examConfig} 
                    onGoBack={() => {
                        setSelectedClass(null); 
                        setExamConfig(null);
                    }}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

// --- Styles (Optimized for Compact Grid) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F4F6F8' },
    header: { padding: 15, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: 'white', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_COLOR_DARK },
    
    // --- Class List Styles ---
    classListContainer: { paddingHorizontal: 15 },
    classButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: PRIMARY_COLOR,
        padding: 18,
        borderRadius: 10,
        marginVertical: 8,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    classButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: 'white',
        flex: 1,
    },
    
    // --- Grid Styles (Mark Entry Screen) ---
    gridContainer: { 
        padding: 15, 
        backgroundColor: 'white', 
        marginTop: 10, 
        marginHorizontal: 10, 
        borderRadius: 10, 
        elevation: 5, 
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 5, 
        marginBottom: 20 
    },
    gridHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR,
        marginBottom: 10,
    },
    backButton: {
        marginRight: 10,
        padding: 5,
    },
    gridClassTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: TEXT_COLOR_DARK,
    },

    // --- Grid Controls ---
    teacherInfoBox: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: HEADER_COLOR, marginBottom: 10 },
    teacherInfoLabel: { fontSize: 12, color: TEXT_COLOR_MEDIUM },
    teacherInfoValue: { fontSize: 14, fontWeight: 'bold', color: PRIMARY_COLOR },
    
    pickerWrapperHorizontal: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: 10 },
    pickerLabel: { fontSize: 15, color: TEXT_COLOR_MEDIUM, marginRight: 10, fontWeight: '600' },
    pickerStyle: { flex: 1, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 6, height: 40, justifyContent: 'center', backgroundColor: HEADER_COLOR },
    picker: { height: 40, width: '100%', color: TEXT_COLOR_DARK },
    
    attendanceNote: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#FFF3E0', borderRadius: 5, marginBottom: 15, borderWidth: 1, borderColor: ACCENT_COLOR },
    attendanceNoteText: { marginLeft: 5, flexShrink: 1, fontSize: 12, color: TEXT_COLOR_MEDIUM },

    // --- Table Structure (Tighter styles for student lines) ---
    marksInputHeader: { flexDirection: 'row', backgroundColor: PRIMARY_COLOR, borderTopLeftRadius: 8, borderTopRightRadius: 8, minWidth: '100%', height: 35 }, 
    marksInputRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: HEADER_COLOR, backgroundColor: 'white', minHeight: 30 }, 
    
    marksInputCell: { 
        paddingVertical: 3, 
        paddingHorizontal: 3, 
        justifyContent: 'center', 
        alignItems: 'center', 
        borderRightWidth: 1, 
        borderRightColor: BORDER_COLOR, 
        fontSize: 13, 
        color: TEXT_COLOR_DARK, 
        minHeight: 30, 
    },
    headerCell: { fontWeight: 'bold', color: 'white', textAlign: 'center', fontSize: 11 },
    
    totalRow: { backgroundColor: '#CCC', borderTopWidth: 2, borderTopColor: PRIMARY_COLOR, minHeight: 35 }, 
    totalCell: { fontWeight: '900', color: TEXT_COLOR_DARK, fontSize: 14, backgroundColor: '#CCC' },

    marksInputField: { 
        width: '100%', 
        height: '100%', 
        paddingHorizontal: 2, 
        paddingVertical: 0, 
        textAlign: 'center', 
        backgroundColor: 'transparent', 
        fontSize: 14, 
        color: PRIMARY_COLOR,
        fontWeight: 'bold',
    },
    marksInputDisabled: { 
        backgroundColor: '#EEEEEE', 
        color: TEXT_COLOR_MEDIUM, 
        opacity: 1, 
        justifyContent: 'center',
        textAlign: 'center',
        fontWeight: 'normal',
    },
    
    saveButton: { backgroundColor: PRIMARY_COLOR, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20, marginHorizontal: 5, elevation: 3 },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    overallInfoContainer: { padding: 10, backgroundColor: '#E1F5FE', borderRadius: 8, marginTop: 15, borderWidth: 1, borderColor: PRIMARY_COLOR },
    overallInfoText: { fontSize: 13, color: TEXT_COLOR_MEDIUM, textAlign: 'center', fontWeight: '500' },
    
    noDataText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: TEXT_COLOR_MEDIUM },
});

export default AdminTeacherMarkEntry;