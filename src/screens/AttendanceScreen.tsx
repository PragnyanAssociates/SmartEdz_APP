import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  UIManager,
  LayoutAnimation,
  Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; // Added for consistent icons
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Animatable from 'react-native-animatable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Constants ---
const PRIMARY_COLOR = '#008080'; // Teal
const BACKGROUND_COLOR = '#F2F5F8';
const CARD_BG = '#FFFFFF';
const TEXT_COLOR_DARK = '#263238';
const TEXT_COLOR_MEDIUM = '#546E7A';
const BORDER_COLOR = '#CFD8DC';
const GREEN = '#43A047';
const RED = '#E53935';
const BLUE = '#1E88E5';
const YELLOW = '#FDD835';
const WHITE = '#FFFFFF';
const ORANGE = '#FB8C00';

const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

// --- Helper: Date Formatter ---
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const SummaryCard = ({ label, value, color, delay }) => (
    <Animatable.View animation="zoomIn" duration={500} delay={delay} style={styles.summaryBox}>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
    </Animatable.View>
);

const HistoryDayCard = ({ item, index }) => {
    const isPresent = item.status === 'Present';
    const dayStatus = isPresent ? 'Present' : 'Absent';
    const statusColor = isPresent ? GREEN : RED;

    return (
        <Animatable.View animation="fadeInUp" duration={400} delay={index * 100} style={styles.historyDayCard}>
            <View style={styles.historyDayHeader}>
                <Text style={styles.historyDate}>{formatDate(item.attendance_date)}</Text>
                <Text style={[styles.historyStatus, { color: statusColor }]}>{dayStatus}</Text>
            </View>
        </Animatable.View>
    );
};

// --- Main Router ---
const AttendanceScreen = ({ route }) => {
  const { user } = useAuth();
  if (!user) return <View style={styles.loaderContainer}><Text style={styles.noDataText}>User not found.</Text></View>;

  switch (user.role) {
    case 'teacher':
      return route?.params ? <TeacherLiveAttendanceView route={route} teacher={user} /> : <TeacherSummaryView teacher={user} />;
    case 'student':
      return <StudentAttendanceView student={user} />;
    case 'admin':
      return <AdminAttendanceView />;
    default:
      return <View style={styles.loaderContainer}><Text style={styles.noDataText}>No attendance view available.</Text></View>;
  }
};

// --- MODIFIED: Generic Student History Component ---
const GenericStudentHistoryView = ({ studentId, headerTitle, onBack }) => {
    // UPDATED: Default set to 'daily'
    const [viewMode, setViewMode] = useState('daily');
    const [data, setData] = useState({ summary: {}, history: [] });
    const [isLoading, setIsLoading] = useState(true);
    
    // Date States
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
    const [toDate, setToDate] = useState(new Date());

    // Pickers
    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const fetchHistory = async () => {
        if (!studentId) return;
        setIsLoading(true);
        try {
            let url = onBack
                ? `/attendance/student-history-admin/${studentId}?viewMode=${viewMode}`
                : `/attendance/my-history/${studentId}?viewMode=${viewMode}`;

            if (viewMode === 'daily') url += `&date=${selectedDate.toISOString().split('T')[0]}`;
            else if (viewMode === 'monthly') url += `&date=${selectedDate.toISOString().slice(0, 7)}`;
            else if (viewMode === 'yearly') url += `&targetYear=${selectedDate.getFullYear()}`;
            else if (viewMode === 'custom') url += `&startDate=${fromDate.toISOString().split('T')[0]}&endDate=${toDate.toISOString().split('T')[0]}`;

            const response = await apiClient.get(url);
            setData(response.data);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Could not load attendance history.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode !== 'custom') fetchHistory();
    }, [studentId, viewMode, selectedDate]);

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

    const percentage = useMemo(() => {
        if (!data.summary?.total_days || data.summary.total_days === 0) return '0.0';
        return ((data.summary.present_days / data.summary.total_days) * 100).toFixed(1);
    }, [data.summary]);

    // Subtitle Logic
    let subTitle = '';
    if (viewMode === 'daily') subTitle = `Date: ${formatDate(selectedDate)}`;
    else if (viewMode === 'monthly') subTitle = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    else if (viewMode === 'yearly') subTitle = `Year: ${selectedDate.getFullYear()}`;
    else subTitle = 'Custom Range';

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}>
                            <MaterialIcons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>
                    )}
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="history" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>{headerTitle}</Text>
                        <Text style={styles.headerSubtitle}>{subTitle}</Text>
                    </View>
                </View>
                
                {/* Date Picker Button in Header */}
                {viewMode !== 'custom' && (
                    <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowMainPicker(true)}>
                        <MaterialIcons name="calendar-today" size={20} color="#008080" />
                    </TouchableOpacity>
                )}
            </View>

            {/* TABS */}
            <View style={styles.toggleContainer}>
                {['daily', 'monthly', 'yearly', 'custom'].map(mode => (
                    <TouchableOpacity 
                        key={mode}
                        style={[styles.toggleButton, viewMode === mode && styles.toggleButtonActive]} 
                        onPress={() => setViewMode(mode)}
                    >
                        <Text style={[styles.toggleButtonText, viewMode === mode && styles.toggleButtonTextActive]}>
                            {capitalize(mode)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Range Inputs */}
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={styles.rangeContainer}>
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowFromPicker(true)}>
                        <Icon name="calendar-today" size={18} color={TEXT_COLOR_MEDIUM} style={{marginRight:5}}/>
                        <Text style={styles.dateInputText}>{formatDate(fromDate)}</Text>
                    </TouchableOpacity>
                    <Icon name="arrow-right" size={20} color={TEXT_COLOR_MEDIUM} />
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowToPicker(true)}>
                        <Icon name="calendar-today" size={18} color={TEXT_COLOR_MEDIUM} style={{marginRight:5}}/>
                        <Text style={styles.dateInputText}>{formatDate(toDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.goButton} onPress={fetchHistory}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {/* Pickers */}
            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={onMainDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={onFromDateChange} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={onToDateChange} />}

            {isLoading ? <ActivityIndicator style={styles.loaderContainer} size="large" color={PRIMARY_COLOR} /> : (
                <>
                    <View style={styles.summaryContainer}>
                        <SummaryCard label="Overall" value={`${percentage}%`} color={BLUE} delay={100} />
                        <SummaryCard label="Present" value={data.summary.present_days || 0} color={GREEN} delay={200} />
                        <SummaryCard label="Absent" value={data.summary.absent_days || 0} color={RED} delay={300} />
                    </View>
                    <FlatList
                        data={data.history}
                        keyExtractor={(item) => item.attendance_date}
                        renderItem={({ item, index }) => <HistoryDayCard item={item} index={index} />}
                        ListEmptyComponent={<Text style={styles.noDataText}>No records found.</Text>}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </>
            )}
        </SafeAreaView>
    );
};

const StudentAttendanceView = ({ student }) => <GenericStudentHistoryView studentId={student.id} headerTitle="My Attendance" />;
const AdminStudentDetailView = ({ student, onBack }) => <GenericStudentHistoryView studentId={student.student_id} headerTitle={student.full_name} onBack={onBack} />;

// --- Generic Summary View (Teacher & Admin) ---
const GenericSummaryView = ({
    picker1, picker2, listData,
    summaryData, isLoading, viewMode, setViewMode, 
    selectedDate, onDateChange, 
    fromDate, setFromDate, 
    toDate, setToDate,     
    onRangeFetch,          
    onSelectStudent
}) => {
    const summary = summaryData?.overallSummary ?? {};
    
    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredListData = useMemo(() => {
        if (!searchQuery) return listData;
        return listData.filter(student => student.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [listData, searchQuery]);

    const handleMainDateChange = (event, date) => {
        setShowMainPicker(Platform.OS === 'ios');
        if (date && onDateChange) onDateChange(date);
    };

    const handleFromDateChange = (event, date) => {
        setShowFromPicker(Platform.OS === 'ios');
        if (date && setFromDate) setFromDate(date);
    };

    const handleToDateChange = (event, date) => {
        setShowToPicker(Platform.OS === 'ios');
        if (date && setToDate) setToDate(date);
    };

    // Subtitle
    let subTitle = '';
    if (viewMode === 'daily') subTitle = `Date: ${formatDate(selectedDate)}`;
    else if (viewMode === 'monthly') subTitle = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    else if (viewMode === 'yearly') subTitle = `Year: ${selectedDate.getFullYear()}`;
    else subTitle = 'Custom Range';

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="assessment" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Attendance Report</Text>
                        <Text style={styles.headerSubtitle}>{subTitle}</Text>
                    </View>
                </View>
                {viewMode !== 'custom' && (
                    <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowMainPicker(true)}>
                        <MaterialIcons name="calendar-today" size={20} color="#008080" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Pickers & Search */}
            <View style={styles.pickerContainer}>
                <View style={styles.pickerWrapper}>{picker1}</View>
                {picker2 && <View style={styles.pickerWrapper}>{picker2}</View>} 
            </View>

            <View style={styles.toggleContainer}>
                {['daily', 'monthly', 'yearly', 'custom'].map(mode => (
                    <TouchableOpacity 
                        key={mode}
                        style={[styles.toggleButton, viewMode === mode && styles.toggleButtonActive]} 
                        onPress={() => setViewMode(mode)}
                    >
                        <Text style={[styles.toggleButtonText, viewMode === mode && styles.toggleButtonTextActive]}>
                            {capitalize(mode)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Range Inputs */}
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={styles.rangeContainer}>
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowFromPicker(true)}>
                        <Text style={styles.dateInputText}>{formatDate(fromDate)}</Text>
                    </TouchableOpacity>
                    <Icon name="arrow-right" size={20} color={TEXT_COLOR_MEDIUM} />
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowToPicker(true)}>
                        <Text style={styles.dateInputText}>{formatDate(toDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.goButton} onPress={onRangeFetch}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={handleMainDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={handleFromDateChange} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={handleToDateChange} />}

            {isLoading ? <ActivityIndicator size="large" color={PRIMARY_COLOR} style={styles.loaderContainer} /> : (
                <FlatList
                    data={filteredListData}
                    keyExtractor={(item) => item.student_id.toString()}
                    ListHeaderComponent={
                        <>
                            <View style={styles.summaryContainer}>
                                <SummaryCard label="Attendance %" value={`${Number(summary.overall_percentage ?? 0).toFixed(1)}%`} color={BLUE} delay={100} />
                                <SummaryCard label={viewMode === 'daily' ? 'Present' : 'Avg Daily'} value={viewMode === 'daily' ? (summary.students_present ?? 0) : `${Number(summary.avg_daily_attendance ?? 0).toFixed(1)}%`} color={GREEN} delay={200} />
                                <SummaryCard label={viewMode === 'daily' ? 'Absent' : '< 75%'} value={viewMode === 'daily' ? (summary.students_absent ?? 0) : (summary.students_below_threshold ?? 0)} color={RED} delay={300} />
                            </View>
                            <View style={styles.searchBarContainer}>
                                <Icon name="magnify" size={20} color={TEXT_COLOR_MEDIUM} style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchBar}
                                    placeholder="Search student..."
                                    value={searchQuery}
                                    onChangeText={(text) => {
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                        setSearchQuery(text);
                                    }}
                                    placeholderTextColor="#999"
                                />
                            </View>
                        </>
                    }
                    renderItem={({ item, index }) => {
                        const studentPercentage = item.total_days > 0 ? (item.present_days / item.total_days) * 100 : 0;
                        const percentageColor = studentPercentage >= 75 ? GREEN : studentPercentage >= 50 ? YELLOW : RED;
                        return (
                            <Animatable.View animation="fadeInUp" duration={400} delay={index * 50}>
                                <TouchableOpacity onPress={() => onSelectStudent && onSelectStudent(item)}>
                                    <View style={styles.summaryStudentRow}>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.studentName}>{item.full_name}</Text>
                                            <Text style={styles.studentDetailText}>
                                                Roll: {item.roll_no || '-'} | {item.present_days}/{item.total_days} Days
                                            </Text>
                                        </View>
                                        <View style={[styles.percentageBadge, { borderColor: percentageColor }]}>
                                            <Text style={[styles.percentageText, { color: percentageColor }]}>{studentPercentage.toFixed(0)}%</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </Animatable.View>
                        );
                    }}
                    ListEmptyComponent={
                        <Text style={styles.noDataText}>No data found.</Text>
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </SafeAreaView>
    );
};

// --- Teacher View Wrapper ---
const TeacherSummaryView = ({ teacher }) => {
    const [assignments, setAssignments] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [summaryData, setSummaryData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    // UPDATED: Default set to 'daily'
    const [viewMode, setViewMode] = useState('daily');
    const [selectedDate, setSelectedDate] = useState(new Date());
    
    const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
    const [toDate, setToDate] = useState(new Date());

    useEffect(() => {
        const fetchAssignments = async () => {
            if (!teacher?.id) { setIsLoading(false); return; }
            try {
                const response = await apiClient.get(`/teacher-assignments/${teacher.id}`);
                setAssignments(response.data);
                if (response.data.length > 0) {
                    setSelectedClass(response.data[0].class_group);
                    setSelectedSubject(response.data[0].subject_name);
                } else {
                    setIsLoading(false);
                }
            } catch (error) {
                Alert.alert('Error', 'Could not fetch assignments.');
                setIsLoading(false);
            }
        };
        fetchAssignments();
    }, [teacher.id]);

    const fetchSummary = async () => {
        if (!teacher?.id || !selectedClass || !selectedSubject) {
            setSummaryData(null);
            return;
        }
        setIsLoading(true);
        try {
            let url = `/attendance/teacher-summary?teacherId=${teacher.id}&classGroup=${selectedClass}&subjectName=${selectedSubject}&viewMode=${viewMode}`;
            if (viewMode === 'daily') url += `&date=${selectedDate.toISOString().split('T')[0]}`;
            else if (viewMode === 'monthly') url += `&date=${selectedDate.toISOString().slice(0, 7)}`;
            else if (viewMode === 'yearly') url += `&targetYear=${selectedDate.getFullYear()}`;
            else if (viewMode === 'custom') url += `&startDate=${fromDate.toISOString().split('T')[0]}&endDate=${toDate.toISOString().split('T')[0]}`;
            
            const response = await apiClient.get(url);
            setSummaryData(response.data);
        } catch (error) {
            Alert.alert('Error', 'Could not retrieve data.');
            setSummaryData(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode !== 'custom') fetchSummary();
    }, [selectedClass, selectedSubject, viewMode, selectedDate]);

    const uniqueClasses = useMemo(() => [...new Set(assignments.map(a => a.class_group))], [assignments]);
    const subjectsForSelectedClass = useMemo(() => assignments.filter(a => a.class_group === selectedClass).map(a => a.subject_name), [assignments, selectedClass]);

    const handleClassChange = (newClass) => {
        setSelectedClass(newClass);
        const newSubjects = assignments.filter(a => a.class_group === newClass).map(a => a.subject_name);
        setSelectedSubject(newSubjects[0] || '');
    };

    const picker1 = (
        <Picker selectedValue={selectedClass} onValueChange={handleClassChange} enabled={uniqueClasses.length > 0} style={styles.picker}>
            {uniqueClasses.length > 0 ? uniqueClasses.map(c => <Picker.Item key={c} label={c} value={c} />) : <Picker.Item label="No classes..." value="" enabled={false} />}
        </Picker>
    );

    const picker2 = (
        <Picker selectedValue={selectedSubject} onValueChange={setSelectedSubject} enabled={subjectsForSelectedClass.length > 0} style={styles.picker}>
             {subjectsForSelectedClass.length > 0 ? subjectsForSelectedClass.map(s => <Picker.Item key={s} label={s} value={s} />) : <Picker.Item label="No subjects..." value="" enabled={false} />}
        </Picker>
    );

    return (
        <GenericSummaryView
            picker1={picker1}
            picker2={picker2}
            listData={summaryData?.studentDetails || []}
            summaryData={summaryData}
            isLoading={isLoading}
            viewMode={viewMode}
            setViewMode={setViewMode}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            fromDate={fromDate} setFromDate={setFromDate}
            toDate={toDate} setToDate={setToDate}
            onRangeFetch={fetchSummary}
        />
    );
};

// --- Admin View Wrapper ---
const AdminAttendanceView = () => {
  const [selectedClass, setSelectedClass] = useState(CLASS_GROUPS[0]);
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  // UPDATED: Default set to 'daily'
  const [viewMode, setViewMode] = useState('daily');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [toDate, setToDate] = useState(new Date());

  const fetchSummary = async () => {
      if (!selectedClass) return;
      setIsLoading(true);
      try {
        let url = `/attendance/admin-summary?classGroup=${selectedClass}&viewMode=${viewMode}`;
        if (viewMode === 'daily') url += `&date=${selectedDate.toISOString().split('T')[0]}`;
        else if (viewMode === 'monthly') url += `&date=${selectedDate.toISOString().slice(0, 7)}`;
        else if (viewMode === 'yearly') url += `&targetYear=${selectedDate.getFullYear()}`;
        else if (viewMode === 'custom') url += `&startDate=${fromDate.toISOString().split('T')[0]}&endDate=${toDate.toISOString().split('T')[0]}`;

        const response = await apiClient.get(url);
        setSummaryData(response.data);
      } catch (error) {
        Alert.alert('Error', 'Could not fetch summary.');
        setSummaryData(null);
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    if (viewMode !== 'custom') fetchSummary();
  }, [selectedClass, viewMode, selectedDate]);

  if (selectedStudent) {
    return <AdminStudentDetailView student={selectedStudent} onBack={() => setSelectedStudent(null)} />;
  }

  const picker1 = (
    <Picker selectedValue={selectedClass} onValueChange={setSelectedClass} style={styles.picker}>
        {CLASS_GROUPS.map(c => <Picker.Item key={c} label={c} value={c} />)}
    </Picker>
  );

  return (
    <GenericSummaryView
        picker1={picker1}
        listData={summaryData?.studentDetails || []}
        summaryData={summaryData}
        isLoading={isLoading}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onSelectStudent={setSelectedStudent}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        fromDate={fromDate} setFromDate={setFromDate}
        toDate={toDate} setToDate={setToDate}
        onRangeFetch={fetchSummary}
    />
  );
};

// --- Teacher Live Attendance View (For Redirection) ---
const TeacherLiveAttendanceView = ({ route, teacher }) => {
    const navigation = useNavigation();
    const { class_group, subject_name, date, period_number } = route?.params || {};
    
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attendanceAlreadyMarked, setAttendanceAlreadyMarked] = useState(false);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            try {
                const statusRes = await apiClient.get('/attendance/status', {
                    params: { class_group, date, period_number, subject_name }
                });
                if (statusRes.data.isMarked) setAttendanceAlreadyMarked(true);

                const sheetRes = await apiClient.get('/attendance/sheet', {
                    params: { class_group, date, period_number }
                });
                const formattedData = sheetRes.data.map(student => ({
                    ...student,
                    status: student.status || 'Present' 
                }));
                setStudents(formattedData);
            } catch (error) {
                console.error("Init Error:", error);
                Alert.alert('Error', 'Failed to load attendance data.');
            } finally {
                setIsLoading(false);
            }
        };
        if (class_group) init();
    }, [class_group, date, period_number, subject_name]);

    const setStatus = (id, newStatus) => {
        setStudents(currentStudents => 
            currentStudents.map(student => 
                student.id === id ? { ...student, status: newStatus } : student
            )
        );
    };

    const handleSubmit = async () => {
        if (students.length === 0) return;
        setIsSubmitting(true);
        try {
            const payload = {
                class_group,
                subject_name,
                period_number,
                date,
                teacher_id: teacher.id,
                attendanceData: students.map(s => ({ student_id: s.id, status: s.status }))
            };
            await apiClient.post('/attendance', payload);
            setAttendanceAlreadyMarked(true);
        } catch (error) {
            Alert.alert('Error', 'Failed to save attendance.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <View style={styles.loaderContainer}><ActivityIndicator size="large" color={PRIMARY_COLOR} /></View>;

    if (attendanceAlreadyMarked) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Animatable.View animation="zoomIn" duration={600} style={{ alignItems: 'center' }}>
                    <View style={styles.successCircle}>
                        <Icon name="check" size={60} color={WHITE} />
                    </View>
                    <Text style={styles.successTitle}>Done!</Text>
                    <Text style={styles.successSubtitle}>Attendance for {formatDate(date)} saved.</Text>
                    <TouchableOpacity style={styles.editButton} onPress={() => setAttendanceAlreadyMarked(false)}>
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                </Animatable.View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="edit-note" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>{class_group}</Text>
                        <Text style={styles.headerSubtitle}>Live Attendance</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={students}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 100 }}
                renderItem={({ item }) => {
                    const isPresent = item.status === 'Present';
                    return (
                        <View style={styles.summaryStudentRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.studentName}>{item.full_name}</Text>
                                <Text style={styles.studentDetailText}>{item.subject || 'Subject'}</Text>
                            </View>
                            <View style={{flexDirection: 'row', gap: 10}}>
                                <TouchableOpacity style={[styles.statusBtn, isPresent ? styles.btnPresent : styles.btnInactive]} onPress={() => setStatus(item.id, 'Present')}>
                                    <Text style={[styles.statusText, isPresent ? {color: '#fff'} : {color: GREEN}]}>P</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.statusBtn, !isPresent ? styles.btnAbsent : styles.btnInactive]} onPress={() => setStatus(item.id, 'Absent')}>
                                    <Text style={[styles.statusText, !isPresent ? {color: '#fff'} : {color: RED}]}>A</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }}
            />

            <View style={styles.footerContainer}>
                <TouchableOpacity style={styles.submitFooterButton} onPress={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <ActivityIndicator color={WHITE} /> : <Text style={styles.submitFooterText}>SUBMIT</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    ); 
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BACKGROUND_COLOR },
  noDataText: { textAlign: 'center', marginTop: 20, color: TEXT_COLOR_MEDIUM, fontSize: 16 },
  
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
      backgroundColor: '#E0F2F1', // Teal bg
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
  headerSubtitleSmall: { fontSize: 12, color: TEXT_COLOR_MEDIUM, fontWeight: '500' },
  headerActionBtn: {
      padding: 8,
      backgroundColor: '#f0fdfa',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#ccfbf1'
  },

  // Pickers & Filters
  pickerContainer: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 5, gap: 10 },
  pickerWrapper: { flex: 1, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, backgroundColor: '#FFF', height: 45, justifyContent: 'center' },
  picker: { width: '100%', color: TEXT_COLOR_DARK },
  
  // Summary Cards
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, marginHorizontal: 15, marginBottom: 10, backgroundColor: CARD_BG, borderRadius: 12, elevation: 2 },
  summaryBox: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 18, fontWeight: 'bold' },
  summaryLabel: { fontSize: 11, color: TEXT_COLOR_MEDIUM, marginTop: 4, fontWeight: '500', textAlign: 'center' },
  
  // Search Bar
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, marginHorizontal: 15, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: BORDER_COLOR, paddingHorizontal: 10, height: 45 },
  searchBar: { flex: 1, fontSize: 14, color: TEXT_COLOR_DARK },
  searchIcon: { marginRight: 8 },

  // List Rows
  summaryStudentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, padding: 15, marginHorizontal: 15, marginVertical: 5, borderRadius: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  studentName: { fontSize: 15, color: TEXT_COLOR_DARK, fontWeight: '600' },
  studentDetailText: { fontSize: 12, color: TEXT_COLOR_MEDIUM, marginTop: 2 },
  percentageBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1 },
  percentageText: { fontSize: 12, fontWeight: 'bold' },
  
  // Toggles
  toggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 5, marginBottom: 10 },
  toggleButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginHorizontal: 4, backgroundColor: '#E0E0E0' },
  toggleButtonActive: { backgroundColor: PRIMARY_COLOR },
  toggleButtonText: { color: TEXT_COLOR_DARK, fontWeight: '600', fontSize: 12 },
  toggleButtonTextActive: { color: WHITE },
  calendarButton: { padding: 5, marginLeft: 5 },
  
  // Range
  rangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, marginBottom: 10 },
  dateInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 8, borderRadius: 6, marginHorizontal: 5, borderWidth: 1, borderColor: BORDER_COLOR, justifyContent: 'center' },
  dateInputText: { color: TEXT_COLOR_DARK, fontSize: 12, fontWeight: '500' },
  goButton: { backgroundColor: GREEN, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 6, marginLeft: 5 },
  goButtonText: { color: WHITE, fontWeight: 'bold', fontSize: 12 },

  // History List
  historyDayCard: { backgroundColor: CARD_BG, marginHorizontal: 15, marginVertical: 6, borderRadius: 8, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  historyDate: { fontSize: 14, fontWeight: '600', color: TEXT_COLOR_DARK },
  historyStatus: { fontSize: 14, fontWeight: 'bold' },

  // Success View
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_COLOR_DARK, marginBottom: 8 },
  successSubtitle: { fontSize: 14, color: TEXT_COLOR_MEDIUM, textAlign: 'center', marginBottom: 25 },
  editButton: { backgroundColor: PRIMARY_COLOR, paddingVertical: 10, paddingHorizontal: 30, borderRadius: 8 },
  editButtonText: { color: WHITE, fontSize: 14, fontWeight: 'bold' },

  // Live Marking Buttons
  statusBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  btnPresent: { backgroundColor: GREEN, borderColor: GREEN },
  btnAbsent: { backgroundColor: RED, borderColor: RED },
  btnInactive: { backgroundColor: '#fff', borderColor: '#E0E0E0' },
  statusText: { fontSize: 14, fontWeight: 'bold' },

  // Footer
  footerContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  submitFooterButton: { backgroundColor: PRIMARY_COLOR, paddingVertical: 15, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  submitFooterText: { color: WHITE, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});

export default AttendanceScreen;