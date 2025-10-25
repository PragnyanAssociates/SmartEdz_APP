/**
 * File: src/screens/report/StudentReportCardScreen.js
 * Purpose: Student's personal report card view with all marks and attendance
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, ActivityIndicator,
    Image, Dimensions
} from 'react-native';
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

const StudentReportCardScreen = () => {
    const [loading, setLoading] = useState(true);
    const [studentInfo, setStudentInfo] = useState(null);
    const [marksData, setMarksData] = useState({});
    const [attendanceData, setAttendanceData] = useState({});
    const [academicYear, setAcademicYear] = useState('');

    useEffect(() => {
        fetchReportCard();
    }, []);

    const fetchReportCard = async () => {
        try {
            const response = await apiClient.get('/reports/my-report-card');
            const { studentInfo, marks, attendance, academicYear } = response.data;

            setStudentInfo(studentInfo);
            setAcademicYear(academicYear);

            const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];

            // Initialize marks data
            const marksMap = {};
            subjects.forEach(subject => {
                marksMap[subject] = {};
                EXAM_TYPES.forEach(examType => {
                    marksMap[subject][examType] = '-';
                });
            });

            // Fill existing marks
            marks.forEach(mark => {
                if (marksMap[mark.subject]) {
                    marksMap[mark.subject][mark.exam_type] = 
                        mark.marks_obtained !== null ? mark.marks_obtained.toString() : '-';
                }
            });

            setMarksData(marksMap);

            // Initialize attendance data
            const attendanceMap = {};
            MONTHS.forEach(month => {
                attendanceMap[month] = { workingDays: '-', presentDays: '-' };
            });

            // Fill existing attendance
            attendance.forEach(att => {
                attendanceMap[att.month] = {
                    workingDays: att.working_days !== null ? att.working_days.toString() : '-',
                    presentDays: att.present_days !== null ? att.present_days.toString() : '-'
                };
            });

            setAttendanceData(attendanceMap);
        } catch (error) {
            console.error('Error fetching report card:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#2c3e50" />
            </View>
        );
    }

    if (!studentInfo) {
        return (
            <View style={styles.loaderContainer}>
                <Text style={styles.errorText}>No report card data available</Text>
            </View>
        );
    }

    const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];

    return (
        <ScrollView style={styles.container}>
            {/* Header Section */}
            <View style={styles.header}>
                <Text style={styles.schoolName}>Student Progress Report</Text>
                <Text style={styles.academicYear}>Academic Year: {academicYear}</Text>
            </View>

            {/* Student Info Card */}
            <View style={styles.infoCard}>
                {studentInfo.profile_image_url && (
                    <Image
                        source={{ uri: studentInfo.profile_image_url }}
                        style={styles.profileImage}
                    />
                )}
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Name:</Text>
                    <Text style={styles.infoValue}>{studentInfo.full_name}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Roll No:</Text>
                    <Text style={styles.infoValue}>{studentInfo.roll_no}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Class:</Text>
                    <Text style={styles.infoValue}>{studentInfo.class_group}</Text>
                </View>
                {studentInfo.father_name && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Father's Name:</Text>
                        <Text style={styles.infoValue}>{studentInfo.father_name}</Text>
                    </View>
                )}
                {studentInfo.mother_name && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Mother's Name:</Text>
                        <Text style={styles.infoValue}>{studentInfo.mother_name}</Text>
                    </View>
                )}
                {studentInfo.date_of_birth && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Date of Birth:</Text>
                        <Text style={styles.infoValue}>
                            {new Date(studentInfo.date_of_birth).toLocaleDateString()}
                        </Text>
                    </View>
                )}
            </View>

            {/* Marks Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Academic Performance</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                        {/* Header Row */}
                        <View style={styles.tableRow}>
                            <Text style={[styles.tableHeader, styles.subjectHeaderColumn]}>Subject</Text>
                            {EXAM_TYPES.map(exam => (
                                <Text key={exam} style={[styles.tableHeader, styles.examColumn]}>
                                    {exam}
                                </Text>
                            ))}
                        </View>

                        {/* Subject Rows */}
                        {subjects.map(subject => (
                            <View key={subject} style={styles.tableRow}>
                                <Text style={[styles.tableCell, styles.subjectHeaderColumn, styles.subjectName]}>
                                    {subject}
                                </Text>
                                {EXAM_TYPES.map(exam => {
                                    const mark = marksData[subject][exam];
                                    const isOverall = exam === 'Overall';
                                    return (
                                        <Text
                                            key={exam}
                                            style={[
                                                styles.tableCell,
                                                styles.examColumn,
                                                isOverall && styles.overallCell
                                            ]}
                                        >
                                            {mark}
                                        </Text>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* Attendance Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Monthly Attendance</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                        {/* Header Row */}
                        <View style={styles.tableRow}>
                            <Text style={[styles.tableHeader, styles.monthColumn]}>Month</Text>
                            <Text style={[styles.tableHeader, styles.attendanceValueColumn]}>Working Days</Text>
                            <Text style={[styles.tableHeader, styles.attendanceValueColumn]}>Present Days</Text>
                            <Text style={[styles.tableHeader, styles.attendanceValueColumn]}>Percentage</Text>
                        </View>

                        {/* Month Rows */}
                        {MONTHS.map(month => {
                            const att = attendanceData[month];
                            const working = parseFloat(att.workingDays);
                            const present = parseFloat(att.presentDays);
                            const percentage = (!isNaN(working) && !isNaN(present) && working > 0)
                                ? ((present / working) * 100).toFixed(1) + '%'
                                : '-';

                            return (
                                <View key={month} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, styles.monthColumn]}>{month}</Text>
                                    <Text style={[styles.tableCell, styles.attendanceValueColumn]}>
                                        {att.workingDays}
                                    </Text>
                                    <Text style={[styles.tableCell, styles.attendanceValueColumn]}>
                                        {att.presentDays}
                                    </Text>
                                    <Text style={[styles.tableCell, styles.attendanceValueColumn, styles.percentageCell]}>
                                        {percentage}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>End of Report Card</Text>
            </View>
        </ScrollView>
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
    errorText: {
        fontSize: 16,
        color: '#e74c3c'
    },
    header: {
        backgroundColor: '#2c3e50',
        padding: 20,
        alignItems: 'center'
    },
    schoolName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5
    },
    academicYear: {
        fontSize: 16,
        color: '#ecf0f1'
    },
    infoCard: {
        backgroundColor: '#fff',
        margin: 15,
        padding: 20,
        borderRadius: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignSelf: 'center',
        marginBottom: 15,
        borderWidth: 3,
        borderColor: '#2c3e50'
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 10
    },
    infoLabel: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#34495e',
        width: 140
    },
    infoValue: {
        fontSize: 15,
        color: '#2c3e50',
        flex: 1
    },
    section: {
        backgroundColor: '#fff',
        margin: 15,
        marginTop: 0,
        padding: 15,
        borderRadius: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 15,
        borderBottomWidth: 2,
        borderBottomColor: '#3498db',
        paddingBottom: 5
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
        color: '#fff',
        textAlign: 'center',
        fontSize: 12,
        borderRightWidth: 1,
        borderRightColor: '#fff'
    },
    tableCell: {
        padding: 12,
        backgroundColor: '#fff',
        textAlign: 'center',
        fontSize: 13,
        borderRightWidth: 1,
        borderRightColor: '#ddd',
        color: '#2c3e50'
    },
    subjectHeaderColumn: {
        width: 120,
        textAlign: 'left',
        paddingLeft: 10
    },
    subjectName: {
        fontWeight: 'bold',
        backgroundColor: '#ecf0f1'
    },
    examColumn: {
        width: 90
    },
    overallCell: {
        backgroundColor: '#fff3cd',
        fontWeight: 'bold',
        color: '#856404'
    },
    monthColumn: {
        width: 120,
        textAlign: 'left',
        paddingLeft: 10
    },
    attendanceValueColumn: {
        width: 100
    },
    percentageCell: {
        fontWeight: 'bold',
        color: '#27ae60'
    },
    footer: {
        padding: 30,
        alignItems: 'center'
    },
    footerText: {
        fontSize: 14,
        color: '#7f8c8d',
        fontStyle: 'italic'
    }
});

export default StudentReportCardScreen;
