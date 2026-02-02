import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert, Modal, Animated, Easing
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const COL_WIDTHS = { ROLL: 50, NAME: 150, STATUS: 180, REMARKS: 200 };
const TABLE_MIN_WIDTH = COL_WIDTHS.ROLL + COL_WIDTHS.NAME + COL_WIDTHS.STATUS + COL_WIDTHS.REMARKS; 

// Matches Table 1: student_feedback
interface StudentFeedbackRow {
    student_id: number;
    full_name: string;
    roll_no: string;
    status_marks: number | null; // Database column
    remarks_category: 'Good' | 'Average' | 'Poor' | null; // Database column
}

interface AnalyticsItem {
    student_id: number;
    full_name: string;
    roll_no: string;
    avg_rating: string;
    percentage: string;
}

interface Teacher { id: number; full_name: string; }

const AnimatedBar = ({ percentage, rating, label, subLabel, color }: any) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(animatedHeight, {
            toValue: 1, duration: 1000, useNativeDriver: false, easing: Easing.out(Easing.poly(4)),
        }).start();
    }, [percentage]);
    const heightStyle = animatedHeight.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${percentage}%`] });
    return (
        <View style={styles.barWrapper}>
            <Text style={styles.barLabelTop}>{Math.round(percentage)}%</Text>
            <View style={styles.barTrack}><Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} /></View>
            <Text style={styles.barLabelBottom} numberOfLines={1}>{label.split(' ')[0]}</Text>
            {subLabel && <Text style={{fontSize:9, color:'#666'}}>{subLabel}</Text>}
            <View style={{flexDirection:'row', alignItems:'center', marginTop:2}}>
                 <Text style={{fontSize:10, fontWeight:'bold', color:'#555'}}>{rating}</Text>
                 <MaterialIcons name="star" size={10} color="#FFC107" />
            </View>
        </View>
    );
};

const StudentFeedback = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    
    // Filters
    const [allClasses, setAllClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);

    // Data
    const [students, setStudents] = useState<StudentFeedbackRow[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const isOverallView = selectedSubject === 'All Subjects';

    // Modal
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareClass, setCompareClass] = useState('');
    const [compareSubject, setCompareSubject] = useState('All Subjects');
    const [compareSubjectsList, setCompareSubjectsList] = useState<string[]>([]);
    const [compareSort, setCompareSort] = useState<'roll' | 'high' | 'low'>('roll');
    const [analyticsData, setAnalyticsData] = useState<AnalyticsItem[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    // 1. Init
    useEffect(() => {
        if (!user) return;
        const fetchClasses = async () => {
            try {
                const res = user?.role === 'admin' 
                    ? await apiClient.get('/feedback/classes') 
                    : await apiClient.get(`/teacher-classes/${user.id}`);
                setAllClasses(res.data);
                if (res.data.length > 0) {
                    setSelectedClass(res.data[0]);
                    setCompareClass(res.data[0]);
                }
            } catch (e) { console.error(e); }
        };
        fetchClasses();
    }, [user]);

    // 2. Fetch Subjects
    useEffect(() => {
        if (!selectedClass) return;
        const fetchSubjects = async () => {
            try {
                const params: any = { class_group: selectedClass };
                if (user?.role === 'teacher') params.teacher_id = user.id;
                const res = await apiClient.get('/feedback/subjects', { params });
                const list = user?.role === 'admin' ? ['All Subjects', ...res.data] : res.data;
                setAvailableSubjects(list);
                if (list.length > 0) setSelectedSubject(list[0]);
            } catch (e) { console.error(e); }
        };
        fetchSubjects();
    }, [selectedClass, user]);

    // 3. Fetch Teachers (Admin)
    useEffect(() => {
        if (!selectedClass || !selectedSubject || isOverallView) {
            setAvailableTeachers([]);
            if (user?.role === 'admin') setSelectedTeacherId(null);
            return;
        }
        if (user?.role === 'teacher') {
            setSelectedTeacherId(user.id);
        } else if (user?.role === 'admin') {
            apiClient.get('/feedback/teachers', { params: { class_group: selectedClass, subject: selectedSubject } })
                .then(res => {
                    setAvailableTeachers(res.data);
                    if (res.data.length > 0) setSelectedTeacherId(res.data[0].id);
                }).catch(console.error);
        }
    }, [selectedClass, selectedSubject, user]);

    // 4. Fetch Students
    const fetchStudentData = useCallback(async () => {
        if (!selectedClass || (!isOverallView && !selectedTeacherId)) return;
        setLoading(true);
        try {
            const params: any = { class_group: selectedClass };
            if (isOverallView) params.mode = 'overall';
            else {
                params.teacher_id = selectedTeacherId;
                params.subject = selectedSubject; // Important: Filter by subject for Telugu/Social
            }

            const res = await apiClient.get('/feedback/students', { params });
            // Map DB columns
            setStudents(res.data.map((s: any) => ({
                ...s,
                status_marks: s.status_marks || 0, 
                remarks_category: s.remarks_category || null
            })));
            setHasChanges(false);
        } catch (error) { console.error(error); } 
        finally { setLoading(false); }
    }, [selectedClass, selectedTeacherId, isOverallView, selectedSubject]);

    useEffect(() => {
        if ((isOverallView && selectedClass) || (selectedClass && selectedSubject && selectedTeacherId)) {
            fetchStudentData();
        }
    }, [fetchStudentData]);

    // 5. Save Data
    const handleSave = async () => {
        if (isOverallView || !selectedTeacherId || !selectedClass) return;
        setLoading(true);
        try {
            const payload = {
                teacher_id: selectedTeacherId,
                class_group: selectedClass,
                subject_name: selectedSubject, // Sending Subject Name to DB
                feedback_data: students.map(s => ({
                    student_id: s.student_id,
                    status_marks: s.status_marks === 0 ? null : s.status_marks, 
                    remarks_category: s.remarks_category
                }))
            };
            await apiClient.post('/feedback', payload);
            Alert.alert("Success", "Student behavior updated!");
            setHasChanges(false);
        } catch (error) { Alert.alert("Error", "Failed to save."); } 
        finally { setLoading(false); }
    };

    const updateStudentFeedback = (id: number, field: keyof StudentFeedbackRow, value: any) => {
        if (user?.role === 'admin' || isOverallView) return;
        setStudents(prev => prev.map(s => s.student_id === id ? { ...s, [field]: value } : s));
        setHasChanges(true);
    };

    // 6. Analytics
    useEffect(() => {
        if (showCompareModal && compareClass) {
            apiClient.get('/feedback/subjects', { params: { class_group: compareClass } })
                .then(res => {
                    setCompareSubjectsList(['All Subjects', ...res.data]);
                    setCompareSubject('All Subjects');
                }).catch(console.error);
        }
    }, [showCompareModal, compareClass]);

    useEffect(() => {
        if (showCompareModal && compareClass) {
            setLoadingAnalytics(true);
            const params = { class_group: compareClass, subject: compareSubject, mode: 'analytics' };
            apiClient.get('/feedback/students', { params }).then(res => {
                let data = res.data;
                const hasData = data.some((item: any) => parseFloat(item.percentage) > 0);
                if (!hasData) setAnalyticsData([]);
                else {
                    data.sort((a: AnalyticsItem, b: AnalyticsItem) => 
                        compareSort === 'roll' ? parseInt(a.roll_no||'0') - parseInt(b.roll_no||'0') :
                        compareSort === 'high' ? parseFloat(b.avg_rating) - parseFloat(a.avg_rating) :
                        parseFloat(a.avg_rating) - parseFloat(b.avg_rating)
                    );
                    setAnalyticsData(data);
                }
            }).catch(console.error).finally(() => setLoadingAnalytics(false));
        }
    }, [showCompareModal, compareClass, compareSubject, compareSort]);

    const RemarkButton = ({ label, targetValue, currentValue, color, onPress, disabled }: any) => {
        const isSelected = currentValue === targetValue;
        return (
            <TouchableOpacity 
                style={[styles.remarkBtn, { opacity: (isOverallView && !isSelected) ? 0.3 : 1 }, isSelected ? { backgroundColor: color, borderColor: color } : { borderColor: '#E0E0E0', backgroundColor: '#FFF' }]}
                onPress={onPress} disabled={disabled}
            >
                <Text style={[styles.remarkBtnText, isSelected ? { color: '#FFF' } : { color: '#9e9e9e' }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}><MaterialIcons name="fact-check" size={24} color="#008080" /></View>
                    <View><Text style={styles.headerTitle}>Behaviour</Text><Text style={styles.headerSubtitle}>Student Tracking</Text></View>
                </View>
                {isOverallView && <View style={styles.overallBadge}><Text style={styles.overallBadgeText}>Overall View</Text></View>}
            </View>

            <View style={styles.filterContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <View style={[styles.pickerWrapper, { flex: 1, marginBottom: 0 }]}>
                        <Picker selectedValue={selectedClass} onValueChange={setSelectedClass} style={styles.picker}>
                            {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>
                    <TouchableOpacity style={styles.comButton} onPress={() => { if(selectedClass) setCompareClass(selectedClass); setShowCompareModal(true); }}>
                        <Text style={styles.comBtnText}>COM</Text><MaterialIcons name="bar-chart" size={18} color="#fff" style={{marginLeft: 4}} />
                    </TouchableOpacity>
                </View>

                {selectedClass !== '' && (
                    <View style={styles.pickerWrapper}>
                        <Picker selectedValue={selectedSubject} onValueChange={setSelectedSubject} style={styles.picker}>
                            {availableSubjects.map(s => <Picker.Item key={s} label={s} value={s} />)}
                        </Picker>
                    </View>
                )}

                {user?.role === 'admin' && selectedSubject !== '' && !isOverallView && (
                    <View style={styles.pickerWrapper}>
                        <Picker selectedValue={selectedTeacherId?.toString()} onValueChange={v => v && setSelectedTeacherId(parseInt(v))} style={styles.picker}>
                            {availableTeachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />)}
                        </Picker>
                    </View>
                )}
            </View>

            <View style={{flex: 1}}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}>
                    <View style={{ minWidth: TABLE_MIN_WIDTH }}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: COL_WIDTHS.ROLL, textAlign: 'center' }]}>Roll</Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.NAME }]}>Student Name</Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.STATUS, textAlign: 'center' }]}>{isOverallView ? 'Avg Rating' : 'Rating'}</Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.REMARKS, textAlign: 'center' }]}>Remarks</Text>
                        </View>
                        {loading ? <ActivityIndicator size="large" color="#008080" style={{ marginTop: 40 }} /> : (
                            <ScrollView contentContainerStyle={{ paddingBottom: 130 }}> 
                                {students.length > 0 ? students.map((item, index) => (
                                    <View key={item.student_id} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                                        <Text style={[styles.td, { width: COL_WIDTHS.ROLL, textAlign: 'center', fontWeight: 'bold' }]}>{item.roll_no || '-'}</Text>
                                        <Text style={[styles.td, { width: COL_WIDTHS.NAME }]} numberOfLines={1}>{item.full_name}</Text>
                                        <View style={{ width: COL_WIDTHS.STATUS, flexDirection: 'row', justifyContent: 'center' }}>
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <TouchableOpacity key={star} onPress={() => updateStudentFeedback(item.student_id, 'status_marks', star)} disabled={isOverallView || user?.role === 'admin'} style={{ padding: 2 }}>
                                                    <MaterialIcons name={item.status_marks && item.status_marks >= star ? "star" : "star-border"} size={28} color={item.status_marks && item.status_marks >= star ? "#FFC107" : "#CFD8DC"} />
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        <View style={{ width: COL_WIDTHS.REMARKS, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                                            {['Good', 'Average', 'Poor'].map(cat => (
                                                <RemarkButton key={cat} label={cat[0]} targetValue={cat} currentValue={item.remarks_category} color={cat==='Good'?'#10b981':cat==='Average'?'#3b82f6':'#ef4444'} 
                                                    disabled={isOverallView || user?.role === 'admin'} onPress={() => updateStudentFeedback(item.student_id, 'remarks_category', cat)} 
                                                />
                                            ))}
                                        </View>
                                    </View>
                                )) : <Text style={styles.emptyText}>No data found.</Text>}
                            </ScrollView>
                        )}
                    </View>
                </ScrollView>
            </View>

            {!isOverallView && user?.role === 'teacher' && hasChanges && (
                <View style={styles.floatingSaveContainer}>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                    </TouchableOpacity>
                </View>
            )}

            <Modal visible={showCompareModal} animationType="slide" onRequestClose={() => setShowCompareModal(false)}>
                <SafeAreaView style={{flex:1, backgroundColor:'#FFF'}}>
                    <View style={styles.modalHeader}><TouchableOpacity onPress={() => setShowCompareModal(false)}><MaterialIcons name="close" size={26} color="#333" /></TouchableOpacity><Text style={styles.modalTitle}>Comparison</Text><View style={{width:30}}/></View>
                    <View style={styles.modalFilterContainer}>
                        <Text style={styles.modalLabel}>Select Class:</Text><View style={styles.modalPickerWrap}><Picker selectedValue={compareClass} onValueChange={setCompareClass}>{allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}</Picker></View>
                        <Text style={styles.modalLabel}>Select Subject:</Text><View style={styles.modalPickerWrap}><Picker selectedValue={compareSubject} onValueChange={setCompareSubject}>{compareSubjectsList.map(s => <Picker.Item key={s} label={s} value={s} />)}</Picker></View>
                        <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:10}}><Text style={styles.modalLabel}>Sort:</Text>
                            <View style={{flexDirection:'row', backgroundColor:'#F5F5F5', borderRadius:8}}>
                                {['roll', 'high', 'low'].map(s => <TouchableOpacity key={s} style={[styles.sortBtn, compareSort===s && styles.sortBtnActive]} onPress={() => setCompareSort(s as any)}><Text style={[styles.sortBtnText, compareSort===s && styles.sortBtnTextActive]}>{s.toUpperCase()}</Text></TouchableOpacity>)}
                            </View>
                        </View>
                    </View>
                    <View style={styles.graphContainer}>
                        {loadingAnalytics ? <ActivityIndicator size="large" color="#008080" /> : (
                            analyticsData.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 10, alignItems:'flex-end'}}>
                                {analyticsData.map((item, idx) => <AnimatedBar key={idx} percentage={item.percentage} rating={item.avg_rating} label={item.full_name} subLabel={item.roll_no} color={parseFloat(item.percentage)>=85?'#10b981':parseFloat(item.percentage)<50?'#ef4444':'#3b82f6'} />)}
                            </ScrollView> : <Text style={{color:'#999'}}>No data.</Text>
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
            <View style={styles.footerContainer}><Text style={styles.legendText}>G: Good | A: Avg | P: Poor</Text></View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' },
    headerCard: { backgroundColor: '#FFFFFF', padding: 15, width: '96%', alignSelf: 'center', marginTop: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { backgroundColor: '#E0F2F1', borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    headerSubtitle: { fontSize: 13, color: '#666' },
    overallBadge: { backgroundColor: '#FFEDD5', padding: 5, borderRadius: 8 },
    overallBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#F97316' },
    filterContainer: { paddingHorizontal: 20, marginBottom: 5 },
    pickerWrapper: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginBottom: 10, backgroundColor: '#fff', height: 45, justifyContent: 'center' },
    picker: { width: '100%' },
    comButton: { backgroundColor: '#ef4444', height: 45, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', elevation: 2 },
    comBtnText: { color:'#fff', fontWeight:'bold', fontSize: 12 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#e0e7ff', paddingVertical: 12, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
    th: { fontWeight: '700', color: '#4338ca', fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    rowAlt: { backgroundColor: '#f8fafc' },
    td: { fontSize: 13, color: '#374151' },
    remarkBtn: { width: 36, height: 36, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    remarkBtnText: { fontWeight: 'bold', fontSize: 14 },
    floatingSaveContainer: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
    saveBtn: { backgroundColor: '#008080', padding: 10, paddingHorizontal: 30, borderRadius: 25 },
    saveBtnText: { color: '#FFF', fontWeight: 'bold' },
    footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', height: 45, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee' },
    legendText: { fontSize: 11, color: '#666' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    modalFilterContainer: { padding: 15, backgroundColor: '#FAFAFA' },
    modalLabel: { fontSize: 12, fontWeight: 'bold', color: '#666' },
    modalPickerWrap: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, backgroundColor: '#fff', marginTop: 5 },
    sortBtn: { padding: 8, paddingHorizontal: 15, borderRadius: 8 },
    sortBtnActive: { backgroundColor: '#fff', elevation: 1 },
    sortBtnText: { fontSize: 12, color: '#666' },
    sortBtnTextActive: { color: '#008080', fontWeight: 'bold' },
    graphContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { textAlign: 'center', marginTop: 20, color: '#999' },
    barWrapper: { alignItems: 'center', width: 60, marginHorizontal: 8, height: 280, justifyContent: 'flex-end' },
    barLabelTop: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
    barTrack: { width: 30, height: 220, backgroundColor: '#F0F0F0', borderRadius: 15, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%' },
    barLabelBottom: { fontSize: 11, fontWeight: '600', marginTop: 6 }
});

export default StudentFeedback;