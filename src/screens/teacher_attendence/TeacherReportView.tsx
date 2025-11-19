import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Platform, LayoutAnimation, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

// --- Theme Constants ---
const PRIMARY_COLOR = '#008080';
const TEXT_COLOR_DARK = '#37474F';
const TEXT_COLOR_MEDIUM = '#566573';
const BORDER_COLOR = '#E0E0E0';
const GREEN = '#43A047';
const RED = '#E53935';
const BLUE = '#1E88E5';
const ORANGE = '#F57C00';
const WHITE = '#FFFFFF';

// --- Local Interfaces ---
interface AttendanceRecord {
  date: string; 
  status: 'P' | 'A' | 'L';
}

interface AttendanceReport {
  stats: {
    overallPercentage: string;
    daysPresent: number;
    daysAbsent: number;
    totalDays: number; // This is "Working Days" (Present + Absent)
  };
  detailedHistory: AttendanceRecord[];
}
// --- End Local Interfaces ---

// --- Reusable Sub-components ---
const SummaryCard = ({ label, value, color, delay, width = '23%' }) => ( 
    <Animatable.View animation="zoomIn" duration={500} delay={delay} style={[styles.summaryBox, { width: width }]}>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
    </Animatable.View>
);

const HistoryRecordCard = ({ item, index }) => {
    const isPresent = item.status === 'P';
    const statusText = item.status === 'P' ? 'Present' : (item.status === 'A' ? 'Absent' : 'Leave/Late');
    const statusColor = isPresent ? GREEN : RED;

    return (
        <Animatable.View animation="fadeInUp" duration={400} delay={index * 100} style={styles.historyRecordCard}>
            <View style={styles.historyRecordHeader}>
                <Text style={styles.historyDate}>{new Date(item.date).toDateString()}</Text>
                <Text style={[styles.historyStatus, { color: statusColor }]}>{statusText}</Text>
            </View>
        </Animatable.View>
    );
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// --- Main Component ---
interface TeacherReportViewProps {
    teacherId: string;
    headerTitle: string;
    onBack?: () => void; 
}

const TeacherReportView: React.FC<TeacherReportViewProps> = ({ teacherId, headerTitle, onBack }) => {
    
    const [report, setReport] = useState<AttendanceReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // viewMode: 'custom' is used for the Date Range view (formerly overall)
    const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'custom'>('custom');
    
    // Date States
    const [selectedDate, setSelectedDate] = useState(new Date()); // For Daily/Monthly
    const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30))); // Default 30 days back
    const [toDate, setToDate] = useState(new Date());
    
    // Picker Visibility
    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const API_BASE_URL = '/teacher-attendance';

    const fetchReport = useCallback(async () => {
        if (!teacherId) return;
        setIsLoading(true);
        
        const params: any = { period: viewMode };
        
        if (viewMode === 'daily') {
            params.targetDate = selectedDate.toISOString().slice(0, 10);
        } else if (viewMode === 'monthly') {
            params.targetMonth = selectedDate.toISOString().slice(0, 7);
        } else if (viewMode === 'custom') {
            params.startDate = fromDate.toISOString().slice(0, 10);
            params.endDate = toDate.toISOString().slice(0, 10);
        }

        try {
            const response = await apiClient.get<AttendanceReport>(`${API_BASE_URL}/report/${teacherId}`, { params });
            setReport(response.data);
        } catch (error: any) {
            console.error("Attendance Report Error:", error);
            Alert.alert("Error", error.response?.data?.message || "Failed to load attendance report.");
            setReport(null);
        } finally {
            setIsLoading(false);
        }
    }, [teacherId, viewMode, selectedDate, fromDate, toDate]);

    // Initial load
    useEffect(() => {
        fetchReport();
    }, [teacherId]); 

    const onMainDateChange = (event: any, date?: Date) => {
        setShowMainPicker(Platform.OS === 'ios'); 
        if (date) setSelectedDate(date);
    };

    const onFromDateChange = (event: any, date?: Date) => {
        setShowFromPicker(Platform.OS === 'ios');
        if (date) setFromDate(date);
    };

    const onToDateChange = (event: any, date?: Date) => {
        setShowToPicker(Platform.OS === 'ios');
        if (date) setToDate(date);
    };
    
    const summary = report?.stats || { overallPercentage: '0.0', daysPresent: 0, daysAbsent: 0, totalDays: 0 };

    return (
        <SafeAreaView style={styles.container}>
            <Animatable.View animation="fadeInDown" duration={500}>
                <View style={styles.header}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Icon name="arrow-left" size={24} color={TEXT_COLOR_DARK} />
                        </TouchableOpacity>
                    )}
                    <View style={{flex: 1, alignItems: 'center', paddingRight: onBack ? 30 : 0 }}>
                        <Text style={styles.headerTitle}>{headerTitle}</Text>
                        {viewMode === 'daily' && <Text style={styles.headerSubtitleSmall}>Date: {selectedDate.toDateString()}</Text>}
                        {viewMode === 'monthly' && <Text style={styles.headerSubtitleSmall}>Month: {selectedDate.toISOString().slice(0, 7)}</Text>}
                        {viewMode === 'custom' && <Text style={styles.headerSubtitleSmall}>Custom Range</Text>}
                    </View>
                </View>
            </Animatable.View>

            {/* TABS: Daily | Monthly | Custom (Implicit via Range inputs) */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'daily' && styles.toggleButtonActive]} onPress={() => setViewMode('daily')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'daily' && styles.toggleButtonTextActive]}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'monthly' && styles.toggleButtonActive]} onPress={() => setViewMode('monthly')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'monthly' && styles.toggleButtonTextActive]}>Monthly</Text>
                </TouchableOpacity>
                {/* Formerly Overall, now triggers Range View */}
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'custom' && styles.toggleButtonActive]} onPress={() => setViewMode('custom')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'custom' && styles.toggleButtonTextActive]}>Range</Text>
                </TouchableOpacity>
                
                {(viewMode === 'daily' || viewMode === 'monthly') && (
                    <TouchableOpacity style={styles.calendarButton} onPress={() => setShowMainPicker(true)}>
                        <Icon name="calendar" size={22} color={PRIMARY_COLOR} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Date Range Inputs - Visible only when Custom/Range is active */}
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={styles.rangeContainer}>
                     {/* From Date */}
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowFromPicker(true)}>
                        <Icon name="calendar-today" size={18} color={TEXT_COLOR_MEDIUM} style={{marginRight:5}}/>
                        <Text style={styles.dateInputText}>{fromDate.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                    
                    {/* To Date */}
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowToPicker(true)}>
                        <Icon name="calendar-today" size={18} color={TEXT_COLOR_MEDIUM} style={{marginRight:5}}/>
                        <Text style={styles.dateInputText}>{toDate.toLocaleDateString()}</Text>
                    </TouchableOpacity>

                    {/* GO Button */}
                    <TouchableOpacity style={styles.goButton} onPress={fetchReport}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {/* Date Pickers */}
            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={onMainDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={onFromDateChange} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={onToDateChange} />}

            {isLoading ? <ActivityIndicator style={styles.loaderContainer} size="large" color={PRIMARY_COLOR} /> : (
                <>
                    {/* Stats Summary */}
                    <View style={styles.summaryContainer}>
                        <SummaryCard label="Overall %" value={`${summary.overallPercentage}%`} color={BLUE} delay={100} />
                        {/* Added Working Days Here */}
                        <SummaryCard label="Working Days" value={summary.totalDays || 0} color={ORANGE} delay={150} />
                        <SummaryCard label="Days Present" value={summary.daysPresent || 0} color={GREEN} delay={200} />
                        <SummaryCard label="Days Absent" value={summary.daysAbsent || 0} color={RED} delay={300} />
                    </View>

                    <FlatList
                        data={report?.detailedHistory || []}
                        keyExtractor={(item) => item.date}
                        renderItem={({ item, index }) => <HistoryRecordCard item={item} index={index} />}
                        ListHeaderComponent={<Text style={styles.historyTitle}>Detailed History</Text>}
                        ListEmptyComponent={<Text style={styles.noDataText}>No records found for this period.</Text>}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F6F8' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    noDataText: { textAlign: 'center', marginTop: 20, color: TEXT_COLOR_MEDIUM, fontSize: 16 },
    
    header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: TEXT_COLOR_DARK, textAlign: 'center' },
    headerSubtitleSmall: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginTop: 2, textAlign: 'center' },
    backButton: { position: 'absolute', left: 15, zIndex: 1, padding: 5 },
    
    // Tab Styling
    toggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 5, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, alignItems: 'center' },
    toggleButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginHorizontal: 5, backgroundColor: '#E0E0E0' },
    toggleButtonActive: { backgroundColor: PRIMARY_COLOR },
    toggleButtonText: { color: TEXT_COLOR_DARK, fontWeight: '600' },
    toggleButtonTextActive: { color: WHITE },
    calendarButton: { padding: 8, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },

    // Range Selector Styling
    rangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
    dateInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E0E0', padding: 10, borderRadius: 6, marginRight: 10, justifyContent: 'center' },
    dateInputText: { color: TEXT_COLOR_DARK, fontSize: 14, fontWeight: '500' },
    goButton: { backgroundColor: GREEN, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6 },
    goButtonText: { color: WHITE, fontWeight: 'bold' },

    // Stats Styling
    summaryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
    summaryBox: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2 },
    summaryValue: { fontSize: 22, fontWeight: 'bold' },
    summaryLabel: { fontSize: 12, color: TEXT_COLOR_MEDIUM, marginTop: 5, fontWeight: '500', textAlign: 'center' },
    
    historyTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, marginTop: 15, marginBottom: 10, color: TEXT_COLOR_DARK },
    historyRecordCard: { backgroundColor: WHITE, marginHorizontal: 15, marginVertical: 8, borderRadius: 8, elevation: 2, shadowColor: '#999', shadowOpacity: 0.1, shadowRadius: 5 },
    historyRecordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    historyDate: { fontSize: 16, fontWeight: '600', color: TEXT_COLOR_DARK },
    historyStatus: { fontSize: 14, fontWeight: 'bold' },
});

export default TeacherReportView;