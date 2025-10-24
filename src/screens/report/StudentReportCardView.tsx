import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView,
    ActivityIndicator, Alert, Dimensions, Image
} from 'react-native';
import apiClient from '../../api/client'; // Assuming this client handles API calls
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext'; // Assuming Auth context is available

// --- Constants ---
const PRIMARY_COLOR = '#673AB7'; // Deep Purple
const ACCENT_COLOR = '#FFC107'; // Amber for alerts/highlights
const BORDER_COLOR = '#E0E0E0';
const HEADER_COLOR = '#F5F5F5';
const TEXT_COLOR_DARK = '#212121';
const TEXT_COLOR_MEDIUM = '#616161';

const ALL_EXAM_TYPES = [
    'Assignment 1', 'Assignment 2', 'Assignment 3', 'Assignment 4',
    'Unit Test 1', 'Unit Test 2', 'Unit Test 3', 'Unit Test 4',
    'SA 1', 'SA 2'
];

// --- Report Card View Component (Student Only) ---

const StudentReportCardView = () => {
    const { user } = useAuth();
    const studentId = user?.id;
    
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchProgressCard = async () => {
        if (!studentId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const response = await apiClient.get(`/reportcard/progresscard/${studentId}`);
            setData(response.data);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch report card.');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProgressCard();
    }, [studentId]);

    if (!user || user.role !== 'student') {
        return <Text style={styles.noDataText}>Access Denied. Only students can view this report card.</Text>;
    }

    if (loading) return <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 50 }} />;
    if (!data) return <Text style={styles.noDataText}>Report card data not found.</Text>;

    const { studentDetails, marks, attendance, overallTotals } = data;

    const getMarkDisplay = (subject, examType) => {
        return marks[subject] && marks[subject][examType] !== undefined
            ? marks[subject][examType]
            : '-';
    };

    const getMonthName = (monthYear) => {
        if (!monthYear) return '';
        const date = new Date(monthYear + '-01');
        return date.toLocaleString('en-US', { month: 'short' });
    };

    const totalWorkingDays = attendance.reduce((sum, att) => sum + att.total_working_days, 0);
    const totalDaysPresent = attendance.reduce((sum, att) => sum + att.days_present, 0);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Student Progress Card</Text>
            </View>
            <ScrollView contentContainerStyle={styles.cardScrollView}>
                <View style={styles.cardContainer}>
                    
                    {/* --- FRONT SIDE --- */}
                    <View style={[styles.cardSection, styles.cardFront]}>
                        <View style={styles.cardHeader}>
                            <Image
                                source={{ uri: 'https://cdn-icons-png.flaticon.com/128/992/992683.png' }} 
                                style={styles.logo}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.schoolName}>Modern School Management</Text>
                                <Text style={styles.reportTitle}>PROGRESS CARD (2023-2024)</Text>
                                <Text style={styles.reportSubtitle}>Class: {studentDetails.class_group}</Text>
                            </View>
                            <Image 
                                source={{ uri: studentDetails.profile_image_url || 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png' }}
                                style={styles.profileImage}
                            />
                        </View>

                        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Student Information</Text>
                        <View style={styles.detailsBox}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Student Name:</Text>
                                <Text style={styles.detailValue}>{studentDetails.full_name}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Roll No:</Text>
                                <Text style={styles.detailValue}>{studentDetails.roll_no}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Date of Birth:</Text>
                                <Text style={styles.detailValue}>{studentDetails.dob || 'N/A'}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Parent Name:</Text>
                                <Text style={styles.detailValue}>{studentDetails.parent_name || 'N/A'}</Text>
                            </View>
                        </View>


                        <Text style={[styles.sectionTitle, { marginTop: 25 }]}>Attendance Particulars</Text>
                        <View style={styles.attendanceTable}>
                            <View style={styles.attendanceRowHeader}>
                                <Text style={[styles.attendanceCellHeader, { width: 80 }]}>Month</Text>
                                <Text style={styles.attendanceCellHeader}>Working Days</Text>
                                <Text style={styles.attendanceCellHeader}>Days Present</Text>
                            </View>
                            {attendance.map((att, index) => (
                                <View key={index} style={styles.attendanceRow}>
                                    <Text style={[styles.attendanceCell, { width: 80, fontWeight: 'bold' }]}>{getMonthName(att.month)}</Text>
                                    <Text style={styles.attendanceCell}>{att.total_working_days}</Text>
                                    <Text style={styles.attendanceCell}>{att.days_present}</Text>
                                </View>
                            ))}
                            <View style={[styles.attendanceRow, styles.attendanceFooter]}>
                                <Text style={[styles.attendanceCell, { width: 80, fontWeight: '900', color: PRIMARY_COLOR }]}>Total</Text>
                                <Text style={[styles.attendanceCell, { fontWeight: '900', color: PRIMARY_COLOR }]}>{totalWorkingDays}</Text>
                                <Text style={[styles.attendanceCell, { fontWeight: '900', color: PRIMARY_COLOR }]}>{totalDaysPresent}</Text>
                            </View>
                        </View>
                    </View>

                    {/* --- BACK SIDE --- */}
                    <View style={[styles.cardSection, styles.cardBack]}>
                        <Text style={[styles.sectionTitle, { marginBottom: 15 }]}>Academic Assessment (Marks Out of Max.)</Text>
                        
                        <ScrollView horizontal>
                            <View>
                                <View style={styles.marksTableHeader}>
                                    <Text style={[styles.marksCellHeader, { width: 80, backgroundColor: PRIMARY_COLOR }]}>Subjects</Text>
                                    {ALL_EXAM_TYPES.map(exam => (
                                        <Text key={exam} style={styles.marksCellHeader}>{exam.replace('Assignment', 'Asg').replace('Unit Test', 'UT').replace(' ', '\n')}</Text>
                                    ))}
                                    <Text style={[styles.marksCellHeader, { width: 60, backgroundColor: ACCENT_COLOR, color: TEXT_COLOR_DARK }]}>OVERALL</Text>
                                </View>
                                
                                {Object.keys(marks).map(subject => (
                                    <View key={subject} style={styles.marksTableRow}>
                                        <Text style={[styles.marksCell, { width: 80, fontWeight: 'bold' }]}>{subject}</Text>
                                        {ALL_EXAM_TYPES.map(exam => (
                                            <Text key={exam} style={styles.marksCell}>
                                                {getMarkDisplay(subject, exam)}
                                            </Text>
                                        ))}
                                        <Text style={[styles.marksCell, { width: 60, fontWeight: 'bold', backgroundColor: '#FFF9C4' }]}>
                                            {overallTotals[subject] || 0}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>

                        <View style={styles.signatureContainer}>
                            <Text style={styles.signatureText}>Parent Signature: _________________________</Text>
                            <Text style={styles.signatureText}>Class Teacher Signature: _________________________</Text>
                        </View>
                        
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F4F6F8' },
    header: { padding: 15, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: 'white', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_COLOR_DARK },
    noDataText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: TEXT_COLOR_MEDIUM },

    // --- Progress Card Styles ---
    cardScrollView: { padding: 10 },
    cardContainer: { backgroundColor: 'white', borderRadius: 15, elevation: 10, shadowColor: PRIMARY_COLOR, shadowOpacity: 0.1, shadowRadius: 10, marginBottom: 20, overflow: 'hidden' },
    cardSection: { padding: 20, margin: 5, borderRadius: 10 },
    cardFront: { backgroundColor: '#F9F9FF' }, 
    cardBack: { backgroundColor: '#FFFFFF' },
    
    cardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: ACCENT_COLOR, paddingBottom: 15, marginBottom: 15 },
    logo: { width: 50, height: 50, resizeMode: 'contain', marginRight: 15 },
    schoolName: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_COLOR },
    reportTitle: { fontSize: 24, fontWeight: '900', color: TEXT_COLOR_DARK, marginVertical: 4 },
    reportSubtitle: { fontSize: 14, color: TEXT_COLOR_MEDIUM },
    profileImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: PRIMARY_COLOR, marginLeft: 10 },
    
    detailsBox: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, marginTop: 5 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    detailLabel: { fontSize: 14, color: TEXT_COLOR_MEDIUM, fontWeight: '500' },
    detailValue: { fontSize: 14, color: TEXT_COLOR_DARK, fontWeight: '700' },
    
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_COLOR, marginTop: 10, borderLeftWidth: 4, borderColor: ACCENT_COLOR, paddingLeft: 10, marginBottom: 5 },

    // Attendance Table Styles
    attendanceTable: { marginTop: 10, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, overflow: 'hidden' },
    attendanceRowHeader: { flexDirection: 'row', backgroundColor: PRIMARY_COLOR, },
    attendanceCellHeader: { flex: 1, padding: 10, textAlign: 'center', color: 'white', fontWeight: 'bold', fontSize: 12, borderRightWidth: 1, borderRightColor: '#532C9E' },
    attendanceRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: '#FFF' },
    attendanceCell: { flex: 1, padding: 10, textAlign: 'center', fontSize: 13, color: TEXT_COLOR_DARK, borderRightWidth: 1, borderRightColor: BORDER_COLOR },
    attendanceFooter: { backgroundColor: '#E8EAF6', borderTopWidth: 2, borderTopColor: PRIMARY_COLOR },

    // Marks Table Styles 
    marksTableHeader: { flexDirection: 'row', backgroundColor: '#9575CD', height: 60 },
    marksCellHeader: { width: 50, padding: 5, textAlign: 'center', color: 'white', fontWeight: 'bold', fontSize: 10, borderRightWidth: 1, borderRightColor: '#532C9E', justifyContent: 'center', alignItems: 'center' },
    marksTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: '#FFF' },
    marksCell: { width: 50, padding: 8, textAlign: 'center', fontSize: 12, color: TEXT_COLOR_DARK, borderRightWidth: 1, borderRightColor: BORDER_COLOR },
    signatureContainer: { marginTop: 30, padding: 10, backgroundColor: HEADER_COLOR, borderRadius: 8 },
    signatureText: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginBottom: 10, fontWeight: '500' },
});

export default StudentReportCardView;