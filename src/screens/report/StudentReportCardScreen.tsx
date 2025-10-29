/**
 * File: src/screens/report/StudentReportCardScreen.js
 * Purpose: A visually appealing, downloadable report card for students.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet, ActivityIndicator, Image,
    TouchableOpacity, Alert, PermissionsAndroid, Platform
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Feather from 'react-native-vector-icons/Feather'; // Using Feather for a clean icon
import apiClient from '../../api/client';

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

const EXAM_MAPPING = {
    'AT1': 'Assignment-1', 'UT1': 'Unitest-1',
    'AT2': 'Assignment-2', 'UT2': 'Unitest-2',
    'AT3': 'Assignment-3', 'UT3': 'Unitest-3',
    'AT4': 'Assignment-4', 'UT4': 'Unitest-4',
    'SA1': 'SA1', 'SA2': 'SA2', 'Total': 'Overall'
};

const DISPLAY_EXAM_ORDER = ['AT1', 'UT1', 'AT2', 'UT2', 'AT3', 'UT3', 'AT4', 'UT4','SA1', 'SA2', 'Total'];
const MONTHS = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'];

const StudentReportCardScreen = () => {
    const viewShotRef = useRef();
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
        // ... (your existing fetch logic remains the same)
        try {
            const response = await apiClient.get('/reports/my-report-card');
            const { studentInfo, marks, attendance, academicYear } = response.data;
            if (!studentInfo || !studentInfo.class_group) { throw new Error("Student data is incomplete."); }
            setStudentInfo(studentInfo); setAcademicYear(academicYear);
            const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];
            const marksMap = {};
            subjects.forEach(subject => { marksMap[subject] = {}; Object.values(EXAM_MAPPING).forEach(examKey => { marksMap[subject][examKey] = '-'; }); });
            marks.forEach(mark => { const displayExamType = EXAM_MAPPING[mark.exam_type]; if (marksMap[mark.subject] && displayExamType) { marksMap[mark.subject][displayExamType] = mark.marks_obtained !== null ? mark.marks_obtained.toString() : '-'; } });
            setMarksData(marksMap);
            const attendanceMap = {};
            attendance.forEach(att => { if (att.month) { attendanceMap[att.month] = { workingDays: att.working_days ?? '-', presentDays: att.present_days ?? '-' }; } });
            setAttendanceData(attendanceMap);
        } catch (err) { console.error('Error fetching report card:', err); setError('Could not load report card data. Please try again later.'); } finally { setLoading(false); }
    };

    const handleDownload = async () => {
        // 1. Check permissions
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                {
                    title: 'Storage Permission Required',
                    message: 'This app needs access to your storage to download the report card.',
                    buttonPositive: 'OK',
                },
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert('Permission Denied', 'Storage permission is required to save the image.');
                return;
            }
        }

        // 2. Capture the view
        try {
            const uri = await viewShotRef.current.capture();
            await CameraRoll.save(uri, { type: 'photo' });
            Alert.alert('Success', 'Report card saved to your photo gallery!');
        } catch (error) {
            console.error('Failed to save report card:', error);
            Alert.alert('Error', 'Failed to save the report card. Please try again.');
        }
    };

    if (loading) { return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#008080" /></View>; }
    if (error || !studentInfo) { return <View style={styles.loaderContainer}><Text style={styles.errorText}>{error || 'No report card data available.'}</Text></View>; }

    const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];
    const formatMonthForDisplay = (month) => { if (month === 'September') return 'Sept'; return month.substring(0, 3); };

    return (
        <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
                    <View style={styles.card}>
                        <View style={styles.schoolHeader}>
                            <Image
                                source={require('../../assets/logo.png')} // Make sure this path is correct
                                style={styles.logo}
                            />
                            <Text style={styles.schoolName}>VIVEKANANDA PUBLIC SCHOOL</Text>
                            <Text style={styles.schoolSub}>ENGLISH MEDIUM</Text>
                            <Text style={styles.schoolContact}>vivekanandaschoolhyd@gmail.com</Text>
                            <Text style={styles.schoolAddress}>
                                H.No:8-3-1100/A & A1.Plot No.112(Near Drishti Hospital), Srinagar Colony, Hyderabad: 500016
                            </Text>
                            <Text style={styles.schoolAddress}>
                                Phone: +91-891-2553221/2501951 | Fax: +91-891-2504644
                            </Text>
                        </View>

                        <View style={styles.studentInfoContainer}>
                            <View style={styles.infoRow}><Text style={styles.infoLabel}>Name:</Text><Text style={styles.infoValue}>{studentInfo.full_name}</Text></View>
                            <View style={styles.infoRow}><Text style={styles.infoLabel}>Roll No:</Text><Text style={styles.infoValue}>{studentInfo.roll_no}</Text></View>
                            <View style={styles.infoRow}><Text style={styles.infoLabel}>Class:</Text><Text style={styles.infoValue}>{studentInfo.class_group}</Text></View>
                            <View style={styles.infoRow}><Text style={styles.infoLabel}>Year:</Text><Text style={styles.infoValue}>{academicYear}</Text></View>
                        </View>

                        <Text style={styles.sectionTitle}>PROGRESS CARD</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.table}>
                                <View style={styles.tableRow}>
                                    <Text style={[styles.tableHeader, styles.subjectCol]}>Subjects</Text>
                                    {DISPLAY_EXAM_ORDER.map(exam => <Text key={exam} style={[styles.tableHeader, styles.markCol]}>{exam}</Text>)}
                                </View>
                                {subjects.map(subject => (
                                    <View key={subject} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, styles.subjectCol]}>{subject}</Text>
                                        {DISPLAY_EXAM_ORDER.map(exam => <Text key={exam} style={[styles.tableCell, styles.markCol]}>{marksData[subject]?.[EXAM_MAPPING[exam]] ?? '-'}</Text>)}
                                    </View>
                                ))}
                                <View style={[styles.tableRow, styles.totalRow]}>
                                    <Text style={[styles.tableHeader, styles.subjectCol]}>Total</Text>
                                    {DISPLAY_EXAM_ORDER.map(exam => {
                                        const total = subjects.reduce((sum, subject) => {
                                            const mark = parseFloat(marksData[subject]?.[EXAM_MAPPING[exam]]);
                                            return sum + (isNaN(mark) ? 0 : mark);
                                        }, 0);
                                        return <Text key={exam} style={[styles.tableHeader, styles.markCol]}>{total > 0 ? total : '-'}</Text>;
                                    })}
                                </View>
                            </View>
                        </ScrollView>

                        <Text style={styles.sectionTitle}>ATTENDANCE PARTICULARS</Text>
                         <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.table}>
                                <View style={styles.tableRow}>
                                    <Text style={[styles.tableHeader, styles.attendanceHeaderCol]}>Month</Text>
                                    {MONTHS.map(month => <Text key={month} style={[styles.tableHeader, styles.attendanceDataCol]}>{formatMonthForDisplay(month)}</Text>)}
                                </View>
                                <View style={styles.tableRow}>
                                    <Text style={[styles.tableCell, styles.attendanceHeaderCol]}>Working Days</Text>
                                    {MONTHS.map(month => <Text key={month} style={[styles.tableCell, styles.attendanceDataCol]}>{attendanceData[month]?.workingDays ?? '-'}</Text>)}
                                </View>
                                <View style={styles.tableRow}>
                                    <Text style={[styles.tableCell, styles.attendanceHeaderCol]}>Present Days</Text>
                                    {MONTHS.map(month => <Text key={month} style={[styles.tableCell, styles.attendanceDataCol]}>{attendanceData[month]?.presentDays ?? '-'}</Text>)}
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </ViewShot>
            </ScrollView>

            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                <Feather name="download" size={24} color="#fff" />
                <Text style={styles.downloadButtonText}>Download Report</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f4f6f8',
        padding: 15,
        paddingBottom: 100, // Make space for the download button
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f6f8' },
    errorText: { fontSize: 16, color: '#d32f2f', textAlign: 'center' },

    schoolHeader: { alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 20 },
    logo: { width: 400, height: 130, resizeMode: 'contain', marginBottom: -10 },
    schoolName: { fontSize: 22, fontWeight: 'bold', color: '#1a252f' },
    schoolSub: { fontSize: 16, color: '#5a6a78', marginTop: 2 },
    schoolContact: { fontSize: 14, color: '#5a6a78', marginTop: 8 },
    schoolAddress: { fontSize: 12, color: '#7f8c98', textAlign: 'center', marginTop: 4, lineHeight: 18 },

    studentInfoContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 15,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: '#e9ecef'
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    infoLabel: { fontSize: 15, fontWeight: '600', color: '#495057', width: 80 },
    infoValue: { fontSize: 15, color: '#212529', flex: 1 },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40', textAlign: 'center', marginVertical: 20 },

    table: { borderWidth: 1, borderColor: '#dfe4ea', borderRadius: 8, overflow: 'hidden' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#dfe4ea' },
    tableHeader: { padding: 12, fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f8f9fa', color: '#495057', fontSize: 13, borderRightWidth: 1, borderRightColor: '#dfe4ea' },
    tableCell: { padding: 12, textAlign: 'center', color: '#212529', fontSize: 14, borderRightWidth: 1, borderRightColor: '#dfe4ea' },
    subjectCol: { width: 90, textAlign: 'left', fontWeight: '600' },
    markCol: { width: 55 },
    totalRow: { backgroundColor: '#f1f3f5' },
    
    attendanceHeaderCol: { width: 120, textAlign: 'left', fontWeight: '600'},
    attendanceDataCol: { width: 70 },
    
    downloadButton: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#008080',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 15,
        borderRadius: 10,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    downloadButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
});

export default StudentReportCardScreen;