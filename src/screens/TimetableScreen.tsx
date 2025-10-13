import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  Dimensions, TouchableOpacity, Modal, ActivityIndicator, Alert, Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Animatable from 'react-native-animatable';
import { useAuth } from '../context/AuthContext'; // Using your existing AuthContext
import apiClient from '../api/client';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// --- Type Definitions ---
type RootStackParamList = { Attendance: { class_group: string; subject_name: string; period_number: number; date: string; }; };
interface TimetableSlotFromAPI { id?: number; class_group: string; day_of_week: Day; period_number: number; subject_name?: string; teacher_id?: number; teacher_name?: string; }
interface Teacher { id: number; full_name: string; subjects_taught: string[]; }
interface PeriodDefinition { period: number; time: string; isBreak?: boolean; }
interface RenderablePeriod { subject?: string; teacher?: string; teacher_id?: number; isBreak?: boolean; }
type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

// --- Constants ---
const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_DEFINITIONS: PeriodDefinition[] = [ { period: 1, time: '09:00-09:45' }, { period: 2, time: '09:45-10:30' }, { period: 3, time: '10:30-10:45', isBreak: true }, { period: 4, time: '10:45-11:30' }, { period: 5, time: '11:30-12:15' }, { period: 6, time: '12:15-01:00', isBreak: true }, { period: 7, time: '01:00-01:45' }, { period: 8, time: '01:45-02:30' }, ];
const { width } = Dimensions.get('window');
const TABLE_HORIZONTAL_MARGIN = 10;
const tableContentWidth = width - TABLE_HORIZONTAL_MARGIN * 2;
const timeColumnWidth = Math.floor(tableContentWidth * 0.20);
const dayColumnWidth = Math.floor((tableContentWidth * 0.80) / 6);
const tableHeaders = [ { name: 'TIME', color: '#F8F9FA', textColor: '#343A40', width: timeColumnWidth }, { name: 'MON', color: '#FFFDE7', textColor: '#5D4037', width: dayColumnWidth }, { name: 'TUE', color: '#FCE4EC', textColor: '#880E4F', width: dayColumnWidth }, { name: 'WED', color: '#FFEBEE', textColor: '#C62828', width: dayColumnWidth }, { name: 'THU', color: '#EDE7F6', textColor: '#4527A0', width: dayColumnWidth }, { name: 'FRI', color: '#E8EAF6', textColor: '#1A237E', width: dayColumnWidth }, { name: 'SAT', color: '#E0F7FA', textColor: '#006064', width: dayColumnWidth }, ];
const subjectColorPalette = [ '#E3F2FD', '#FCE4EC', '#F3E5F5', '#E8EAF6', '#E0F2F1', '#FFF9C4', '#FBE9E7', '#EFEBE9', '#E0F7FA', '#F1F8E9', ];
const subjectColorMap = new Map<string, string>();
let colorIndex = 0;
const getSubjectColor = (subject?: string): string => { if (!subject) return '#FFFFFF'; if (subjectColorMap.has(subject)) { return subjectColorMap.get(subject)!; } const color = subjectColorPalette[colorIndex % subjectColorPalette.length]; subjectColorMap.set(subject, color); colorIndex++; return color; };


const TimetableScreen = () => {
  const { user, isLoading: isAuthLoading } = useAuth(); // Using your AuthContext as is.
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [isTimetableLoading, setIsTimetableLoading] = useState(true);
  const [apiTimetableData, setApiTimetableData] = useState<TimetableSlotFromAPI[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: Day; period: number } | null>(null);
  const [selectedClass, setSelectedClass] = useState(''); // The key state, starts empty.

  // --- LOGIC DIRECTLY FROM YOUR WORKING WEB CODE ---

  // Effect 1: Initialize the component and set the default class
  // This runs when the user data is available. Its ONLY job is to set the default class.
  useEffect(() => {
    if (!user || isAuthLoading) {
      return; // Wait until auth is complete and user is available
    }

    // This logic is identical to your web app's `initializeData`
    const initializeData = () => {
      if (user.role === 'admin') {
        setSelectedClass(CLASS_GROUPS[0]);
        fetchTeachers(); // Fetch teachers list for the modal
      } else if (user.role === 'teacher') {
        // Teachers default to their assigned class, or LKG as a fallback
        const initialClass = user.class_group && CLASS_GROUPS.includes(user.class_group) ? user.class_group : CLASS_GROUPS[0];
        setSelectedClass(initialClass);
      } else if (user.role === 'student' && user.class_group) {
        setSelectedClass(user.class_group);
      }
    };

    initializeData();
  }, [user, isAuthLoading]); // Dependencies are the same as your web code

  // Effect 2: Fetch timetable data whenever `selectedClass` changes
  // This hook REACTS to the class being set by Effect 1 or by the user in the dropdown.
  useEffect(() => {
    // This condition is identical to your web app's fetching logic
    if (selectedClass && !isAuthLoading) {
      fetchTimetable(selectedClass);
    }
  }, [selectedClass]); // NOTE: We ONLY depend on selectedClass here. isAuthLoading is checked inside.

  const fetchTimetable = async (classGroup: string) => {
    setIsTimetableLoading(true);
    try {
      const response = await apiClient.get(`/timetable/${classGroup}`);
      setApiTimetableData(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to fetch timetable data.');
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
      Alert.alert('Error', error.response?.data?.message || 'Failed to fetch teachers list.');
    }
  };
  
  // --- END OF LOGIC FROM YOUR WEB CODE ---

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
        return { subject: slotData?.subject_name, teacher: slotData?.teacher_name, teacher_id: slotData?.teacher_id };
      });
      return { time: pDef.time, periods };
    });
  }, [apiTimetableData]);

  const handleSaveChanges = async (slotToSave: { subject_name?: string; teacher_id?: number }) => {
    if (!selectedSlot || !selectedClass) return;
    const payload = {
      class_group: selectedClass, day_of_week: selectedSlot.day, period_number: selectedSlot.period,
      subject_name: slotToSave.subject_name || null, teacher_id: slotToSave.teacher_id || null,
    };
    try {
      await apiClient.post('/timetable', payload);
      Alert.alert('Success', 'Timetable updated!');
      setIsModalVisible(false);
      fetchTimetable(selectedClass); // Refresh data after saving
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'An error occurred while updating timetable.');
    }
  };
  
  const handleSlotPress = (day: Day, period: number) => {
    if (user?.role !== 'admin') return;
    setSelectedSlot({ day, period });
    setIsModalVisible(true);
  };

  const handleTeacherSlotPress = (subject: string, periodNumber: number, dayOfColumn: Day) => {
    const today = new Date();
    const currentDayOfWeek = today.toLocaleString('en-US', { weekday: 'long' }) as Day;
    if (dayOfColumn !== currentDayOfWeek) { Alert.alert('Invalid Day', `You can only mark attendance for today (${currentDayOfWeek}).`); return; }
    if (periodNumber !== 1) { Alert.alert('Attendance Rule', 'Attendance is only taken for the first period to mark the full day.'); return; }
    if (!user?.id || !selectedClass) return;
    navigation.navigate('Attendance', { class_group: selectedClass, subject_name: subject, period_number: periodNumber, date: today.toISOString().split('T')[0] });
  };
  
  // Show a full-screen loader ONLY while the AuthContext is loading the user.
  if (isAuthLoading) {
    return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#5E35B1" /></View>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.pageContainer}>
        <Animatable.View animation="fadeInDown" duration={600}>
            <View style={styles.pageHeaderContainer}>
            <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/128/2693/2693507.png' }}
                style={styles.pageHeaderIcon}
            />
            <View style={styles.pageHeaderTextContainer}>
                <Text style={styles.pageMainTitle}>Class Schedule - {selectedClass}</Text>
                <Text style={styles.pageSubTitle}>Logged in as: {user?.full_name}</Text>
            </View>
            </View>
        </Animatable.View>

        {(user?.role === 'admin' || user?.role === 'teacher') && (
          <Animatable.View animation="fadeIn" duration={500} delay={200}>
            <View style={styles.adminPickerWrapper}>
                <Picker
                    selectedValue={selectedClass}
                    onValueChange={(itemValue: string) => setSelectedClass(itemValue)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                    dropdownIconColor="#333"
                >
                {CLASS_GROUPS.map(option => (
                    <Picker.Item key={option} label={option} value={option} />
                ))}
                </Picker>
            </View>
          </Animatable.View>
        )}

        {isTimetableLoading ? (
            <ActivityIndicator size="large" color="#5E35B1" style={{ marginTop: 50 }} />
        ) : (
            <Animatable.View animation="fadeInUp" duration={700} delay={300} style={styles.tableOuterContainer}>
              <View style={styles.tableHeaderRow}>
                {tableHeaders.map(h => ( <View key={h.name} style={[styles.tableHeaderCell, { backgroundColor: h.color, width: h.width }]}><Text style={[styles.tableHeaderText, { color: h.textColor }]}>{h.name}</Text></View> ))}
              </View>
              {scheduleData.map((row, rowIndex) => (
                <Animatable.View key={rowIndex} animation="fadeIn" duration={500} delay={rowIndex * 100}>
                    <View style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.timeCell, { width: tableHeaders[0].width }]}><Text style={styles.timeText}>{row.time}</Text></View>
                    {row.periods.map((period, periodIndex) => {
                        const day = DAYS[periodIndex];
                        const periodNumber = PERIOD_DEFINITIONS[rowIndex].period;
                        const isMyPeriod = user?.id && String(period.teacher_id) === String(user.id);
                        const periodBgColor = getSubjectColor(period.subject);
                        return (
                        <TouchableOpacity key={periodIndex} style={[ styles.tableCell, period.isBreak ? styles.breakCell : { backgroundColor: periodBgColor }, isMyPeriod && styles.myPeriodCell, { width: tableHeaders[periodIndex + 1].width }, ]} disabled={user?.role !== 'admin' && !isMyPeriod} onPress={() => user?.role === 'admin' ? handleSlotPress(day, periodNumber) : isMyPeriod && handleTeacherSlotPress(period.subject!, periodNumber, day) }>
                            <Text style={period.isBreak ? styles.breakTextSubject : styles.subjectText} numberOfLines={2}>{period.subject || 'Free'}</Text>
                            {!period.isBreak && period.teacher && (<Text style={styles.teacherText} numberOfLines={1}>{period.teacher}</Text>)}
                        </TouchableOpacity>
                        );
                    })}
                    </View>
                </Animatable.View>
              ))}
            </Animatable.View>
        )}
      </ScrollView>
      {selectedSlot && ( <EditSlotModal isVisible={isModalVisible} onClose={() => setIsModalVisible(false)} onSave={handleSaveChanges} slotInfo={selectedSlot} teachers={teachers} currentData={apiTimetableData.find(d => d.day_of_week === selectedSlot.day && d.period_number === selectedSlot.period)} /> )}
    </SafeAreaView>
  );
};


const EditSlotModal=({isVisible,onClose,onSave,slotInfo,teachers,currentData,}:{isVisible:boolean;onClose:()=>void;onSave:(slot:{subject_name?:string;teacher_id?:number})=>void;slotInfo:{day:Day;period:number};teachers:Teacher[];currentData?:TimetableSlotFromAPI;})=>{const [selectedTeacherId,setSelectedTeacherId]=useState<number|undefined>(currentData?.teacher_id);const [selectedSubject,setSelectedSubject]=useState<string|undefined>(currentData?.subject_name);useEffect(()=>{setSelectedTeacherId(currentData?.teacher_id);setSelectedSubject(currentData?.subject_name);},[currentData]);const availableSubjects=useMemo(()=>{if(!selectedTeacherId)return[];const teacher=teachers.find(t=>t.id===selectedTeacherId);return teacher?.subjects_taught||[];},[selectedTeacherId,teachers]);return(<Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalOverlay}><Animatable.View animation="zoomIn" duration={400} style={styles.modalContent}><Text style={styles.modalTitle}>Edit Slot</Text><Text style={styles.modalSubtitle}>{slotInfo.day} - Period {slotInfo.period}</Text><Text style={styles.inputLabel}>Teacher</Text><View style={styles.modalPickerStyle}><Picker selectedValue={selectedTeacherId?.toString()||'none'} onValueChange={(itemValue:string)=>{const teacherId=itemValue==='none'?undefined:parseInt(itemValue);setSelectedTeacherId(teacherId);setSelectedSubject(undefined);}} style={styles.picker} itemStyle={styles.pickerItem} dropdownIconColor="#333"><Picker.Item label="-- Select Teacher --" value="none"/>{teachers.map(t=>(<Picker.Item key={t.id} label={t.full_name} value={t.id.toString()}/>))}</Picker></View><Text style={styles.inputLabel}>Subject</Text><View style={styles.modalPickerStyle}><Picker selectedValue={selectedSubject||'none'} onValueChange={(itemValue:string)=>setSelectedSubject(itemValue==='none'?undefined:itemValue)} style={styles.picker} itemStyle={styles.pickerItem} enabled={!!selectedTeacherId&&availableSubjects.length>0} dropdownIconColor="#333"><Picker.Item label="-- Select Subject --" value="none"/>{availableSubjects.map(s=>(<Picker.Item key={s} label={s} value={s}/>))}</Picker></View><View style={styles.modalButtonContainer}><TouchableOpacity style={[styles.modalButton,styles.clearButton]} onPress={()=>onSave({})}><Text style={styles.modalButtonText}>Clear Slot</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton,styles.saveButton]} onPress={()=>onSave({teacher_id:selectedTeacherId,subject_name:selectedSubject})}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity></View><TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeButtonText}>Cancel</Text></TouchableOpacity></Animatable.View></View></Modal>);};
const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:'#F7F9FC'},loaderContainer:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#F7F9FC'},pageContainer:{paddingBottom:30},pageHeaderContainer:{flexDirection:'row',alignItems:'center',paddingVertical:18,paddingHorizontal:16,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#E0E0E0',marginBottom:15,},pageHeaderIcon:{width:32,height:32,marginRight:15,resizeMode:'contain',},pageHeaderTextContainer:{flex:1},pageMainTitle:{fontSize:18,fontWeight:'bold',color:'#2C3E50'},pageSubTitle:{fontSize:14,color:'#566573',paddingTop:2},adminPickerWrapper:{marginHorizontal:10,marginBottom:15,backgroundColor:'#FFFFFF',borderRadius:12,elevation:2,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:5,},modalPickerStyle:{borderWidth:1,borderColor:'#ccc',borderRadius:8,marginBottom:10,backgroundColor:'#F9F9F9',},picker:{height:50,width:'100%',color:'#333',},pickerItem:{fontSize:16,color:'#333',textAlign:'left',},tableOuterContainer:{marginHorizontal:TABLE_HORIZONTAL_MARGIN,backgroundColor:'#FFFFFF',borderRadius:10,overflow:'hidden',elevation:3,shadowColor:'#455A64',shadowOffset:{width:0,height:2},shadowOpacity:0.1,shadowRadius:3,borderWidth:1,borderColor:'#E0E0E0',},tableHeaderRow:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:'#CFD8DC'},tableHeaderCell:{paddingVertical:12,paddingHorizontal:4,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:'#ECEFF1',},tableHeaderText:{fontSize:11,fontWeight:'bold',textAlign:'center'},tableRow:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:'#F1F3F4'},tableCell:{paddingVertical:8,paddingHorizontal:4,justifyContent:'center',borderRightWidth:1,borderRightColor:'#F1F3F4',minHeight:60,},timeCell:{alignItems:'center',backgroundColor:'#F8F9FA'},timeText:{fontSize:11,color:'#495057',fontWeight:'500',textAlign:'center'},myPeriodCell:{backgroundColor:'#A0E7E5',borderWidth:1.5,borderColor:'#006A71',},subjectText:{fontSize:12,fontWeight:'600',color:'#37474F',marginBottom:3,textAlign:'center',},teacherText:{fontSize:10,color:'#78909C',textAlign:'center'},breakCell:{alignItems:'center',backgroundColor:'#EAECEE',},breakTextSubject:{fontSize:12,fontWeight:'500',color:'#546E7A',textAlign:'center'},modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'center',alignItems:'center',},modalContent:{width:'90%',backgroundColor:'white',borderRadius:15,padding:20,elevation:10,shadowColor:'#000',shadowOpacity:0.2,shadowRadius:10,},modalTitle:{fontSize:22,fontWeight:'bold',textAlign:'center',color:'#333'},modalSubtitle:{fontSize:16,color:'#555',textAlign:'center',marginBottom:20},inputLabel:{fontSize:16,marginTop:15,marginBottom:5,color:'#333',fontWeight:'500'},modalButtonContainer:{flexDirection:'row',justifyContent:'space-between',marginTop:25,},modalButton:{flex:1,padding:12,borderRadius:8,alignItems:'center',elevation:2},saveButton:{backgroundColor:'#27AE60',marginLeft:10},clearButton:{backgroundColor:'#E74C3C',marginRight:10},modalButtonText:{color:'white',fontWeight:'bold'},closeButton:{marginTop:15,padding:10},closeButtonText:{textAlign:'center',color:'#3498DB',fontSize:16,fontWeight:'600'},});

export default TimetableScreen;