import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, TextInput, Platform, UIManager, LayoutAnimation, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import TeacherReportView from './TeacherReportView';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

// --- Constants ---
const PRIMARY_COLOR = '#008080';
const BACKGROUND_COLOR = '#F2F5F8';
const CARD_BG = '#FFFFFF';
const TEXT_COLOR_DARK = '#263238';
const TEXT_COLOR_MEDIUM = '#546E7A';
const BORDER_COLOR = '#CFD8DC';
const GREEN = '#43A047';
const RED = '#E53935';
const WHITE = '#FFFFFF';

const API_BASE_URL = '/teacher-attendance';

const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const TeacherAttendanceMarkingScreen = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('marking');
  const [teachers, setTeachers] = useState([]); 
  const [allTeachersForReport, setAllTeachersForReport] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [markingState, setMarkingState] = useState('LOADING');

  const loadMarkingDataForDate = useCallback(async (dateToCheck) => {
    const dateString = dateToCheck.toISOString().slice(0, 10);
    try {
        const response = await apiClient.get(`${API_BASE_URL}/sheet?date=${dateString}`);
        const teachersData = response.data; 
        setTeachers(teachersData);
        setAllTeachersForReport(teachersData); 
        const isAlreadyMarked = teachersData.length > 0 && teachersData.some(t => t.isMarked);
        setMarkingState(isAlreadyMarked ? 'SUCCESS_SUMMARY' : 'MARKING'); 
    } catch (error) {
        Alert.alert("Error", error.response?.data?.message || "Failed to load teacher base data.");
        setMarkingState('MARKING'); 
    } finally {
        setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
      setIsLoading(true);
      loadMarkingDataForDate(attendanceDate);
  }, [attendanceDate, loadMarkingDataForDate]); 

  const handleStatusChange = (teacherId, status) => {
    setTeachers(prev => prev.map(t => (t.id === teacherId ? { ...t, status } : t)));
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setAttendanceDate(selectedDate);
  };

  const handleSubmitAttendance = async () => {
    if (!user || user.role !== 'admin') return Alert.alert("Error", "Only Admins can submit attendance.");
    const dateString = attendanceDate.toISOString().slice(0, 10);
    const attendanceData = teachers.map(t => ({ teacher_id: t.id, status: t.status }));

    if (attendanceData.length === 0) return Alert.alert("Error", "No teachers selected.");

    try {
      setIsLoading(true);
      await apiClient.post(`${API_BASE_URL}/mark`, { date: dateString, attendanceData });
      setMarkingState('SUCCESS_SUMMARY');
      loadMarkingDataForDate(attendanceDate);
    } catch (error) {
      Alert.alert("Submission Error", error.response?.data?.message || 'Failed to submit attendance.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (text) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchQuery(text);
  };

  const filteredReportList = useMemo(() => {
    if (!searchQuery) return allTeachersForReport;
    const lowerQuery = searchQuery.toLowerCase();
    return allTeachersForReport.filter(t => 
        t.full_name.toLowerCase().includes(lowerQuery) || 
        (t.subjects_taught && t.subjects_taught.some(sub => sub.toLowerCase().includes(lowerQuery)))
    );
  }, [allTeachersForReport, searchQuery]);

  // --- Render Functions ---
  const renderTeacherMarkingItem = ({ item }) => (
    <View style={styles.teacherRow}>
      <View style={styles.teacherInfo}>
        <Text style={styles.teacherName}>{item.full_name}</Text>
        <Text style={styles.teacherSubjects}>
            { (item.subjects_taught?.length ? item.subjects_taught.join(', ') : `ID: ${item.id}`) }
        </Text>
      </View>
      <View style={styles.statusButtons}>
        <TouchableOpacity style={[styles.statusButton, item.status === 'P' ? styles.presentActive : styles.btnInactive]} onPress={() => handleStatusChange(item.id, 'P')}>
          <Text style={[styles.statusBtnText, item.status === 'P' ? {color: '#fff'} : {color: GREEN}]}>P</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statusButton, item.status === 'A' ? styles.absentActive : styles.btnInactive]} onPress={() => handleStatusChange(item.id, 'A')}>
          <Text style={[styles.statusBtnText, item.status === 'A' ? {color: '#fff'} : {color: RED}]}>A</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTeacherReportSelectionItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" duration={400} delay={index * 50}>
      <TouchableOpacity style={styles.reportSelectionRow} onPress={() => setSelectedTeacherId(item.id.toString())}>
        <View style={styles.teacherInfo}>
            <Text style={styles.teacherName}>{item.full_name}</Text>
            <Text style={styles.teacherSubjects}>{ (item.subjects_taught?.length ? item.subjects_taught.join(', ') : `ID: ${item.id}`) }</Text>
        </View>
        <Icon name="chevron-right" size={24} color={TEXT_COLOR_MEDIUM} />
      </TouchableOpacity>
    </Animatable.View>
  );

  const renderSuccessSummary = () => (
      <Animatable.View animation="fadeIn" duration={500} style={styles.summaryContainer}>
          <View style={styles.successIconContainer}>
            <Icon name="check" size={50} color={WHITE} />
          </View>
          <Text style={styles.summaryTitle}>Attendance Marked!</Text>
          <Text style={styles.summaryMessage}>Attendance for {formatDate(attendanceDate)} has been saved successfully.</Text>
          <TouchableOpacity style={styles.editButton} onPress={() => setMarkingState('MARKING')}>
              <Text style={styles.editButtonText}>Edit Attendance</Text>
          </TouchableOpacity>
      </Animatable.View>
  );

  if (selectedTeacherId) {
    const teacherName = allTeachersForReport.find(t => t.id.toString() === selectedTeacherId)?.full_name || "Unknown Teacher";
    return <TeacherReportView teacherId={selectedTeacherId} headerTitle={`Report: ${teacherName}`} onBack={() => setSelectedTeacherId(null)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
        
        {/* --- HEADER CARD --- */}
        <View style={styles.headerCard}>
            <View style={styles.headerLeft}>
                <View style={styles.headerIconContainer}>
                    <MaterialIcons name="person-pin" size={24} color="#008080" />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Teacher Attendance</Text>
                    <Text style={styles.headerSubtitle}>Admin Control Panel</Text>
                </View>
            </View>
            {activeTab === 'marking' && (
                <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowDatePicker(true)}>
                    <MaterialIcons name="calendar-today" size={20} color="#008080" />
                </TouchableOpacity>
            )}
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'marking' && styles.tabButtonActive]} onPress={() => setActiveTab('marking')}>
                <Text style={[styles.tabButtonText, activeTab === 'marking' && styles.tabButtonTextActive]}>Mark Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'reporting' && styles.tabButtonActive]} onPress={() => setActiveTab('reporting')}>
                <Text style={[styles.tabButtonText, activeTab === 'reporting' && styles.tabButtonTextActive]}>View Reports</Text>
            </TouchableOpacity>
        </View>

        {showDatePicker && <DateTimePicker value={attendanceDate} mode="date" display="default" onChange={handleDateChange} />}

        {activeTab === 'marking' && (
            <View style={{flex: 1}}>
                {/* Date Subtitle */}
                <View style={styles.dateSubtitleContainer}>
                    <Text style={styles.dateSubtitleText}>Date: {formatDate(attendanceDate)}</Text>
                </View>

                {isLoading && <View style={styles.center}><ActivityIndicator size="large" color={PRIMARY_COLOR} /></View>}
                
                {!isLoading && markingState === 'SUCCESS_SUMMARY' && renderSuccessSummary()}
                
                {!isLoading && markingState === 'MARKING' && (
                    <>
                        <FlatList
                            data={teachers}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderTeacherMarkingItem}
                            contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 100 }}
                            ListEmptyComponent={<Text style={styles.emptyText}>No teacher records found.</Text>}
                        />
                        <View style={styles.footerContainer}>
                            <TouchableOpacity style={styles.submitFooterButton} onPress={handleSubmitAttendance} disabled={isLoading}>
                                <Text style={styles.submitFooterText}>SUBMIT ATTENDANCE</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        )}

        {activeTab === 'reporting' && (
            <View style={{flex: 1}}>
                <Animatable.View animation="fadeIn" duration={600} style={styles.searchBarContainer}>
                    <Icon name="magnify" size={22} color={TEXT_COLOR_MEDIUM} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchBar}
                        placeholder="Search teacher..."
                        value={searchQuery}
                        onChangeText={handleSearch}
                        placeholderTextColor={TEXT_COLOR_MEDIUM}
                    />
                </Animatable.View>

                {isLoading ? (
                    <View style={styles.center}><ActivityIndicator size="large" color={PRIMARY_COLOR} /></View>
                ) : (
                    <FlatList
                        data={filteredReportList}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderTeacherReportSelectionItem}
                        contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>No teachers found matching search criteria.</Text>}
                    />
                )}
            </View>
        )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // --- HEADER CARD STYLES ---
  headerCard: {
      backgroundColor: CARD_BG,
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
      backgroundColor: '#E0F2F1', 
      borderRadius: 30,
      width: 45,
      height: 45,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
  },
  headerTextContainer: { justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_COLOR_DARK },
  headerSubtitle: { fontSize: 13, color: TEXT_COLOR_MEDIUM },
  headerActionBtn: { padding: 8, backgroundColor: '#f0fdfa', borderRadius: 8, borderWidth: 1, borderColor: '#ccfbf1' },

  // Tabs
  tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 10, backgroundColor: CARD_BG, borderRadius: 8, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: BORDER_COLOR },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#F0FDF4', borderBottomWidth: 3, borderBottomColor: PRIMARY_COLOR },
  tabButtonText: { fontSize: 14, fontWeight: '600', color: TEXT_COLOR_MEDIUM },
  tabButtonTextActive: { color: PRIMARY_COLOR },

  // Date Subtitle
  dateSubtitleContainer: { alignItems: 'center', marginBottom: 10 },
  dateSubtitleText: { fontSize: 14, color: TEXT_COLOR_MEDIUM, fontWeight: '500' },

  // List Rows
  teacherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, marginVertical: 5, backgroundColor: CARD_BG, borderRadius: 10, elevation: 1 },
  teacherInfo: { flex: 1, marginRight: 10 },
  teacherName: { fontSize: 16, fontWeight: 'bold', color: TEXT_COLOR_DARK },
  teacherSubjects: { fontSize: 13, color: TEXT_COLOR_MEDIUM, marginTop: 2 },
  
  statusButtons: { flexDirection: 'row', gap: 10 },
  statusButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  presentActive: { backgroundColor: GREEN, borderColor: GREEN },
  absentActive: { backgroundColor: RED, borderColor: RED },
  btnInactive: { backgroundColor: WHITE, borderColor: BORDER_COLOR },
  statusBtnText: { fontWeight: 'bold', fontSize: 16 },

  emptyText: { textAlign: 'center', marginTop: 20, color: TEXT_COLOR_MEDIUM },

  // Search
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, marginHorizontal: 15, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: BORDER_COLOR, paddingHorizontal: 10 },
  searchBar: { flex: 1, height: 45, fontSize: 16, color: TEXT_COLOR_DARK },
  searchIcon: { marginRight: 8 },
  reportSelectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, marginVertical: 4, backgroundColor: CARD_BG, borderRadius: 10, elevation: 1 },

  // Summary View
  summaryContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: CARD_BG },
  successIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  summaryTitle: { fontSize: 24, fontWeight: 'bold', color: TEXT_COLOR_DARK, marginBottom: 10 },
  summaryMessage: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center', marginBottom: 30 },
  editButton: { backgroundColor: PRIMARY_COLOR, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 8 },
  editButtonText: { color: WHITE, fontSize: 16, fontWeight: 'bold' },

  // Footer
  footerContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  submitFooterButton: { backgroundColor: PRIMARY_COLOR, paddingVertical: 15, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  submitFooterText: { color: WHITE, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});

export default TeacherAttendanceMarkingScreen;