/**
 * File: src/screens/report/StudentReportCardScreen.js
 * Purpose: Student's personal report card view with all marks and attendance
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, ActivityIndicator
} from 'react-native';
import apiClient from '../../api/client';

// **FIXED**: Using "Class 1" format to match database values
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

// Maps backend exam_type to the display name on the report card
const EXAM_MAPPING = {
    'AT1': 'Assignment-1',
    'UT1': 'Unitest-1',
    'AT2': 'Assignment-2',
    'UT2': 'Unitest-2',
    'AT3': 'Assignment-3',
    'UT3': 'Unitest-3',
    'AT4': 'Assignment-4',
    'UT4': 'Unitest-4',
    'SA1': 'SA1',// Assuming SA1 exists based on pattern
    'SA2': 'SA2', // Assuming SA2 exists based on pattern
    'Total': 'Overall'
};

// Defines the exact order of columns to be displayed in the marks table
const DISPLAY_EXAM_ORDER = ['AT1', 'UT1', 'AT2', 'UT2', 'AT3', 'UT3', 'AT4', 'UT4','SA1', 'SA2', 'Total'];

// This now includes the full month names to match the backend and rendering logic.
const MONTHS = [ 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May' ];


const StudentReportCardScreen = () => {
    const [loading, setLoading] = useState(true);
    const [studentInfo, setStudentInfo] = useState(null);
    const [marksData, setMarksData] = useState({});
    const [attendanceData, setAttendanceData] = useState({});
    const [academicYear, setAcademicYear] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchReportCard();
    }, []);

    const fetchReportCard = async () => {
        try {
            const response = await apiClient.get('/reports/my-report-card');
            const { studentInfo, marks, attendance, academicYear } = response.data;

            if (!studentInfo || !studentInfo.class_group) {
                throw new Error("Student data is incomplete.");
            }

            setStudentInfo(studentInfo);
            setAcademicYear(academicYear);

            const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];
            
            // Initialize marks map
            const marksMap = {};
            subjects.forEach(subject => {
                marksMap[subject] = {};
                Object.values(EXAM_MAPPING).forEach(examKey => {
                    marksMap[subject][examKey] = '-';
                });
            });

            // Populate with marks from the API
            marks.forEach(mark => {
                // ★★★ FIX #1: USE THE MAPPED EXAM NAME AS THE KEY ★★★
                // This ensures we store the data with the key ('Assignment-1') that we later use to read it.
                const displayExamType = EXAM_MAPPING[mark.exam_type];

                if (marksMap[mark.subject] && displayExamType) {
                    marksMap[mark.subject][displayExamType] = 
                        mark.marks_obtained !== null ? mark.marks_obtained.toString() : '-';
                }
            });

            setMarksData(marksMap);

            // Populate attendance data
            const attendanceMap = {};
            attendance.forEach(att => {
                // ★★★ FIX #2: USE THE FULL MONTH NAME FROM THE API AS THE KEY ★★★
                // This ensures we store with the key ('June') that we later use to read it.
                // Do NOT abbreviate the month name.
                if (att.month) {
                    attendanceMap[att.month] = {
                        workingDays: att.working_days ?? '-',
                        presentDays: att.present_days ?? '-'
                    };
                }
            });
            setAttendanceData(attendanceMap);

        } catch (err) {
            console.error('Error fetching report card:', err);
            setError('Could not load report card data. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#000" /></View>;
    }

    if (error || !studentInfo) {
        return <View style={styles.loaderContainer}><Text style={styles.errorText}>{error || 'No report card data available.'}</Text></View>;
    }

    const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];

    // Helper to format months for display (e.g., "September" -> "Sept")
    const formatMonthForDisplay = (month) => {
        if (month === 'September') return 'Sept';
        return month.substring(0, 3);
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.card}>
                <View style={styles.schoolHeader}>
                    <Text style={styles.schoolName}>VIVEKANANDA PUBLIC SCHOOL</Text>
                    <Text style={styles.schoolSub}>ENGLISH MEDIUM</Text>
                </View>

                <View style={styles.studentInfoContainer}>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Name:</Text><Text style={styles.infoValue}>{studentInfo.full_name}</Text></View>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Roll No:</Text><Text style={styles.infoValue}>{studentInfo.roll_no}</Text></View>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Class:</Text><Text style={styles.infoValue}>{studentInfo.class_group}</Text></View>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Year:</Text><Text style={styles.infoValue}>{academicYear}</Text></View>
                </View>

                <Text style={styles.progressCardTitle}>PROGRESS CARD</Text>

                {/* Marks Table */}
                <View style={styles.table}>
                    {/* Header Row */}
                    <View style={styles.tableRow}>
                        <Text style={[styles.tableHeader, styles.subjectCol]}>Subjects</Text>
                        {DISPLAY_EXAM_ORDER.map(exam => <Text key={exam} style={[styles.tableHeader, styles.markCol]}>{exam}</Text>)}
                    </View>

                    {/* Subject Data Rows */}
                    {subjects.map(subject => (
                        <View key={subject} style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.subjectCol]}>{subject}</Text>
                            {DISPLAY_EXAM_ORDER.map(exam => (
                                <Text key={exam} style={[styles.tableCell, styles.markCol]}>
                                    {marksData[subject]?.[EXAM_MAPPING[exam]] ?? '-'}
                                </Text>
                            ))}
                        </View>
                    ))}

                    {/* Total Row */}
                     <View style={[styles.tableRow, styles.totalRow]}>
                        <Text style={[styles.tableHeader, styles.subjectCol]}>Total</Text>
                        {DISPLAY_EXAM_ORDER.map(exam => {
                            const columnTotal = subjects.reduce((sum, subject) => {
                                const mark = parseFloat(marksData[subject]?.[EXAM_MAPPING[exam]]);
                                return sum + (isNaN(mark) ? 0 : mark);
                            }, 0);
                            return (
                                <Text key={exam} style={[styles.tableHeader, styles.markCol]}>
                                    {columnTotal > 0 ? columnTotal : '-'}
                                </Text>
                            );
                        })}
                    </View>
                </View>

                {/* Attendance Table */}
                <Text style={styles.attendanceTitle}>Attendance Particulars</Text>
                <ScrollView horizontal>
                    <View>
                        <View style={styles.tableRow}>
                            <Text style={[styles.tableHeader, styles.attendanceHeaderCol]}>Month</Text>
                            {MONTHS.map(month => <Text key={month} style={[styles.tableHeader, styles.attendanceDataCol]}>{formatMonthForDisplay(month)}</Text>)}
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.attendanceHeaderCol, { fontWeight: 'bold' }]}>Working Days</Text>
                            {MONTHS.map(month => (
                                <Text key={month} style={[styles.tableCell, styles.attendanceDataCol]}>
                                    {attendanceData[month]?.workingDays ?? '-'}
                                </Text>
                            ))}
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.attendanceHeaderCol, { fontWeight: 'bold' }]}>Present Days</Text>
                            {MONTHS.map(month => (
                                <Text key={month} style={[styles.tableCell, styles.attendanceDataCol]}>
                                    {attendanceData[month]?.presentDays ?? '-'}
                                </Text>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e0e0e0',
        padding: 10,
    },
    card: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#000',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    errorText: {
        fontSize: 16,
        color: '#d32f2f'
    },
    schoolHeader: {
        alignItems: 'center',
        marginBottom: 15,
    },
    schoolName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
    },
    schoolSub: {
        fontSize: 14,
        color: '#333',
    },
    studentInfoContainer: {
        marginBottom: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    infoLabel: {
        fontWeight: 'bold',
        fontSize: 14,
        width: 80,
    },
    infoValue: {
        fontSize: 14,
        flex: 1,
    },
    progressCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 10,
        textDecorationLine: 'underline',
    },
    table: {
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: 20,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
    },
    tableHeader: {
        padding: 8,
        fontWeight: 'bold',
        textAlign: 'center',
        borderRightWidth: 1,
        borderRightColor: '#000',
        backgroundColor: '#f0f0f0',
        fontSize: 11,
    },
    tableCell: {
        padding: 8,
        textAlign: 'center',
        borderRightWidth: 1,
        borderRightColor: '#000',
        fontSize: 12,
    },
    subjectCol: {
        width: 80,
        textAlign: 'left',
    },
    markCol: {
        width: 45,
    },
    totalRow: {
        backgroundColor: '#e0e0e0',
    },
    attendanceTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    // Styles for horizontal scroll attendance table
    attendanceHeaderCol: {
        width: 100, // Fixed width for the first column
        textAlign: 'left',
    },
    attendanceDataCol: {
        width: 60, // Fixed width for data columns
    },
});

export default StudentReportCardScreen;