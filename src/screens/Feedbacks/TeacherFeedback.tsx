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
    avg_rating: number;
    percentage: number;
    total_reviews: number;
}

const TeacherFeedback = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // --- STUDENT STATE ---
    const [myTeachers, setMyTeachers] = useState<TeacherRow[]>([]);
    
    // --- ADMIN STATE (Main Screen) ---
    const [allClasses, setAllClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('All Classes');
    const [classTeachers, setClassTeachers] = useState<{id: number | string, full_name: string}[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all'); 
    
    // Data Holders (Main Screen)
    const [adminReviews, setAdminReviews] = useState<AdminReviewRow[]>([]); // List View
    const [matrixData, setMatrixData] = useState<{teachers: any[], students: MatrixStudent[]} | null>(null); // Matrix View
    const [stats, setStats] = useState({ average: '0.0', total: 0 });

    // --- COMPARE PAGE STATE (Modal) ---
    const [showComparePage, setShowComparePage] = useState(false);
    const [compareClass, setCompareClass] = useState('All Classes'); // Default in Compare Page
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // desc = High to Low
    const [analyticsData, setAnalyticsData] = useState<AnalyticsItem[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

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
    // ADMIN LOGIC (MAIN SCREEN)
    // ==========================================
    const fetchClasses = async () => {
        try {
            const res = await apiClient.get('/feedback/classes');
            setAllClasses(['All Classes', ...res.data]);
        } catch (e) { console.error(e); }
    };

    // 1. Fetch Teachers for Dropdown (Main Screen)
    useEffect(() => {
        if (user?.role === 'admin') {
            const loadTeachers = async () => {
                try {
                    let tList = [];
                    if (selectedClass && selectedClass !== 'All Classes') {
                        const res = await apiClient.get(`/timetable/${selectedClass}`);
                        const uniqueTeachers = new Map();
                        res.data.forEach((slot: any) => {
                            if(slot.teacher_id) uniqueTeachers.set(slot.teacher_id, slot.teacher_name);
                        });
                        tList = Array.from(uniqueTeachers, ([id, full_name]) => ({ id, full_name }));
                    } 
                    tList = [{ id: 'all', full_name: 'All Teachers' }, ...tList];
                    setClassTeachers(tList);
                    setSelectedTeacherId('all'); 
                } catch(e) { console.error(e); }
            };
            loadTeachers();
        }
    }, [selectedClass, user]);

    // 2. Fetch Data for Matrix/List (Main Screen)
    useEffect(() => {
        if (user?.role === 'admin' && !showComparePage) {
            const loadReviews = async () => {
                setLoading(true);
                try {
                    const params: any = {};
                    if (selectedClass === 'All Classes') params.class_group = 'all';
                    else params.class_group = selectedClass;

                    if (selectedTeacherId === 'all') {
                         params.mode = 'matrix'; // Default to Matrix for main screen "All"
                    } else {
                        params.teacher_id = selectedTeacherId;
                        params.mode = 'list';
                    }

                    const res = await apiClient.get('/admin/teacher-feedback', { params });
                    
                    if (res.data.mode === 'matrix') {
                        setMatrixData({ teachers: res.data.teachers, students: res.data.students });
                        setAdminReviews([]); 
                    } else {
                        setAdminReviews(res.data.reviews);
                        setStats({ average: res.data.average, total: res.data.total });
                        setMatrixData(null); 
                    }
                } catch (e) { console.error(e); }
                finally { setLoading(false); }
            };
            loadReviews();
        }
    }, [selectedTeacherId, selectedClass, user, showComparePage]);


    // ==========================================
    // COMPARE PAGE LOGIC
    // ==========================================
    useEffect(() => {
        if (showComparePage) {
            fetchAnalytics();
        }
    }, [showComparePage, compareClass, sortOrder]);

    const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const params: any = { mode: 'analytics' };
            
            // Filter by class or All
            if (compareClass === 'All Classes') params.class_group = 'all';
            else params.class_group = compareClass;

            const res = await apiClient.get('/admin/teacher-feedback', { params });
            
            let data = res.data.data || [];
            
            // Sort
            data.sort((a: AnalyticsItem, b: AnalyticsItem) => {
                return sortOrder === 'desc' 
                    ? b.avg_rating - a.avg_rating 
                    : a.avg_rating - b.avg_rating;
            });
            
            setAnalyticsData(data);

        } catch (error) {
            console.error("Analytics Error", error);
        } finally {
            setLoadingAnalytics(false);
        }
    };


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

            {/* ======================= ADMIN VIEW (MAIN) ======================= */}
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
                                onPress={() => setShowComparePage(true)}
                            >
                                <Text style={styles.compareBtnText}>COM</Text>
                                <MaterialIcons name="bar-chart" size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Teacher Picker */}
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
                            {/* LIST VIEW (Single Teacher) */}
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

                            {/* MATRIX VIEW (All Teachers) */}
                            {selectedTeacherId === 'all' && matrixData && (
                                <ScrollView horizontal contentContainerStyle={{flexGrow: 1}}>
                                    <View>
                                        {/* Matrix Header */}
                                        <View style={[styles.matrixHeaderRow, { minWidth: FIXED_COLS_WIDTH + (matrixData.teachers.length * TEACHER_COL_WIDTH) }]}>
                                            <View style={{width: ROLL_COL_WIDTH, justifyContent:'center', alignItems:'center'}}><Text style={styles.th}>Roll</Text></View>
                                            <View style={{width: NAME_COL_WIDTH, justifyContent:'center'}}><Text style={styles.th}>Student Name</Text></View>
                                            {matrixData.teachers.map((t) => (
                                                <View key={t.id} style={{width: TEACHER_COL_WIDTH, justifyContent:'center', alignItems:'center', paddingHorizontal: 2}}>
                                                    <Text style={[styles.th, { textAlign: 'center' }]} numberOfLines={2}>
                                                        {t.full_name.split(' ')[0]}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>

                                        {/* Matrix Rows */}
                                        <ScrollView contentContainerStyle={{paddingBottom: 60}}>
                                            {matrixData.students.map((stu) => (
                                                <View key={stu.id} style={[styles.matrixRow, { minWidth: FIXED_COLS_WIDTH + (matrixData.teachers.length * TEACHER_COL_WIDTH) }]}>
                                                    <View style={{width: ROLL_COL_WIDTH, justifyContent:'center', alignItems:'center'}}><Text style={styles.rollNo}>{stu.roll_no || '-'}</Text></View>
                                                    <View style={{width: NAME_COL_WIDTH}}><Text style={styles.studentName} numberOfLines={1}>{stu.full_name}</Text></View>
                                                    
                                                    {matrixData.teachers.map((t) => {
                                                        const fb = stu.feedback_map[t.id];
                                                        return (
                                                            <View key={t.id} style={styles.matrixCell}>
                                                                {fb ? (
                                                                    <>
                                                                       <StarRating rating={fb.rating} readOnly size={12} /> 
                                                                       <Text style={[styles.miniBadge, {
                                                                           backgroundColor: fb.remarks === 'Good' ? '#10b981' : fb.remarks === 'Poor' ? '#ef4444' : '#3b82f6'
                                                                       }]}>
                                                                           {fb.remarks ? fb.remarks.charAt(0) : '-'}
                                                                       </Text>
                                                                    </>
                                                                ) : (
                                                                    <Text style={{color:'#ccc'}}>-</Text>
                                                                )}
                                                            </View>
                                                        )
                                                    })}
                                                </View>
                                            ))}
                                        </ScrollView>
                                    </View>
                                </ScrollView>
                            )}
                        </>
                    )}
                </View>
            )}

            {/* ========================================================== */}
            {/* COMPARE PAGE (New Screen via Modal) */}
            {/* ========================================================== */}
            <Modal
                visible={showComparePage}
                animationType="slide"
                onRequestClose={() => setShowComparePage(false)}
            >
                <SafeAreaView style={styles.pageContainer}>
                    
                    {/* Page Header */}
                    <View style={styles.pageHeader}>
                        <TouchableOpacity onPress={() => setShowComparePage(false)} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.pageTitle}>Performance Analytics</Text>
                        <View style={{width:24}} /> 
                    </View>

                    {/* Compare Filters */}
                    <View style={styles.compareFilterContainer}>
                        
                        {/* Class Filter */}
                        <View style={{ marginBottom: 15 }}>
                            <Text style={styles.filterLabel}>Select Class:</Text>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={compareClass}
                                    onValueChange={(val) => setCompareClass(val)}
                                    style={styles.picker}
                                >
                                    {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                </Picker>
                            </View>
                        </View>

                        {/* Sort Filter */}
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Text style={styles.filterLabel}>Sort Order:</Text>
                            <View style={styles.sortToggleContainer}>
                                <TouchableOpacity 
                                    style={[styles.sortBtn, sortOrder === 'desc' && styles.sortBtnActive]}
                                    onPress={() => setSortOrder('desc')}
                                >
                                    <Text style={[styles.sortBtnText, sortOrder === 'desc' && styles.sortBtnTextActive]}>High to Low</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.sortBtn, sortOrder === 'asc' && styles.sortBtnActive]}
                                    onPress={() => setSortOrder('asc')}
                                >
                                    <Text style={[styles.sortBtnText, sortOrder === 'asc' && styles.sortBtnTextActive]}>Low to High</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Bar Graph Content */}
                    {loadingAnalytics ? <ActivityIndicator size="large" color="#008080" style={{marginTop: 50}} /> : (
                        <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 15 }}>
                            
                            {analyticsData.length > 0 ? (
                                <View style={styles.graphContainer}>
                                    {analyticsData.map((item) => {
                                        // Color Logic
                                        let barColor = '#3b82f6'; // Average (Blue)
                                        if (item.percentage >= 85) barColor = '#10b981'; // Good (Green)
                                        else if (item.percentage < 50) barColor = '#ef4444'; // Poor (Red)

                                        return (
                                            <View key={item.teacher_id} style={styles.barWrapper}>
                                                {/* Percentage Top */}
                                                <Text style={styles.barLabelTop}>{Math.round(item.percentage)}%</Text>
                                                
                                                {/* Vertical Bar */}
                                                <View style={styles.barTrack}>
                                                    <View style={[
                                                        styles.barFill, 
                                                        { 
                                                            height: `${item.percentage}%`, 
                                                            backgroundColor: barColor 
                                                        }
                                                    ]} />
                                                </View>
                                                
                                                {/* Footer Info */}
                                                <Text style={styles.barLabelBottom} numberOfLines={1}>
                                                    {item.teacher_name.split(' ')[0]}
                                                </Text>
                                                <View style={{flexDirection:'row', alignItems:'center', marginTop: 2}}>
                                                    <Text style={{fontSize: 10, fontWeight:'bold'}}>{item.avg_rating}</Text>
                                                    <MaterialIcons name="star" size={10} color="#FFC107" />
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>No rating data available for {compareClass}.</Text>
                            )}

                            {/* Detailed List Below Graph */}
                            {analyticsData.length > 0 && (
                                <View style={{marginTop: 30, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10}}>
                                    <Text style={{fontWeight:'bold', marginBottom: 10, color:'#555'}}>Detailed Stats:</Text>
                                    {analyticsData.map((item, index) => (
                                        <View key={index} style={styles.detailRow}>
                                            <Text style={styles.detailName}>{index+1}. {item.teacher_name}</Text>
                                            <View style={{flexDirection:'row', gap: 10}}>
                                                <Text style={{color:'#666', fontSize:12}}>{item.total_reviews} Reviews</Text>
                                                <Text style={{fontWeight:'bold', color:'#333'}}>{item.avg_rating} ★</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                        </ScrollView>
                    )}

                    {/* Footer Legend in Compare Page */}
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
            </Modal>


            {/* --- MAIN FOOTER LEGEND --- */}
            {!showComparePage && (
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
            )}

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' },
    pageContainer: { flex: 1, backgroundColor: '#fff' },

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

    // Compare Page Header
    pageHeader: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff'
    },
    backButton: { padding: 5 },
    pageTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },

    // Compare Page Filters
    compareFilterContainer: { padding: 15, backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: '#eee' },
    filterLabel: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 5 },
    
    sortToggleContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, pading: 2 },
    sortBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    sortBtnActive: { backgroundColor: '#fff', elevation: 1 },
    sortBtnText: { fontSize: 12, color: '#666' },
    sortBtnTextActive: { color: '#008080', fontWeight: 'bold' },

    // Graph Styles
    graphContainer: { 
        flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', 
        alignItems: 'flex-end', marginTop: 20, gap: 10 
    },
    barWrapper: { alignItems: 'center', width: 60, marginBottom: 15 },
    barTrack: { width: 30, height: 180, backgroundColor: '#f1f5f9', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    barLabelTop: { fontSize: 11, fontWeight: 'bold', marginBottom: 4, color: '#333' },
    barLabelBottom: { fontSize: 11, fontWeight: '600', marginTop: 6, color: '#444' },

    // Detail List Styles
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    detailName: { color: '#333', fontSize: 14 },

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
    
    compareBtn: {
        backgroundColor: '#ef4444', marginLeft: 8, borderRadius: 8, height: 45,
        paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 5,
        elevation: 2
    },
    compareBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

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

    // Matrix View
    matrixHeaderRow: { flexDirection: 'row', backgroundColor: '#e0e7ff', paddingVertical: 12, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#ccc' },
    matrixRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
    matrixCell: { width: TEACHER_COL_WIDTH, alignItems: 'center', justifyContent: 'center' },
    miniBadge: { marginTop: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', color: '#fff', fontSize: 10, fontWeight: 'bold' },

    emptyText: { textAlign: 'center', marginTop: 30, color: '#999' },

    // Footer
    footerContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', 
        borderTopWidth: 1, borderTopColor: '#f0f0f0', height: 45, 
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
        paddingHorizontal: 15, elevation: 10, gap: 10
    },
    legendGroup: { flexDirection: 'row', alignItems: 'center' },
    legendLabel: { fontSize: 12, fontWeight: '700', color: '#333', marginRight: 4 },
    legendText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
    verticalDivider: { height: 16, width: 1, backgroundColor: '#e5e7eb', marginHorizontal: 12 },
    
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
});

export default TeacherFeedback;