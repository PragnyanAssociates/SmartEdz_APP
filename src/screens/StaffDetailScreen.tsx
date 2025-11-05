import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
    TouchableOpacity, Modal, Pressable, Platform, UIManager, LayoutAnimation, Alert
} from 'react-native';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';
import TimetableScreen from './TimetableScreen';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return currentMonth >= 5 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const StaffDetailScreen = ({ route }) => {
    const { staffId } = route.params;
    const [staffDetails, setStaffDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isViewerVisible, setViewerVisible] = useState(false);

    // State for each collapsible section
    const [isProfessionalExpanded, setIsProfessionalExpanded] = useState(false); // ★★★ NEW STATE ★★★
    const [isTimetableExpanded, setIsTimetableExpanded] = useState(false);
    const [isPerformanceExpanded, setIsPerformanceExpanded] = useState(false);
    const [isAttendanceExpanded, setIsAttendanceExpanded] = useState(false);

    // State for Performance data
    const [performanceDetails, setPerformanceDetails] = useState([]);
    const [performanceLoading, setPerformanceLoading] = useState(false);
    
    // State for Attendance data
    const [attendanceReport, setAttendanceReport] = useState(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [attendanceViewMode, setAttendanceViewMode] = useState('overall');
    const [attendanceSelectedDate, setAttendanceSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const scrollViewRef = useRef(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const response = await apiClient.get(`/staff/${staffId}`);
                setStaffDetails(response.data);
            } catch (error) {
                console.error('Error fetching staff details:', error);
            } finally {
                setLoading(false);
            }
        };
        if (staffId) {
            fetchDetails();
        }
    }, [staffId]);
    
    const scrollToBottom = () => {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    };

    // ★★★ NEW HANDLER ★★★
    const handleProfessionalToggle = () => {
        if (!isProfessionalExpanded) scrollToBottom();
        setIsProfessionalExpanded(prevState => !prevState);
    };

    const handleTimetableToggle = () => {
        if (!isTimetableExpanded) scrollToBottom();
        setIsTimetableExpanded(prevState => !prevState);
    };

    const handlePerformanceToggle = async () => {
        if (!isPerformanceExpanded) {
            if (performanceDetails.length === 0) {
                setPerformanceLoading(true);
                try {
                    const academicYear = getCurrentAcademicYear();
                    const response = await apiClient.get(`/performance/teacher/${staffId}/${academicYear}`);
                    setPerformanceDetails(response.data);
                } catch (error) {
                    console.error("Failed to fetch performance data:", error);
                } finally {
                    setPerformanceLoading(false);
                }
            }
            scrollToBottom();
        }
        setIsPerformanceExpanded(prevState => !prevState);
    };

    const fetchAttendanceReport = useCallback(async (mode, date) => {
        if (!staffId) return;
        setAttendanceLoading(true);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        const params = { period: mode };
        const dateString = date.toISOString().slice(0, 10);
        if (mode === 'daily') params.targetDate = dateString;
        if (mode === 'monthly') params.targetMonth = dateString.slice(0, 7);

        try {
            const response = await apiClient.get(`/teacher-attendance/report/${staffId}`, { params });
            setAttendanceReport(response.data);
        } catch (error) {
            console.error("Attendance Report Error:", error);
            setAttendanceReport(null);
        } finally {
            setAttendanceLoading(false);
        }
    }, [staffId]);

    const handleAttendanceToggle = () => {
        if (!isAttendanceExpanded) {
            if (!attendanceReport) {
                fetchAttendanceReport(attendanceViewMode, attendanceSelectedDate);
            }
            scrollToBottom();
        }
        setIsAttendanceExpanded(prevState => !prevState);
    };
    
    useEffect(() => {
        if (isAttendanceExpanded) {
            fetchAttendanceReport(attendanceViewMode, attendanceSelectedDate);
        }
    }, [attendanceViewMode, attendanceSelectedDate, isAttendanceExpanded]);

    const onDateChange = (event, date) => {
        setShowDatePicker(Platform.OS === 'ios'); 
        if (date) {
            setAttendanceSelectedDate(date);
            if (attendanceViewMode !== 'daily') setAttendanceViewMode('daily'); 
        }
    };

    const overallStats = useMemo(() => {
        if (!performanceDetails || performanceDetails.length === 0) return { total: 0, average: 0 };
        const total = performanceDetails.reduce((sum, item) => sum + parseInt(item.total_marks || 0), 0);
        const validItems = performanceDetails.filter(item => item.average_marks > 0);
        const average = validItems.length > 0 ? validItems.reduce((sum, item) => sum + parseFloat(item.average_marks), 0) / validItems.length : 0;
        return { total, average };
    }, [performanceDetails]);

    const attendanceSummary = useMemo(() => attendanceReport?.stats || { overallPercentage: '0.0', daysPresent: 0, daysAbsent: 0 }, [attendanceReport]);

    const DetailRow = ({ label, value }) => (
        <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not Provided'}</Text></View>
    );

    if (loading) return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#008080" /></View>;
    if (!staffDetails) return <View style={styles.loaderContainer}><Text>Could not load staff details.</Text></View>;

    const imageUrl = staffDetails.profile_image_url ? `${SERVER_URL}${staffDetails.profile_image_url}` : null;
    const displayRole = staffDetails.role === 'admin' ? staffDetails.class_group : staffDetails.role;
    const subjectsDisplay = staffDetails.subjects_taught && Array.isArray(staffDetails.subjects_taught) && staffDetails.subjects_taught.length > 0 ? staffDetails.subjects_taught.join(', ') : 'Not Provided';

    return (
        <View style={{ flex: 1 }}>
            <Modal visible={isViewerVisible} transparent={true} onRequestClose={() => setViewerVisible(false)} animationType="fade">
                <Pressable style={styles.modalBackdrop} onPress={() => setViewerVisible(false)}><View style={styles.modalContent}><Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.enlargedAvatar} resizeMode="contain" /><TouchableOpacity style={styles.closeButton} onPress={() => setViewerVisible(false)}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity></View></Pressable>
            </Modal>
            
            <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
                <View style={styles.profileHeader}><TouchableOpacity onPress={() => setViewerVisible(true)}><Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.avatar} /></TouchableOpacity><Text style={styles.fullName}>{staffDetails.full_name}</Text><Text style={styles.role}>{displayRole}</Text></View>
                
                {/* Static Cards */}
                <View style={styles.card}><Text style={styles.cardTitle}>Personal Details</Text><DetailRow label="Username" value={staffDetails.username} />{staffDetails.role === 'teacher' && (<DetailRow label="Subjects Taught" value={subjectsDisplay} />)}<DetailRow label="Date of Birth" value={staffDetails.dob} /><DetailRow label="Gender" value={staffDetails.gender} /></View>
                <View style={styles.card}><Text style={styles.cardTitle}>Contact Details</Text><DetailRow label="Mobile No" value={staffDetails.phone} /><DetailRow label="Email Address" value={staffDetails.email} /><DetailRow label="Address" value={staffDetails.address} /></View>

                {/* --- MODIFICATION IS HERE: Professional Details is now collapsible --- */}
                <View style={styles.collapsibleCard}>
                    <TouchableOpacity style={styles.collapsibleHeader} onPress={handleProfessionalToggle} activeOpacity={0.8}>
                        <Text style={styles.collapsibleTitle}>Professional Details</Text>
                        <Text style={styles.arrowIcon}>{isProfessionalExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {isProfessionalExpanded && (
                        <View style={styles.cardContent}>
                            <DetailRow label="Aadhar No." value={staffDetails.aadhar_no} />
                            <DetailRow label="Joining Date" value={staffDetails.joining_date} />
                            <DetailRow label="Previous Salary" value={staffDetails.previous_salary} />
                            <DetailRow label="Present Salary" value={staffDetails.present_salary} />
                            <DetailRow label="Experience" value={staffDetails.experience} />
                        </View>
                    )}
                </View>

                {/* Other Collapsible Cards for Teachers */}
                {staffDetails.role === 'teacher' && (
                    <>
                        <View style={styles.collapsibleCard}><TouchableOpacity style={styles.collapsibleHeader} onPress={handleTimetableToggle} activeOpacity={0.8} ><Text style={styles.collapsibleTitle}>Timetable</Text><Text style={styles.arrowIcon}>{isTimetableExpanded ? '▲' : '▼'}</Text></TouchableOpacity>{isTimetableExpanded && <TimetableScreen teacherId={staffId} isEmbedded={true} />}</View>
                        <View style={styles.collapsibleCard}><TouchableOpacity style={styles.collapsibleHeader} onPress={handlePerformanceToggle} activeOpacity={0.8} ><Text style={styles.collapsibleTitle}>Performance</Text><Text style={styles.arrowIcon}>{isPerformanceExpanded ? '▲' : '▼'}</Text></TouchableOpacity>{isPerformanceExpanded && (performanceLoading ? <ActivityIndicator size="large" color="#008080" style={{ padding: 20 }} /> : <View><View style={styles.teacherHeader}><Text style={styles.teacherName}>{staffDetails.full_name}</Text><View style={styles.teacherStatsContainer}><Text style={styles.overallStat}>Total: <Text style={styles.overallValue}>{overallStats.total}</Text></Text><Text style={styles.overallStat}>Avg: <Text style={styles.averageValue}>{overallStats.average.toFixed(2)}%</Text></Text></View></View>{performanceDetails.length > 0 ? <><View style={styles.detailHeaderRow}><Text style={[styles.detailHeaderText, { flex: 2.5 }]}>Class / Subject</Text><Text style={[styles.detailHeaderText, { flex: 1.5, textAlign: 'center' }]}>Total</Text><Text style={[styles.detailHeaderText, { flex: 1.5, textAlign: 'right' }]}>Average</Text></View>{performanceDetails.map((detail, index) => (<View key={index} style={[styles.detailRowPerformance, index === performanceDetails.length - 1 && styles.lastDetailRow]}><Text style={styles.detailColumnSubject}>{`${detail.class_group} - ${detail.subject}`}</Text><Text style={styles.detailColumnTotal}>{detail.total_marks}</Text><Text style={styles.detailColumnAverage}>{parseFloat(detail.average_marks).toFixed(2)}%</Text></View>))}</> : <View style={styles.noDataContainer}><Text style={styles.noDataText}>No performance data available.</Text></View>}</View>)}</View>
                        <View style={styles.collapsibleCard}><TouchableOpacity style={styles.collapsibleHeader} onPress={handleAttendanceToggle} activeOpacity={0.8} ><Text style={styles.collapsibleTitle}>Attendance</Text><Text style={styles.arrowIcon}>{isAttendanceExpanded ? '▲' : '▼'}</Text></TouchableOpacity>{isAttendanceExpanded && (<View><View style={styles.attToggleContainer}><TouchableOpacity style={[styles.attToggleButton, attendanceViewMode === 'daily' && styles.attToggleButtonActive]} onPress={() => setAttendanceViewMode('daily')}><Text style={[styles.attToggleButtonText, attendanceViewMode === 'daily' && styles.attToggleButtonTextActive]}>Daily</Text></TouchableOpacity><TouchableOpacity style={[styles.attToggleButton, attendanceViewMode === 'monthly' && styles.attToggleButtonActive]} onPress={() => setAttendanceViewMode('monthly')}><Text style={[styles.attToggleButtonText, attendanceViewMode === 'monthly' && styles.attToggleButtonTextActive]}>Monthly</Text></TouchableOpacity><TouchableOpacity style={[styles.attToggleButton, attendanceViewMode === 'overall' && styles.attToggleButtonActive]} onPress={() => setAttendanceViewMode('overall')}><Text style={[styles.attToggleButtonText, attendanceViewMode === 'overall' && styles.attToggleButtonTextActive]}>Overall</Text></TouchableOpacity><TouchableOpacity style={styles.attCalendarButton} onPress={() => setShowDatePicker(true)}><Icon name="calendar" size={22} color="#008080" /></TouchableOpacity></View>{showDatePicker && (<DateTimePicker value={attendanceSelectedDate} mode="date" display="default" onChange={onDateChange} />)}{attendanceLoading ? <ActivityIndicator size="large" color="#008080" style={{ padding: 20 }} /> : (<><View style={styles.attSummaryContainer}><View style={styles.attSummaryBox}><Text style={[styles.attSummaryValue, { color: '#1E88E5' }]}>{attendanceSummary.overallPercentage}%</Text><Text style={styles.attSummaryLabel}>Overall %</Text></View><View style={styles.attSummaryBox}><Text style={[styles.attSummaryValue, { color: '#43A047' }]}>{attendanceSummary.daysPresent}</Text><Text style={styles.attSummaryLabel}>Days Present</Text></View><View style={styles.attSummaryBox}><Text style={[styles.attSummaryValue, { color: '#E53935' }]}>{attendanceSummary.daysAbsent}</Text><Text style={styles.attSummaryLabel}>Days Absent</Text></View></View><View style={styles.attHistoryContainer}><Text style={styles.attHistoryTitle}>Detailed History ({capitalize(attendanceViewMode)})</Text>{attendanceReport?.detailedHistory?.length > 0 ? (attendanceReport.detailedHistory.map((item, index) => (<View key={item.date} style={styles.attHistoryCard}><Text style={styles.attHistoryDate}>{new Date(item.date).toDateString()}</Text><Text style={[styles.attHistoryStatus, { color: item.status === 'P' ? '#43A047' : '#E53935' }]}>{item.status === 'P' ? 'Present' : 'Absent'}</Text></View>))) : (<Text style={styles.noDataText}>No records found for this period.</Text>)}</View></>)}</View>)}</View>
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    scrollContentContainer: { paddingBottom: 20 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    profileHeader: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 15, backgroundColor: '#008080' },
    avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#ffffff', marginBottom: 15, backgroundColor: '#bdc3c7' },
    fullName: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
    role: { fontSize: 16, color: '#ecf0f1', marginTop: 5, backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 15, textTransform: 'capitalize' },
    card: { backgroundColor: '#ffffff', borderRadius: 8, marginHorizontal: 15, marginTop: 15, paddingHorizontal: 15, paddingBottom: 5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f2f5', marginBottom: 5 },
    cardContent: { paddingHorizontal: 15, paddingBottom: 5 }, // ★★★ NEW STYLE ★★★ for collapsible content
    detailRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f2f5', alignItems: 'center' },
    detailLabel: { fontSize: 15, color: '#7f8c8d', flex: 2 },
    detailValue: { fontSize: 15, color: '#2c3e50', flex: 3, fontWeight: '500', textAlign: 'right' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', height: '70%', justifyContent: 'center', alignItems: 'center' },
    enlargedAvatar: { width: '100%', height: '100%', borderRadius: 10 },
    closeButton: { position: 'absolute', bottom: -20, backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 35, borderRadius: 25 },
    closeButtonText: { color: '#2c3e50', fontSize: 16, fontWeight: 'bold' },
    collapsibleCard: { backgroundColor: '#ffffff', borderRadius: 8, marginHorizontal: 15, marginTop: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, overflow: 'hidden' },
    collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    collapsibleTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080' },
    arrowIcon: { fontSize: 20, color: '#008080' },
    noDataContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
    noDataText: { fontSize: 16, color: '#7f8c8d', textAlign: 'center' },
    teacherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#34495e' },
    teacherName: { fontSize: 18, fontWeight: '600', color: '#ffffff', flexShrink: 1 },
    teacherStatsContainer: { alignItems: 'flex-end' },
    overallStat: { fontSize: 14, color: '#ecf0f1', lineHeight: 20 },
    overallValue: { fontWeight: 'bold', color: '#ffffff' },
    averageValue: { fontWeight: 'bold', color: '#2ecc71' },
    detailHeaderRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#f8f9fa', borderBottomWidth: 2, borderBottomColor: '#e9ecef' },
    detailHeaderText: { fontSize: 12, fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', letterSpacing: 0.5 },
    detailRowPerformance: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f2f5' },
    lastDetailRow: { borderBottomWidth: 0 },
    detailColumnSubject: { flex: 2.5, fontSize: 15, color: '#34495e' },
    detailColumnTotal: { flex: 1.5, fontSize: 15, color: '#2c3e50', textAlign: 'center' },
    detailColumnAverage: { flex: 1.5, fontSize: 15, fontWeight: 'bold', color: '#008080', textAlign: 'right' },
    attToggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', alignItems: 'center' },
    attToggleButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginHorizontal: 5, backgroundColor: '#E0E0E0' },
    attToggleButtonActive: { backgroundColor: '#008080' },
    attToggleButtonText: { color: '#37474F', fontWeight: '600' },
    attToggleButtonTextActive: { color: '#FFFFFF' },
    attCalendarButton: { padding: 8, marginLeft: 10 },
    attSummaryContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
    attSummaryBox: { alignItems: 'center', flex: 1 },
    attSummaryValue: { fontSize: 24, fontWeight: 'bold' },
    attSummaryLabel: { fontSize: 14, color: '#566573', marginTop: 5 },
    attHistoryContainer: { paddingHorizontal: 15, paddingVertical: 10 },
    attHistoryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#37474F' },
    attHistoryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 8, marginVertical: 6, borderWidth: 1, borderColor: '#f0f2f5' },
    attHistoryDate: { fontSize: 16, fontWeight: '600', color: '#37474F' },
    attHistoryStatus: { fontSize: 14, fontWeight: 'bold' },
});

export default StaffDetailScreen;