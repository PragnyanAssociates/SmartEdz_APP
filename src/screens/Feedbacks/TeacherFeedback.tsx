import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert, Modal, Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// --- CONSTANTS ---
const SCREEN_WIDTH = Dimensions.get('window').width;
const TEACHER_COL_WIDTH = 130; 
const NAME_COL_WIDTH = 150;
const ROLL_COL_WIDTH = 50;
const FIXED_COLS_WIDTH = NAME_COL_WIDTH + ROLL_COL_WIDTH;

// --- Types ---
interface TeacherRow {
    teacher_id: number;
    teacher_name: string;
    rating: number; // 1-5
    remarks: 'Good' | 'Average' | 'Poor' | '';
    isSubmitted?: boolean; 
}

interface AdminReviewRow {
    student_name: string;
    roll_no: string;
    rating: number;
    remarks: string;
}

interface MatrixStudent {
    id: number;
    full_name: string;
    roll_no: string;
    feedback_map: {
        [teacherId: number]: { rating: number, remarks: string }
    };
}

interface AnalyticsItem {
    teacher_id: number;
    teacher_name: string;
    avg_rating: number; // 1.0 to 5.0
    percentage: number; // 0 to 100
    total_reviews: number;
}

const TeacherFeedback = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // --- STUDENT STATE ---
    const [myTeachers, setMyTeachers] = useState<TeacherRow[]>([]);
    
    // --- ADMIN STATE ---
    const [allClasses, setAllClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('All Classes'); // Default
    const [classTeachers, setClassTeachers] = useState<{id: number | string, full_name: string}[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all'); 
    
    // Sorting & Comparison
    const [showSortModal, setShowSortModal] = useState(false);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // desc = High to Low

    // Admin Data Holders
    const [adminReviews, setAdminReviews] = useState<AdminReviewRow[]>([]); // List View
    const [matrixData, setMatrixData] = useState<{teachers: any[], students: MatrixStudent[]} | null>(null); // Matrix View
    const [analyticsData, setAnalyticsData] = useState<AnalyticsItem[]>([]); // Bar Graph View
    const [stats, setStats] = useState({ average: '0.0', total: 0 });

    // --- INITIAL LOAD ---
    useEffect(() => {
        if (!user) return;
        if (user.role === 'student') {
            fetchStudentView();
        } else if (user.role === 'admin') {
            fetchClasses();
        }
    }, [user]);

    // ==========================================
    // STUDENT LOGIC
    // ==========================================
    const fetchStudentView = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/student/assigned-teachers', {
                params: { student_id: user?.id, class_group: user?.class_group }
            });
            const formatted = response.data.map((t: any) => ({
                ...t,
                rating: t.rating || 0,
                remarks: t.remarks || '',
                isSubmitted: (t.rating > 0 || t.remarks)
            }));
            setMyTeachers(formatted);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load teachers.');
        } finally {
            setLoading(false);
        }
    };

    const updateMyFeedback = (teacherId: number, field: keyof TeacherRow, value: any) => {
        setMyTeachers(prev => prev.map(t => {
            if (t.teacher_id === teacherId) return { ...t, [field]: value };
            return t;
        }));
    };

    const handleStudentSave = async (teacher: TeacherRow) => {
        if (teacher.rating === 0) {
            Alert.alert("Rating Required", "Please give at least 1 star.");
            return;
        }
        if (!teacher.remarks) {
            Alert.alert("Remarks Required", "Please select Good, Average, or Poor.");
            return;
        }

        try {
            await apiClient.post('/teacher-feedback', {
                student_id: user?.id,
                class_group: user?.class_group,
                teacher_id: teacher.teacher_id,
                rating: teacher.rating,
                remarks: teacher.remarks
            });
            
            setMyTeachers(prev => prev.map(t => {
                if (t.teacher_id === teacher.teacher_id) {
                    return { ...t, isSubmitted: true };
                }
                return t;
            }));

            Alert.alert("Success", `Feedback for ${teacher.teacher_name} saved!`);
        } catch (error) {
            Alert.alert("Error", "Could not save feedback.");
        }
    };

    // ==========================================
    // ADMIN LOGIC
    // ==========================================
    const fetchClasses = async () => {
        try {
            const res = await apiClient.get('/feedback/classes');
            // Prepend "All Classes"
            setAllClasses(['All Classes', ...res.data]);
        } catch (e) { console.error(e); }
    };

    // When Class Changes -> Fetch Teachers
    useEffect(() => {
        if (user?.role === 'admin') {
            const loadTeachers = async () => {
                try {
                    let tList = [];
                    // If specific class, fetch assigned teachers
                    if (selectedClass && selectedClass !== 'All Classes') {
                        const res = await apiClient.get(`/timetable/${selectedClass}`);
                        const uniqueTeachers = new Map();
                        res.data.forEach((slot: any) => {
                            if(slot.teacher_id) uniqueTeachers.set(slot.teacher_id, slot.teacher_name);
                        });
                        tList = Array.from(uniqueTeachers, ([id, full_name]) => ({ id, full_name }));
                    } else {
                        // All Classes - You might want to fetch a list of ALL teachers here if needed
                        // For now, we will handle aggregation in 'All Teachers' mode
                        tList = []; 
                    }
                    
                    // ADD "ALL TEACHERS" OPTION
                    tList = [{ id: 'all', full_name: 'All Teachers' }, ...tList];
                    
                    setClassTeachers(tList);
                    setSelectedTeacherId('all'); // Reset to all
                } catch(e) { console.error(e); }
            };
            loadTeachers();
        }
    }, [selectedClass, user]);

    // When Teacher/Class/Sort Changes -> Fetch Data 
    useEffect(() => {
        if (user?.role === 'admin') {
            const loadReviews = async () => {
                setLoading(true);
                try {
                    const params: any = {};
                    
                    // Handle Class param
                    if (selectedClass === 'All Classes') params.class_group = 'all';
                    else params.class_group = selectedClass;

                    // Handle Teacher Param & Mode
                    if (selectedTeacherId === 'all') {
                        // New Logic: If 'all' teachers selected, show Analytics (Bar Graphs)
                        params.mode = 'analytics';
                    } else {
                        params.teacher_id = selectedTeacherId;
                        params.mode = 'list';
                    }

                    const res = await apiClient.get('/admin/teacher-feedback', { params });
                    
                    if (res.data.mode === 'analytics') {
                        // GRAPH DATA
                        let data = res.data.data;
                        // Sort Data
                        data.sort((a: AnalyticsItem, b: AnalyticsItem) => {
                            return sortOrder === 'desc' 
                                ? b.avg_rating - a.avg_rating 
                                : a.avg_rating - b.avg_rating;
                        });
                        setAnalyticsData(data);
                        setAdminReviews([]);
                        setMatrixData(null);
                    } 
                    else if (res.data.mode === 'matrix') {
                        // MATRIX VIEW (Legacy fallback if needed, but we prioritize graphs now)
                        setMatrixData({ teachers: res.data.teachers, students: res.data.students });
                        setAdminReviews([]); 
                        setAnalyticsData([]);
                    } 
                    else {
                        // LIST VIEW (Specific Teacher)
                        setAdminReviews(res.data.reviews);
                        setStats({ average: res.data.average, total: res.data.total });
                        setMatrixData(null); 
                        setAnalyticsData([]);
                    }
                } catch (e) { console.error(e); }
                finally { setLoading(false); }
            };
            loadReviews();
        }
    }, [selectedTeacherId, selectedClass, sortOrder, user]);


    // ==========================================
    // HELPER COMPONENTS
    // ==========================================
    const StarRating = ({ rating, setRating, readOnly = false, size=24 }: any) => {
        return (
            <View style={{ flexDirection: 'row' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        disabled={readOnly}
                        onPress={() => setRating && setRating(star)}
                    >
                        <MaterialIcons
                            name={star <= rating ? "star" : "star-border"}
                            size={size}
                            color={star <= rating ? "#FFC107" : "#E0E0E0"}
                            style={{ marginHorizontal: 1 }}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const RemarksButtons = ({ selected, onSelect, readOnly=false }: any) => {
        const options = ['Good', 'Average', 'Poor'];
        const colors: any = { 'Good': '#10b981', 'Average': '#3b82f6', 'Poor': '#ef4444' };
        const shortLabels: any = { 'Good': 'G', 'Average': 'A', 'Poor': 'P' };

        return (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {options.map(opt => (
                    <TouchableOpacity
                        key={opt}
                        disabled={readOnly}
                        onPress={() => onSelect(opt)}
                        style={[
                            styles.remarkBtn,
                            selected === opt 
                                ? { backgroundColor: colors[opt], borderColor: colors[opt] }
                                : { borderColor: '#ccc', backgroundColor: '#fff' }
                        ]}
                    >
                        <Text style={[
                            styles.remarkBtnText,
                            selected === opt ? { color: '#fff' } : { color: '#999' }
                        ]}>
                            {readOnly ? shortLabels[opt] : opt}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}>
                     <MaterialIcons name="rate-review" size={24} color="#008080" />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Teacher Feedback</Text>
                    <Text style={styles.headerSubtitle}>
                        {user?.role === 'student' ? 'Rate your teachers' : 'View Ratings & Analytics'}
                    </Text>
                </View>
            </View>

            {/* ======================= STUDENT VIEW ======================= */}
            {user?.role === 'student' && (
                <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}>
                    {loading ? <ActivityIndicator color="#008080" style={{marginTop:20}} /> : (
                        myTeachers.length > 0 ? myTeachers.map((item, index) => (
                            <View key={item.teacher_id} style={styles.cardRow}>
                                <View style={styles.rowHeader}>
                                    <Text style={styles.serialNo}>{index + 1}.</Text>
                                    <Text style={styles.teacherName}>{item.teacher_name}</Text>
                                    <TouchableOpacity 
                                        style={[styles.iconSaveBtn, item.isSubmitted && styles.iconEditBtn]} 
                                        onPress={() => handleStudentSave(item)}
                                    >
                                        <MaterialIcons name={item.isSubmitted ? "check" : "save"} size={20} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.inputArea}>
                                    <Text style={styles.label}>Rate:</Text>
                                    <StarRating 
                                        rating={item.rating} 
                                        setRating={(r: number) => updateMyFeedback(item.teacher_id, 'rating', r)} 
                                        size={30}
                                    />
                                </View>
                                <View style={styles.inputArea}>
                                    <Text style={styles.label}>Remarks:</Text>
                                    <RemarksButtons 
                                        selected={item.remarks} 
                                        onSelect={(val: string) => updateMyFeedback(item.teacher_id, 'remarks', val)}
                                    />
                                </View>
                            </View>
                        )) : (
                            <Text style={styles.emptyText}>No assigned teachers found.</Text>
                        )
                    )}
                </ScrollView>
            )}

            {/* ======================= ADMIN VIEW ======================= */}
            {user?.role === 'admin' && (
                <View style={{flex: 1}}>
                    {/* Filters */}
                    <View style={styles.filterContainer}>
                        {/* Class Picker + Compare Button */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <View style={[styles.pickerWrapper, { flex: 1, marginBottom: 0 }]}>
                                <Picker
                                    selectedValue={selectedClass}
                                    onValueChange={setSelectedClass}
                                    style={styles.picker}
                                >
                                    {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                </Picker>
                            </View>

                            {/* COMPARE BUTTON */}
                            <TouchableOpacity 
                                style={styles.compareBtn}
                                onPress={() => setShowSortModal(true)}
                            >
                                <Text style={styles.compareBtnText}>COM</Text>
                                <MaterialIcons name="sort" size={16} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Teacher Picker (Only if specific class selected, or always allow drilldown) */}
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={selectedTeacherId}
                                onValueChange={(v) => setSelectedTeacherId(v)}
                                style={styles.picker}
                            >
                                {classTeachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />)}
                            </Picker>
                        </View>
                    </View>

                    {loading ? <ActivityIndicator color="#008080" style={{marginTop:20}} /> : (
                        <>
                            {/* CASE 1: ANALYTICS / BAR GRAPHS (All Teachers) */}
                            {selectedTeacherId === 'all' && analyticsData.length > 0 && (
                                <ScrollView contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: 15 }}>
                                    <Text style={styles.sectionTitle}>
                                        Overall Performance ({sortOrder === 'desc' ? 'High to Low' : 'Low to High'})
                                    </Text>
                                    
                                    <View style={styles.chartContainer}>
                                        {analyticsData.map((item, index) => {
                                            // Determine Color based on Percentage
                                            let barColor = '#3b82f6'; // Blue (Avg)
                                            if (item.percentage >= 85) barColor = '#10b981'; // Green
                                            else if (item.percentage < 50) barColor = '#ef4444'; // Red

                                            return (
                                                <View key={item.teacher_id} style={styles.barColumn}>
                                                    {/* Percentage Label */}
                                                    <Text style={styles.barLabelTop}>{Math.round(item.percentage)}%</Text>
                                                    
                                                    {/* Bar */}
                                                    <View style={styles.barBackground}>
                                                        <View style={[styles.barFill, { height: `${item.percentage}%`, backgroundColor: barColor }]}>
                                                            {/* Rating Inside Bar */}
                                                            {item.percentage > 20 && (
                                                                <Text style={styles.barTextInside}>
                                                                    {item.avg_rating}
                                                                </Text>
                                                            )}
                                                        </View>
                                                    </View>
                                                    
                                                    {/* Teacher Name / ID */}
                                                    <Text style={styles.barLabelBottom} numberOfLines={1}>
                                                        {item.teacher_name.split(' ')[0]}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>

                                    {/* Stats List below graph */}
                                    <View style={{marginTop: 20}}>
                                        {analyticsData.map((item, idx) => (
                                            <View key={idx} style={styles.statRow}>
                                                <Text style={styles.statRowName}>{idx + 1}. {item.teacher_name}</Text>
                                                <View style={{flexDirection:'row', alignItems:'center'}}>
                                                    <Text style={{fontWeight:'bold', marginRight: 5}}>{item.avg_rating}</Text>
                                                    <MaterialIcons name="star" size={14} color="#FFC107" />
                                                    <Text style={{fontSize: 12, color: '#999', marginLeft: 5}}>({item.total_reviews} reviews)</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            )}

                            {/* CASE 2: SPECIFIC TEACHER (List View) */}
                            {selectedTeacherId !== 'all' && selectedTeacherId !== '' && (
                                <>
                                    <View style={styles.statsContainer}>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statLabel}>Avg Rating</Text>
                                            <View style={{flexDirection:'row', alignItems:'center'}}>
                                                <Text style={styles.statValue}>{stats.average}</Text>
                                                <MaterialIcons name="star" size={18} color="#FFC107" />
                                            </View>
                                        </View>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statLabel}>Total Reviews</Text>
                                            <Text style={styles.statValue}>{stats.total}</Text>
                                        </View>
                                    </View>

                                    <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
                                        <View style={styles.tableHeader}>
                                            <Text style={[styles.th, { width: 50 }]}>Roll</Text>
                                            <Text style={[styles.th, { flex: 1 }]}>Student</Text>
                                            <Text style={[styles.th, { width: 100 }]}>Feedback</Text>
                                        </View>
                                        {adminReviews.map((review, idx) => (
                                            <View key={idx} style={styles.adminRow}>
                                                <Text style={styles.rollNo}>{review.roll_no || '-'}</Text>
                                                <Text style={styles.studentName} numberOfLines={1}>{review.student_name}</Text>
                                                <View style={{alignItems:'flex-end'}}>
                                                    <StarRating rating={review.rating} readOnly size={18} />
                                                    <Text style={[styles.adminRemarks, { color: review.remarks === 'Good' ? '#10b981' : review.remarks === 'Poor' ? '#ef4444' : '#3b82f6' }]}>
                                                        {review.remarks}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </ScrollView>
                                </>
                            )}
                        </>
                    )}
                </View>
            )}

            {/* --- SORT SELECTION MODAL --- */}
            <Modal
                visible={showSortModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowSortModal(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowSortModal(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Sort Rating</Text>
                        <TouchableOpacity 
                            style={styles.modalOption} 
                            onPress={() => { setSortOrder('desc'); setShowSortModal(false); }}
                        >
                            <Text style={[styles.modalOptionText, sortOrder === 'desc' && styles.selectedOption]}>High to Low</Text>
                            {sortOrder === 'desc' && <MaterialIcons name="check" size={20} color="#008080" />}
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={styles.modalOption} 
                            onPress={() => { setSortOrder('asc'); setShowSortModal(false); }}
                        >
                            <Text style={[styles.modalOptionText, sortOrder === 'asc' && styles.selectedOption]}>Low to High</Text>
                            {sortOrder === 'asc' && <MaterialIcons name="check" size={20} color="#008080" />}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* --- FOOTER LEGEND --- */}
            <View style={styles.footerContainer}>
                <View style={styles.legendGroup}>
                    <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
                    <Text style={styles.legendText}> 85-100%</Text>
                </View>
                <View style={styles.legendGroup}>
                    <View style={[styles.dot, { backgroundColor: '#3b82f6' }]} />
                    <Text style={styles.legendText}> 50-85%</Text>
                </View>
                <View style={styles.legendGroup}>
                    <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
                    <Text style={styles.legendText}> 0-50%</Text>
                </View>
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' },

    // Header
    headerCard: {
        backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 12,
        width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center',
        elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', borderRadius: 30, width: 45, height: 45,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    headerSubtitle: { fontSize: 13, color: '#666' },

    // --- Student View Styles ---
    cardRow: {
        backgroundColor: '#FFF', marginHorizontal: 10, marginBottom: 10, borderRadius: 12,
        padding: 15, elevation: 1, borderLeftWidth: 5, borderLeftColor: '#008080'
    },
    rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
    serialNo: { width: 30, fontWeight: 'bold', color: '#555', fontSize: 16 },
    teacherName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#333' },
    iconSaveBtn: { backgroundColor: '#008080', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    iconEditBtn: { backgroundColor: '#10b981' },
    inputArea: { marginBottom: 10 },
    label: { fontSize: 12, color: '#666', marginBottom: 5, fontWeight: '600' },
    remarkBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, minWidth: 70, alignItems: 'center' },
    remarkBtnText: { fontSize: 12, fontWeight: '600' },

    // --- Admin View Styles ---
    filterContainer: { paddingHorizontal: 10, marginBottom: 5 },
    pickerWrapper: {
        borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginBottom: 8,
        backgroundColor: '#fff', overflow: 'hidden', height: 45, justifyContent: 'center'
    },
    picker: { width: '100%', color: '#333' },
    
    // Compare Button
    compareBtn: {
        backgroundColor: '#ef4444', marginLeft: 8, borderRadius: 8, height: 45,
        paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 5,
        elevation: 2
    },
    compareBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    // Chart Styles
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 15 },
    chartContainer: { 
        flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', 
        height: 200, marginTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#ccc' 
    },
    barColumn: { alignItems: 'center', width: 50 },
    barBackground: { width: 30, height: 160, backgroundColor: '#f0f0f0', borderRadius: 15, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%', borderTopLeftRadius: 15, borderTopRightRadius: 15, justifyContent: 'center', alignItems: 'center' },
    barLabelTop: { fontSize: 10, color: '#333', fontWeight: 'bold', marginBottom: 2 },
    barLabelBottom: { fontSize: 11, color: '#333', marginTop: 5, fontWeight: '600' },
    barTextInside: { color: '#fff', fontSize: 10, fontWeight: 'bold', transform: [{ rotate: '-90deg' }], width: 40, textAlign: 'center' },
    
    statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
    statRowName: { fontSize: 14, color: '#333', flex: 1 },

    // List View
    statsContainer: { flexDirection: 'row', marginHorizontal: 10, marginBottom: 10 },
    statBox: { flex: 1, backgroundColor: '#FFF', marginHorizontal: 5, padding: 10, borderRadius: 8, alignItems: 'center', elevation: 1 },
    statLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase' },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 2 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#e0e7ff', padding: 10, marginHorizontal: 10, borderRadius: 8, marginBottom: 5 },
    th: { fontWeight: 'bold', color: '#4338ca', fontSize: 13 },
    adminRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 10, marginBottom: 8, borderRadius: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    rollNo: { width: 50, fontWeight: 'bold', color: '#333' },
    studentName: { flex: 1, color: '#444' },
    adminRemarks: { fontSize: 12, fontWeight: '600', marginTop: 2 },

    emptyText: { textAlign: 'center', marginTop: 30, color: '#999' },

    // Footer
    footerContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', 
        borderTopWidth: 1, borderTopColor: '#f0f0f0', height: 45, 
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
        paddingHorizontal: 15, elevation: 10, gap: 15
    },
    legendGroup: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
    legendText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', width: '70%', borderRadius: 12, padding: 20, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    modalOptionText: { fontSize: 16, color: '#555' },
    selectedOption: { color: '#008080', fontWeight: 'bold' }
});

export default TeacherFeedback;