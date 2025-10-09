import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  Dimensions, TouchableOpacity, Modal, ActivityIndicator, Alert, Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// --- Type Definitions ---
type RootStackParamList = {
  Attendance: {
    class_group: string;
    subject_name: string;
    period_number: number;
    date: string;
  };
};

interface TimetableSlotFromAPI {
  id?: number;
  class_group: string;
  day_of_week: Day;
  period_number: number;
  subject_name?: string;
  teacher_id?: number;
  teacher_name?: string;
}

interface Teacher {
  id: number;
  full_name: string;
  subjects_taught: string[];
}

interface PeriodDefinition {
  period: number;
  time: string;
  isBreak?: boolean;
}

interface RenderablePeriod {
  subject?: string;
  teacher?: string;
  teacher_id?: number;
  isBreak?: boolean;
}

type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

// --- Constants ---
const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const PERIOD_DEFINITIONS: PeriodDefinition[] = [
  { period: 1, time: '09:00-09:45' },
  { period: 2, time: '09:45-10:30' },
  { period: 3, time: '10:30-10:45', isBreak: true },
  { period: 4, time: '10:45-11:30' },
  { period: 5, time: '11:30-12:15' },
  { period: 6, time: '12:15-01:00', isBreak: true },
  { period: 7, time: '01:00-01:45' },
  { period: 8, time: '01:45-02:30' },
];

const { width } = Dimensions.get('window');
const TABLE_HORIZONTAL_MARGIN = 10;
const tableContentWidth = width - TABLE_HORIZONTAL_MARGIN * 2;
const timeColumnWidth = Math.floor(tableContentWidth * 0.20);
const dayColumnWidth = Math.floor((tableContentWidth * 0.80) / 6);

const tableHeaders = [
  { name: 'TIME', color: '#F8F9FA', textColor: '#343A40', width: timeColumnWidth },
  { name: 'MON', color: '#FFFDE7', textColor: '#5D4037', width: dayColumnWidth },
  { name: 'TUE', color: '#FCE4EC', textColor: '#880E4F', width: dayColumnWidth },
  { name: 'WED', color: '#FFEBEE', textColor: '#C62828', width: dayColumnWidth },
  { name: 'THU', color: '#EDE7F6', textColor: '#4527A0', width: dayColumnWidth },
  { name: 'FRI', color: '#E8EAF6', textColor: '#1A237E', width: dayColumnWidth },
  { name: 'SAT', color: '#E0F7FA', textColor: '#006064', width: dayColumnWidth },
];

// --- Main Component ---
const TimetableScreen = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const [isTimetableLoading, setIsTimetableLoading] = useState(true);
  const [apiTimetableData, setApiTimetableData] = useState<TimetableSlotFromAPI[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: Day; period: number } | null>(null);
  const [selectedClass, setSelectedClass] = useState('');

  const classPickerData = useMemo(
    () => CLASS_GROUPS.map(cg => ({ key: cg, label: cg })),
    []
  );

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setSelectedClass(CLASS_GROUPS[0]);
      } else if (user.class_group) {
        setSelectedClass(user.class_group);
      }
    }
  }, [user]);

  useEffect(() => {
    if (isAuthLoading || !user) return;
    if (user.role === 'admin') fetchTeachers();
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !selectedClass || !isFocused) return;
    fetchTimetable(selectedClass);
  }, [selectedClass, isAuthLoading, isFocused]);

  const fetchTimetable = async (classGroup: string) => {
    setIsTimetableLoading(true);
    try {
      const response = await apiClient.get(`/timetable/${classGroup}`);
      setApiTimetableData(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'An error occurred while fetching timetable.');
      setApiTimetableData([]);
    } finally {
      setIsTimetableLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await apiClient.get('/teachers');
      setTeachers(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'An error occurred while fetching teachers.');
    }
  };

  const scheduleData = useMemo(() => {
    const timetableMap = new Map<string, TimetableSlotFromAPI>();
    apiTimetableData.forEach(slot => {
      const key = `${slot.day_of_week}-${slot.period_number}`;
      timetableMap.set(key, slot);
    });

    return PERIOD_DEFINITIONS.map(pDef => {
      const periods: RenderablePeriod[] = DAYS.map(day => {
        if (pDef.isBreak) return { subject: pDef.period === 3 ? 'Break' : 'Lunch', isBreak: true };
        const key = `${day}-${pDef.period}`;
        const slotData = timetableMap.get(key);
        return {
          subject: slotData?.subject_name,
          teacher: slotData?.teacher_name,
          teacher_id: slotData?.teacher_id,
        };
      });
      return { time: pDef.time, periods };
    });
  }, [apiTimetableData]);

  const handleSlotPress = (day: Day, period: number) => {
    if (user?.role !== 'admin') return;
    setSelectedSlot({ day, period });
    setIsModalVisible(true);
  };

  const handleTeacherSlotPress = (subject: string, periodNumber: number, dayOfColumn: Day) => {
    const today = new Date();
    const currentDayOfWeek = today.toLocaleString('en-US', { weekday: 'long' }) as Day;

    if (dayOfColumn !== currentDayOfWeek) {
      Alert.alert('Invalid Day', `You can only mark attendance for today (${currentDayOfWeek}).`);
      return;
    }
    
    // --- MODIFIED: Enforce 1st Period Only Rule ---
    if (periodNumber !== 1) {
      Alert.alert('Attendance Rule', 'Attendance is only taken for the first period to mark the full day.');
      return;
    }
    // --- END MODIFICATION ---
    
    if (!user?.id) return;

    navigation.navigate('Attendance', {
      class_group: selectedClass,
      subject_name: subject,
      period_number: periodNumber, // This will always be 1 now
      date: today.toISOString().split('T')[0],
    });
  };

  const handleSaveChanges = async (slotToSave: { subject_name?: string; teacher_id?: number }) => {
    if (!selectedSlot || !selectedClass) return;
    const payload = {
      class_group: selectedClass,
      day_of_week: selectedSlot.day,
      period_number: selectedSlot.period,
      subject_name: slotToSave.subject_name || null,
      teacher_id: slotToSave.teacher_id || null,
    };
    try {
      await apiClient.post('/timetable', payload);
      Alert.alert('Success', 'Timetable updated!');
      setIsModalVisible(false);
      fetchTimetable(selectedClass);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'An error occurred while updating timetable.');
    }
  };

  if (isAuthLoading || !user) {
    return ( <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#5E35B1" /></View> );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.pageContainer}>
        <View style={styles.pageHeaderContainer}>
          <Image
            source={{ uri: 'https://cdn-icons-png.flaticon.com/128/2693/2693507.png' }}
            style={styles.pageHeaderIcon}
            defaultSource={require('../assets/fallback-icon.png')}
          />
          <View style={styles.pageHeaderTextContainer}>
            <Text style={styles.pageMainTitle}>Class Schedule - {selectedClass}</Text>
            <Text style={styles.pageSubTitle}>Logged in as: {user.full_name}</Text>
          </View>
        </View>

        {(user.role === 'admin' || user.role === 'teacher') && (
          <View style={styles.adminPickerWrapper}>
            <Picker
              selectedValue={selectedClass}
              onValueChange={(itemValue: string) => setSelectedClass(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              dropdownIconColor="#333"
            >
              {classPickerData.map(option => (
                <Picker.Item key={option.key} label={option.label} value={option.key} />
              ))}
            </Picker>
          </View>
        )}

        {isTimetableLoading ? (
            <ActivityIndicator size="large" color="#5E35B1" style={{ marginTop: 50 }} />
        ) : (
            <View style={styles.tableOuterContainer}>
              <View style={styles.tableHeaderRow}>
                {tableHeaders.map(h => (
                  <View key={h.name} style={[styles.tableHeaderCell, { backgroundColor: h.color, width: h.width }]}>
                    <Text style={[styles.tableHeaderText, { color: h.textColor }]}>{h.name}</Text>
                  </View>
                ))}
              </View>
              {scheduleData.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.timeCell, { width: tableHeaders[0].width }]}>
                    <Text style={styles.timeText}>{row.time}</Text>
                  </View>
                  {row.periods.map((period, periodIndex) => {
                    const day = DAYS[periodIndex];
                    const periodNumber = PERIOD_DEFINITIONS[rowIndex].period;
                    const isMyPeriod = user.id && String(period.teacher_id) === String(user.id);
                    return (
                      <TouchableOpacity
                        key={periodIndex}
                        style={[
                          styles.tableCell,
                          period.isBreak ? styles.breakCell : styles.periodCell,
                          isMyPeriod && styles.myPeriodCell,
                          { width: tableHeaders[periodIndex + 1].width },
                        ]}
                        disabled={user.role !== 'admin' && !isMyPeriod}
                        onPress={() =>
                          user.role === 'admin'
                            ? handleSlotPress(day, periodNumber)
                            : isMyPeriod && handleTeacherSlotPress(period.subject!, periodNumber, day)
                        }
                      >
                        <Text style={period.isBreak ? styles.breakTextSubject : styles.subjectText} numberOfLines={2}>
                          {period.subject || '-'}
                        </Text>
                        {!period.isBreak && period.teacher && (
                          <Text style={styles.teacherText} numberOfLines={1}>
                            {period.teacher}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
        )}
      </ScrollView>
      {selectedSlot && (
        <EditSlotModal
          isVisible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          onSave={handleSaveChanges}
          slotInfo={selectedSlot}
          teachers={teachers}
          currentData={apiTimetableData.find(
            d => d.day_of_week === selectedSlot.day && d.period_number === selectedSlot.period
          )}
        />
      )}
    </SafeAreaView>
  );
};

// --- Edit Slot Modal Component (No changes needed here) ---
const EditSlotModal = ({
  isVisible,
  onClose,
  onSave,
  slotInfo,
  teachers,
  currentData,
}: {
  isVisible: boolean;
  onClose: () => void;
  onSave: (slot: { subject_name?: string; teacher_id?: number }) => void;
  slotInfo: { day: Day; period: number };
  teachers: Teacher[];
  currentData?: TimetableSlotFromAPI;
}) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | undefined>(
    currentData?.teacher_id
  );
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(
    currentData?.subject_name
  );

  useEffect(() => {
    setSelectedTeacherId(currentData?.teacher_id);
    setSelectedSubject(currentData?.subject_name);
  }, [currentData]);

  const availableSubjects = useMemo(() => {
    if (!selectedTeacherId) return [];
    return teachers.find(t => t.id === selectedTeacherId)?.subjects_taught || [];
  }, [selectedTeacherId, teachers]);

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Slot</Text>
          <Text style={styles.modalSubtitle}>
            {slotInfo.day} - Period {slotInfo.period}
          </Text>
          <Text style={styles.inputLabel}>Teacher</Text>
          <View style={styles.modalPickerStyle}>
            <Picker
              selectedValue={selectedTeacherId?.toString() || 'none'}
              onValueChange={(itemValue: string) => {
                const teacherId = itemValue === 'none' ? undefined : parseInt(itemValue);
                setSelectedTeacherId(teacherId);
                setSelectedSubject(undefined);
              }}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              dropdownIconColor="#333"
            >
              <Picker.Item label="-- Select Teacher --" value="none" />
              {teachers.map(t => (
                <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />
              ))}
            </Picker>
          </View>
          <Text style={styles.inputLabel}>Subject</Text>
          <View style={styles.modalPickerStyle}>
            <Picker
              selectedValue={selectedSubject || 'none'}
              onValueChange={(itemValue: string) =>
                setSelectedSubject(itemValue === 'none' ? undefined : itemValue)
              }
              style={styles.picker}
              itemStyle={styles.pickerItem}
              enabled={!!selectedTeacherId && availableSubjects.length > 0}
              dropdownIconColor="#333"
            >
              <Picker.Item label="-- Select Subject --" value="none" />
              {availableSubjects.map(s => (
                <Picker.Item key={s} label={s} value={s} />
              ))}
            </Picker>
          </View>
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity
              style={[styles.modalButton, styles.clearButton]}
              onPress={() => onSave({})}
            >
              <Text style={styles.modalButtonText}>Clear Slot</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={() => onSave({ teacher_id: selectedTeacherId, subject_name: selectedSubject })}
            >
              <Text style={styles.modalButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// --- Styles (No changes needed here) ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F8' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F6F8' },
  pageContainer: { paddingBottom: 30 },
  pageHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 15,
  },
  pageHeaderIcon: {
    width: 32,
    height: 32,
    marginRight: 15,
    resizeMode: 'contain',
  },
  pageHeaderTextContainer: { flex: 1 },
  pageMainTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50' },
  pageSubTitle: { fontSize: 14, color: '#566573', paddingTop: 2 },
  adminPickerWrapper: {
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 10,
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
  },
  modalPickerStyle: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 10,
    padding: 10,
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#333',
  },
  pickerItem: {
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
  },
  tableOuterContainer: {
    marginHorizontal: TABLE_HORIZONTAL_MARGIN,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#455A64',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#CFD8DC' },
  tableHeaderCell: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ECEFF1',
  },
  tableHeaderText: { fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F3F4' },
  tableCell: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F1F3F4',
    minHeight: 60,
  },
  timeCell: { alignItems: 'center', backgroundColor: '#F8F9FA' },
  timeText: { fontSize: 11, color: '#495057', fontWeight: '500', textAlign: 'center' },
  periodCell: { backgroundColor: '#FFFFFF' },
  myPeriodCell: { backgroundColor: '#D1E7DD', borderWidth: 1, borderColor: '#A3BFA8' },
  subjectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#37474F',
    marginBottom: 3,
    textAlign: 'center',
  },
  teacherText: { fontSize: 10, color: '#78909C', textAlign: 'center' },
  breakCell: { alignItems: 'center', backgroundColor: '#ECEFF1' },
  breakTextSubject: { fontSize: 12, fontWeight: '500', color: '#546E7A', textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    elevation: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  modalSubtitle: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 20 },
  inputLabel: { fontSize: 16, marginTop: 15, marginBottom: 5, color: '#333' },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
  },
  modalButton: { flex: 1, padding: 12, borderRadius: 5, alignItems: 'center' },
  saveButton: { backgroundColor: '#27AE60', marginLeft: 10 },
  clearButton: { backgroundColor: '#E74C3C', marginRight: 10 },
  modalButtonText: { color: 'white', fontWeight: 'bold' },
  closeButton: { marginTop: 15, padding: 10 },
  closeButtonText: { textAlign: 'center', color: '#3498DB', fontSize: 16 },
});

export default TimetableScreen;