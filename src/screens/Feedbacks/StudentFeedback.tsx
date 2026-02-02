import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert, Modal, Animated, Easing
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// --- CONSTANTS ---
const COL_WIDTHS = {
    ROLL: 50,      
    NAME: 150,     
    STATUS: 180,   
    REMARKS: 200   
};
const TABLE_MIN_WIDTH = COL_WIDTHS.ROLL + COL_WIDTHS.NAME + COL_WIDTHS.STATUS + COL_WIDTHS.REMARKS; 

// --- TYPES ---
interface StudentFeedbackRow {
    student_id: number;
    full_name: string;
    roll_no: string;
    status_marks: number | null; 
    remarks_category: 'Good' | 'Average' | 'Poor' | null;
}

interface AnalyticsItem {
    student_id: number;
    full_name: string;
    roll_no: string;
    avg_rating: string;
    percentage: string;
}

interface Teacher {
    id: number;
    full_name: string;
}

// --- ANIMATED BAR COMPONENT ---
const AnimatedBar = ({ percentage, rating, label, subLabel, color }: any) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedHeight, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
            easing: Easing.out(Easing.poly(4)),
        }).start();
    }, [percentage]);

    const heightStyle = animatedHeight.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', `${percentage}%`]
    });

    return (
        <View style={styles.barWrapper}>
            <Text style={styles.barLabelTop}>{Math.round(percentage)}%</Text>
            <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} />
            </View>
            <Text style={styles.barLabelBottom} numberOfLines={1}>
                {label.split(' ')[0]}
            </Text>
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
    
    // --- Filters State (Main Screen) ---
    const [allClasses, setAllClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);

    // Data
    const [students, setStudents] = useState<StudentFeedbackRow[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    // Helper: Check if looking at overall view
    const isOverallView = selectedSubject === 'All Subjects';

    // --- Compare Modal State ---
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareClass, setCompareClass] = useState('');
    const [compareSubject, setCompareSubject] = useState('All Subjects');
    const [compareSubjectsList, setCompareSubjectsList] = useState<string[]>([]);
    const [compareSort, setCompareSort] = useState<'roll' | 'high' | 'low'>('roll');
    const [analyticsData, setAnalyticsData] = useState<AnalyticsItem[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);


    // --- 1. Initial Setup ---
    useEffect(() => {
        if (!user) return;
        fetchClasses(); 
    }, [user]);

    // --- 2. API Calls for Filters ---
    const fetchClasses = async () => {
        try {
            let classesData = [];
            if (user?.role === 'admin') {
                const response = await apiClient.get('/feedback/classes');
                classesData = response.data;
            } else if (user?.role === 'teacher') {
                const response = await apiClient.get(`/teacher-classes/${user.id}`);
                classesData = response.data;
            }
            setAllClasses(classesData);
            if (classesData.length > 0) {
                const defaultClass = classesData.includes("Class 10") ? "Class 10" : classesData[0];
                setSelectedClass(defaultClass);
                setCompareClass(defaultClass); // Set default for compare too
            }
        } catch (error) { console.error('Error fetching classes', error); }
    };

    // Fetch Subjects when Class changes (Main Screen)
    useEffect(() => {
        if (!selectedClass) {
            setAvailableSubjects([]);
            setSelectedSubject('');
            return;
        }
        const fetchSubjects = async () => {
            try {
                const params: any = { class_group: selectedClass };
                if (user?.role === 'teacher') params.teacher_id = user.id;

                const response = await apiClient.get('/feedback/subjects', { params });
                
                let subjectsList = response.data;
                if (user?.role === 'admin') {
                    subjectsList = ['All Subjects', ...subjectsList];
                }

                setAvailableSubjects(subjectsList);
                if (subjectsList.length > 0) setSelectedSubject(subjectsList[0]);
                else setSelectedSubject('');

            } catch (error) { console.error('Error fetching subjects', error); }
        };
        fetchSubjects();
    }, [selectedClass, user]);

    // Fetch Teachers when Subject changes (Main Screen)
    useEffect(() => {
        if (!selectedClass || !selectedSubject || isOverallView) {
            setAvailableTeachers([]);
            if (user?.role === 'admin') setSelectedTeacherId(null);
            return;
        }
        
        if (user?.role === 'teacher') {
            setSelectedTeacherId(user.id);
        } else if (user?.role === 'admin') {
            const fetchTeachersForSubject = async () => {
                try {
                    const response = await apiClient.get('/feedback/teachers', {
                        params: { class_group: selectedClass, subject: selectedSubject }
                    });
                    setAvailableTeachers(response.data);
                    if (response.data.length > 0) setSelectedTeacherId(response.data[0].id);
                    else setSelectedTeacherId(null);
                } catch (error) { console.error('Error fetching teachers', error); }
            };
            fetchTeachersForSubject();
        }
    }, [selectedClass, selectedSubject, user]);

    // --- 3. Fetch Student Data (List View) ---
    const fetchStudentData = useCallback(async () => {
        if (!selectedClass || (!isOverallView && !selectedTeacherId)) {
            setStudents([]);
            return;
        }
        setLoading(true);
        try {
            const params: any = { class_group: selectedClass };
            if (isOverallView) {
                params.mode = 'overall';
            } else {
                params.teacher_id = selectedTeacherId;
            }

            const response = await apiClient.get('/feedback/students', { params });
            const formattedData = response.data.map((s: any) => ({
                ...s,
                status_marks: s.status_marks || 0, 
                remarks_category: s.remarks_category || null
            }));
            setStudents(formattedData);
            setHasChanges(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [selectedClass, selectedTeacherId, isOverallView]);

    useEffect(() => {
        if ((isOverallView && selectedClass) || (selectedClass && selectedSubject && selectedTeacherId)) {
            fetchStudentData();
        }
    }, [selectedClass, selectedSubject, selectedTeacherId, isOverallView, fetchStudentData]);


    // --- 4. Save Logic ---
    const handleSave = async () => {
        if (isOverallView) return; 
        if (!selectedTeacherId || !selectedClass) return;
        
        setLoading(true);
        try {
            const payload = {
                teacher_id: selectedTeacherId,
                class_group: selectedClass,
                feedback_data: students.map(s => ({
                    student_id: s.student_id,
                    status_marks: s.status_marks === 0 ? null : s.status_marks, 
                    remarks_category: s.remarks_category
                }))
            };
            await apiClient.post('/feedback', payload);
            Alert.alert("Success", "Student behavior updated!");
            setHasChanges(false);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save feedback.");
        } finally {
            setLoading(false);
        }
    };

    const updateStudentFeedback = (id: number, field: keyof StudentFeedbackRow, value: any) => {
        if (user?.role === 'admin') return; 
        if (isOverallView) return; 
        
        setStudents(prev => prev.map(s => {
            if (s.student_id === id) return { ...s, [field]: value };
            return s;
        }));
        setHasChanges(true);
    };

    // ==========================================
    // COMPARE MODAL LOGIC
    // ==========================================
    
    // 1. Fetch Subjects for Compare Class
    useEffect(() => {
        if (showCompareModal && compareClass) {
            const loadCompareSubjects = async () => {
                try {
                    const response = await apiClient.get('/feedback/subjects', { 
                        params: { class_group: compareClass } 
                    });
                    setCompareSubjectsList(['All Subjects', ...response.data]);
                    // Only reset subject if it's not in the new list (or defaulting logic)
                    // For now, let's keep 'All Subjects' as default when switching class
                    setCompareSubject('All Subjects'); 
                } catch (e) { console.error(e); }
            };
            loadCompareSubjects();
        }
    }, [showCompareModal, compareClass]);

    // 2. Fetch Analytics Data
    useEffect(() => {
        if (showCompareModal && compareClass) {
            fetchAnalytics();
        }
    }, [showCompareModal, compareClass, compareSubject, compareSort]);

    const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const params = {
                class_group: compareClass,
                subject: compareSubject, 
                mode: 'analytics'
            };
            const res = await apiClient.get('/feedback/students', { params });
            let data = res.data;

            // Sorting
            data.sort((a: AnalyticsItem, b: AnalyticsItem) => {
                if (compareSort === 'roll') {
                    return parseInt(a.roll_no || '0') - parseInt(b.roll_no || '0');
                } else if (compareSort === 'high') {
                    return parseFloat(b.avg_rating) - parseFloat(a.avg_rating);
                } else {
                    return parseFloat(a.avg_rating) - parseFloat(b.avg_rating);
                }
            });

            setAnalyticsData(data);
        } catch (e) { console.error(e); } 
        finally { setLoadingAnalytics(false); }
    };


    // --- Sub-Components ---
    const RemarkButton = ({ label, targetValue, currentValue, color, onPress, disabled }: any) => {
        const isSelected = currentValue === targetValue;
        const opacity = isOverallView && !isSelected ? 0.3 : 1;
        
        return (
            <TouchableOpacity 
                style={[
                    styles.remarkBtn, 
                    { opacity },
                    isSelected ? { backgroundColor: color, borderColor: color } : { borderColor: '#E0E0E0', backgroundColor: '#FFF' }
                ]}
                onPress={onPress} disabled={disabled}
            >
                <Text style={[styles.remarkBtnText, isSelected ? { color: '#FFF' } : { color: '#9e9e9e' }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* HEADER */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                         <MaterialIcons name="fact-check" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Behaviour</Text>
                        <Text style={styles.headerSubtitle}>Student Tracking</Text>
                    </View>
                </View>
                {isOverallView && (
                    <View style={styles.overallBadge}>
                        <Text style={styles.overallBadgeText}>Overall View</Text>
                    </View>
                )}
            </View>

            {/* FILTERS */}
            <View style={styles.filterContainer}>
                
                {/* CLASS PICKER + COMPARE BUTTON ROW */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <View style={[styles.pickerWrapper, { flex: 1, marginBottom: 0 }]}>
                        <Picker
                            selectedValue={selectedClass}
                            onValueChange={setSelectedClass}
                            style={styles.picker}
                            dropdownIconColor="#008080"
                        >
                            <Picker.Item label="Select Class" value="" color="#94a3b8" />
                            {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>
                    
                    {/* COM BUTTON */}
                    <TouchableOpacity 
                        style={styles.comButton}
                        onPress={() => {
                            if(selectedClass) setCompareClass(selectedClass);
                            setShowCompareModal(true);
                        }}
                    >
                        <Text style={styles.comBtnText}>COM</Text>
                        <MaterialIcons name="bar-chart" size={18} color="#fff" style={{marginLeft: 4}} />
                    </TouchableOpacity>
                </View>

                {selectedClass !== '' && (
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={selectedSubject}
                            onValueChange={setSelectedSubject}
                            enabled={availableSubjects.length > 0}
                            style={styles.picker}
                            dropdownIconColor="#008080"
                        >
                            <Picker.Item label="Select Subject" value="" color="#94a3b8" />
                            {availableSubjects.map(s => <Picker.Item key={s} label={s} value={s} />)}
                        </Picker>
                    </View>
                )}

                {user?.role === 'admin' && selectedSubject !== '' && !isOverallView && (
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={selectedTeacherId?.toString()}
                            onValueChange={(val) => val && setSelectedTeacherId(parseInt(val))}
                            enabled={availableTeachers.length > 0}
                            style={styles.picker}
                            dropdownIconColor="#008080"
                        >
                            <Picker.Item label="Select Teacher" value="" color="#94a3b8" />
                            {availableTeachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />)}
                        </Picker>
                    </View>
                )}
            </View>

            {/* TABLE */}
            <View style={{flex: 1}}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}
                >
                    <View style={{ minWidth: TABLE_MIN_WIDTH }}>
                        
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: COL_WIDTHS.ROLL, textAlign: 'center' }]}>Roll</Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.NAME }]}>Student Name</Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.STATUS, textAlign: 'center' }]}>
                                {isOverallView ? 'Avg Rating' : 'Rating'}
                            </Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.REMARKS, textAlign: 'center' }]}>
                                {isOverallView ? 'Overall Remarks' : 'Remarks'}
                            </Text>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color="#008080" style={{ marginTop: 40 }} />
                        ) : (
                            <ScrollView contentContainerStyle={{ paddingBottom: 130 }}> 
                                {students.length > 0 ? (
                                    students.map((item, index) => (
                                        <View key={item.student_id} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                                            <Text style={[styles.td, { width: COL_WIDTHS.ROLL, textAlign: 'center', fontWeight: '700', color: '#111' }]}>
                                                {item.roll_no ? item.roll_no.toString().padStart(2, '0') : '-'}
                                            </Text>
                                            <Text style={[styles.td, { width: COL_WIDTHS.NAME, color: '#444' }]} numberOfLines={1}>
                                                {item.full_name}
                                            </Text>
                                            
                                            <View style={{ width: COL_WIDTHS.STATUS, flexDirection: 'row', justifyContent: 'center', gap: 2 }}>
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <TouchableOpacity 
                                                        key={star}
                                                        onPress={() => !isOverallView && !user?.role?.includes('admin') && updateStudentFeedback(item.student_id, 'status_marks', star)}
                                                        disabled={user?.role === 'admin' || isOverallView}
                                                        style={{ padding: 2 }}
                                                    >
                                                        <MaterialIcons 
                                                            name={item.status_marks && item.status_marks >= star ? "star" : "star-border"} 
                                                            size={28} 
                                                            color={item.status_marks && item.status_marks >= star ? "#FFC107" : "#CFD8DC"} 
                                                        />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            <View style={{ width: COL_WIDTHS.REMARKS, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                                                <RemarkButton 
                                                    label="G" targetValue="Good" currentValue={item.remarks_category} color="#10b981" 
                                                    disabled={user?.role === 'admin' || isOverallView} 
                                                    onPress={() => updateStudentFeedback(item.student_id, 'remarks_category', 'Good')} 
                                                />
                                                <RemarkButton 
                                                    label="A" targetValue="Average" currentValue={item.remarks_category} color="#3b82f6" 
                                                    disabled={user?.role === 'admin' || isOverallView} 
                                                    onPress={() => updateStudentFeedback(item.student_id, 'remarks_category', 'Average')} 
                                                />
                                                <RemarkButton 
                                                    label="P" targetValue="Poor" currentValue={item.remarks_category} color="#ef4444" 
                                                    disabled={user?.role === 'admin' || isOverallView} 
                                                    onPress={() => updateStudentFeedback(item.student_id, 'remarks_category', 'Poor')} 
                                                />
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <MaterialIcons name="person-off" size={40} color="#CFD8DC" />
                                        <Text style={styles.emptyText}>
                                            {!selectedClass ? "Select a class." : "No data found."}
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* SAVE BUTTON */}
            {!isOverallView && user?.role === 'teacher' && hasChanges && (
                <View style={styles.floatingSaveContainer}>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                    </TouchableOpacity>
                </View>
            )}

            {/* COMPARE MODAL */}
            <Modal visible={showCompareModal} animationType="slide" onRequestClose={() => setShowCompareModal(false)}>
                <SafeAreaView style={{flex:1, backgroundColor:'#FFF'}}>
                    {/* Modal Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowCompareModal(false)} style={{padding:5}}>
                            <MaterialIcons name="close" size={26} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Student Comparison</Text>
                        <View style={{width:30}}/>
                    </View>

                    {/* Modal Filters */}
                    <View style={styles.modalFilterContainer}>
                        {/* Class Filter */}
                        <View style={{marginBottom: 10}}>
                            <Text style={styles.modalLabel}>Select Class:</Text>
                            <View style={styles.modalPickerWrap}>
                                <Picker selectedValue={compareClass} onValueChange={setCompareClass} style={{width:'100%'}}>
                                    {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                </Picker>
                            </View>
                        </View>
                        {/* Subject Filter */}
                        <View style={{marginBottom: 10}}>
                            <Text style={styles.modalLabel}>Select Subject:</Text>
                            <View style={styles.modalPickerWrap}>
                                <Picker selectedValue={compareSubject} onValueChange={setCompareSubject} style={{width:'100%'}}>
                                    {compareSubjectsList.map(s => <Picker.Item key={s} label={s} value={s} />)}
                                </Picker>
                            </View>
                        </View>
                        {/* Sort Filter */}
                        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                            <Text style={styles.modalLabel}>Sort Order:</Text>
                            <View style={{flexDirection:'row', backgroundColor:'#F5F5F5', borderRadius:8}}>
                                <TouchableOpacity style={[styles.sortBtn, compareSort==='roll' && styles.sortBtnActive]} onPress={() => setCompareSort('roll')}>
                                    <Text style={[styles.sortBtnText, compareSort==='roll' && styles.sortBtnTextActive]}>Roll No</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sortBtn, compareSort==='high' && styles.sortBtnActive]} onPress={() => setCompareSort('high')}>
                                    <Text style={[styles.sortBtnText, compareSort==='high' && styles.sortBtnTextActive]}>High to Low</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sortBtn, compareSort==='low' && styles.sortBtnActive]} onPress={() => setCompareSort('low')}>
                                    <Text style={[styles.sortBtnText, compareSort==='low' && styles.sortBtnTextActive]}>Low to High</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Graph */}
                    <View style={styles.graphContainer}>
                        {loadingAnalytics ? <ActivityIndicator size="large" color="#008080" /> : (
                            analyticsData.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 10, alignItems:'flex-end'}}>
                                    {analyticsData.map((item, idx) => {
                                        let color = '#3b82f6';
                                        const p = parseFloat(item.percentage);
                                        if(p >= 85) color = '#10b981'; else if(p < 50) color = '#ef4444';
                                        return (
                                            <AnimatedBar 
                                                key={idx} percentage={item.percentage} rating={item.avg_rating} 
                                                label={item.full_name} subLabel={`Roll: ${item.roll_no}`} color={color} 
                                            />
                                        );
                                    })}
                                </ScrollView>
                            ) : <Text style={{color:'#999', marginTop: 50}}>No data available.</Text>
                        )}
                    </View>

                    {/* Modal Footer */}
                    <View style={styles.modalFooter}>
                         <View style={{flexDirection:'row', alignItems:'center', gap:5}}><View style={{width:10, height:10, borderRadius:5, backgroundColor:'#10b981'}}/><Text style={{fontSize:12, color:'#555'}}>85-100%</Text></View>
                         <View style={{flexDirection:'row', alignItems:'center', gap:5}}><View style={{width:10, height:10, borderRadius:5, backgroundColor:'#3b82f6'}}/><Text style={{fontSize:12, color:'#555'}}>50-85%</Text></View>
                         <View style={{flexDirection:'row', alignItems:'center', gap:5}}><View style={{width:10, height:10, borderRadius:5, backgroundColor:'#ef4444'}}/><Text style={{fontSize:12, color:'#555'}}>0-50%</Text></View>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* FOOTER LEGEND (MAIN) */}
            <View style={styles.footerContainer}>
                <View style={styles.legendGroup}>
                    <Text style={styles.legendLabel}>Scale: </Text>
                    <MaterialIcons name="star" size={14} color="#FFC107" />
                    <Text style={styles.legendText}> (1-5)</Text>
                </View>
                <View style={styles.verticalDivider} />
                <View style={styles.legendGroup}>
                    <Text style={styles.legendLabel}>Note: </Text>
                    <Text style={[styles.legendText, { color: '#10b981', fontWeight:'bold' }]}>G</Text><Text style={styles.legendText}>=Good, </Text>
                    <Text style={[styles.legendText, { color: '#3b82f6', fontWeight:'bold' }]}>A</Text><Text style={styles.legendText}>=Avg, </Text>
                    <Text style={[styles.legendText, { color: '#ef4444', fontWeight:'bold' }]}>P</Text><Text style={styles.legendText}>=Poor</Text>
                </View>
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' }, 
    headerCard: {
        backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 12, width: '96%', 
        alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { backgroundColor: '#E0F2F1', borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333333' },
    headerSubtitle: { fontSize: 13, color: '#666666' },
    overallBadge: { backgroundColor: '#FFEDD5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#FED7AA' },
    overallBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#F97316' },

    filterContainer: { paddingHorizontal: 20, marginBottom: 5 },
    pickerWrapper: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginBottom: 10, backgroundColor: '#fff', overflow: 'hidden', height: 45, justifyContent: 'center' },
    picker: { width: '100%', color: '#1f2937' },
    
    // COM Button
    comButton: { backgroundColor: '#ef4444', height: 45, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', elevation: 2 },
    comBtnText: { color:'#fff', fontWeight:'bold', fontSize: 12 },

    tableHeader: { flexDirection: 'row', backgroundColor: '#e0e7ff', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#c7d2fe', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
    th: { fontWeight: '700', color: '#4338ca', fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#FFF', minHeight: 65 },
    rowAlt: { backgroundColor: '#f8fafc' },
    td: { fontSize: 13, color: '#374151' },
    
    remarkBtn: { width: 36, height: 36, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    remarkBtnText: { fontWeight: 'bold', fontSize: 14 },
    floatingSaveContainer: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center', paddingBottom: 10, zIndex: 10 },
    saveBtn: { backgroundColor: '#008080', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 25, elevation: 5 },
    saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.5 },
    footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', height: 45, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, elevation: 10 },
    legendGroup: { flexDirection: 'row', alignItems: 'center' },
    legendLabel: { fontSize: 12, fontWeight: '700', color: '#333', marginRight: 4 },
    legendText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
    verticalDivider: { height: 16, width: 1, backgroundColor: '#e5e7eb', marginHorizontal: 12 },
    emptyContainer: { alignItems: 'center', marginTop: 50, width: '100%' },
    emptyText: { textAlign: 'center', marginTop: 10, color: '#94a3b8', fontSize: 14 },

    // Modal Styles
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#fff', elevation: 2 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    modalFilterContainer: { padding: 15, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#eee' },
    modalLabel: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 5 },
    modalPickerWrap: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, backgroundColor: '#fff', height: 45, justifyContent: 'center' },
    
    sortBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
    sortBtnActive: { backgroundColor: '#fff', elevation: 1 },
    sortBtnText: { fontSize: 12, color: '#666' },
    sortBtnTextActive: { color: '#008080', fontWeight: 'bold' },

    graphContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
    modalFooter: { flexDirection: 'row', justifyContent: 'space-evenly', padding: 15, borderTopWidth: 1, borderTopColor: '#eee' },

    // Animated Bar
    barWrapper: { alignItems: 'center', width: 60, marginHorizontal: 8, height: 280, justifyContent: 'flex-end' },
    barLabelTop: { fontSize: 10, fontWeight: 'bold', color: '#333', marginBottom: 4 },
    barTrack: { width: 30, height: 220, backgroundColor: '#F0F0F0', borderRadius: 0, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%', borderRadius: 0 },
    barLabelBottom: { fontSize: 11, fontWeight: '600', color: '#333', marginTop: 6, textAlign:'center', width: '100%' },
});

export default StudentFeedback;