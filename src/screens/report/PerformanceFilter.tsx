/**
 * File: src/screens/report/PerformanceFilter.tsx
 * Purpose: Filter students by Class & Exam, then categorize into strict performance buckets.
 * Updated: Removed "Pre-Final" from the exam options.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, ScrollView, RefreshControl, Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// --- CONSTANTS ---
const COLORS = {
    primary: '#00897B',    // Teal
    background: '#F5F7FA', // Light Grey-Blue
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    success: '#43A047',    // Green (> 90%)
    average: '#1E88E5',    // Blue (60% - 90%)
    poor: '#E53935',       // Red (< 60%)
    border: '#CFD8DC',
};

// Classes where AT/UT max marks are 20 (otherwise 25)
const SENIOR_CLASSES = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const CLASS_SUBJECTS: any = {
    'LKG': ['All Subjects'], 'UKG': ['All Subjects'], 
    'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 
    'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 
    'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 6': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 
    'Class 7': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 8': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 
    'Class 9': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 10': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social']
};

// Removed 'Pre-Final' from this list
const EXAM_TYPES_DISPLAY = [
    'Overall', 
    'AT1', 'UT1', 
    'AT2', 'UT2', 
    'SA1', 
    'AT3', 'UT3', 
    'AT4', 'UT4', 
    'SA2'
];

const EXAM_NAME_TO_CODE: any = {
    'Assignment-1': 'AT1', 'Unitest-1': 'UT1', 
    'Assignment-2': 'AT2', 'Unitest-2': 'UT2',
    'Assignment-3': 'AT3', 'Unitest-3': 'UT3', 
    'Assignment-4': 'AT4', 'Unitest-4': 'UT4',
    'SA1': 'SA1', 'SA2': 'SA2', 
    'AT1': 'AT1', 'UT1': 'UT1', 'AT2': 'AT2', 'UT2': 'UT2',
    'AT3': 'AT3', 'UT3': 'UT3', 'AT4': 'AT4', 'UT4': 'UT4'
};

const PerformanceFilter = () => {
    // --- State ---
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // Data State
    const [classList, setClassList] = useState<string[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [marksData, setMarksData] = useState<any[]>([]);

    // Filters
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState('Overall');
    const [activeTab, setActiveTab] = useState<'Toppers' | 'Average' | 'Least'>('Toppers');

    // --- 1. Fetch Classes ---
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await apiClient.get('/reports/classes');
                const classes = response.data || [];
                setClassList(classes);
                if (classes.length > 0) setSelectedClass(classes[0]); 
            } catch (error) {
                console.error('Error fetching classes:', error);
            }
        };
        fetchClasses();
    }, []);

    // --- 2. Fetch Data ---
    useEffect(() => {
        if (selectedClass) {
            fetchClassData(selectedClass);
        }
    }, [selectedClass]);

    const fetchClassData = async (classGroup: string) => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/reports/class-data/${classGroup}`);
            setStudents(response.data.students || []);
            setMarksData(response.data.marks || []);
        } catch (error) {
            console.error('Error fetching class data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        if (selectedClass) fetchClassData(selectedClass);
    };

    // --- 3. Calculation Logic ---
    const processedList = useMemo(() => {
        if (!selectedClass || students.length === 0) return [];

        const subjects = CLASS_SUBJECTS[selectedClass] || [];
        const subjectCount = subjects.length;
        const isSeniorClass = SENIOR_CLASSES.includes(selectedClass);

        const marksMap: any = {};
        marksData.forEach(mark => {
            if (!marksMap[mark.student_id]) marksMap[mark.student_id] = {};
            const code = EXAM_NAME_TO_CODE[mark.exam_type];
            if (code) {
                if (!marksMap[mark.student_id][code]) marksMap[mark.student_id][code] = {};
                marksMap[mark.student_id][code][mark.subject] = mark.marks_obtained;
            }
        });

        let calculatedStudents = students.map(student => {
            let obtained = 0;
            let max = 0;

            const calculateExamScore = (examCode: string) => {
                let examObtained = 0;
                let hasData = false;
                
                subjects.forEach((subject: string) => {
                    const val = marksMap[student.id]?.[examCode]?.[subject];
                    if (val !== undefined && val !== null && val !== '' && !isNaN(parseFloat(val))) {
                        examObtained += parseFloat(val);
                        hasData = true;
                    }
                });

                if (hasData) {
                    let maxPerSubject = 0;
                    if (['SA1', 'SA2'].includes(examCode)) {
                        maxPerSubject = 100;
                    } else {
                        maxPerSubject = isSeniorClass ? 20 : 25;
                    }
                    obtained += examObtained;
                    max += (maxPerSubject * subjectCount);
                }
            };

            if (selectedExam === 'Overall') {
                EXAM_TYPES_DISPLAY.forEach(exam => {
                    if (exam !== 'Overall') calculateExamScore(exam);
                });
            } else {
                calculateExamScore(selectedExam);
            }

            const percentage = max > 0 ? (obtained / max) * 100 : 0;

            return { ...student, obtained, max, percentage };
        });

        calculatedStudents = calculatedStudents.filter(s => s.max > 0);
        calculatedStudents.sort((a, b) => b.percentage - a.percentage); // Sort High to Low
        calculatedStudents = calculatedStudents.map((s, index) => ({ ...s, rank: index + 1 }));

        return calculatedStudents;
    }, [selectedClass, selectedExam, students, marksData]);

    // --- 4. Filtering Logic (STRICT) ---
    const filteredList = useMemo(() => {
        if (processedList.length === 0) return [];

        const list = [...processedList];

        if (activeTab === 'Toppers') {
            // ★ STRICT: Only Students >= 90%
            return list.filter(s => s.percentage >= 90);
        } 
        else if (activeTab === 'Average') {
            // ★ STRICT: Students >= 60% AND < 90%
            return list.filter(s => s.percentage >= 60 && s.percentage < 90);
        } 
        else if (activeTab === 'Least') {
            // ★ STRICT: Students < 60%
            const bottomList = list.filter(s => s.percentage < 60);
            // Sort Ascending (Lowest percentage first for emphasis)
            return bottomList.sort((a, b) => a.percentage - b.percentage);
        }

        return [];
    }, [activeTab, processedList]);

    const getStatusColor = (perc: number) => {
        if (perc >= 90) return COLORS.success;
        if (perc >= 60) return COLORS.average;
        return COLORS.poor;
    };

    const renderStudentItem = ({ item }: any) => {
        const color = getStatusColor(item.percentage);
        
        return (
            <View style={styles.card}>
                <View style={[styles.rankStrip, { backgroundColor: color }]}>
                    <Text style={styles.rankText}>#{item.rank}</Text>
                </View>
                <View style={styles.cardContent}>
                    <View style={styles.row}>
                        <View style={styles.infoCol}>
                            <Text style={styles.name}>{item.full_name}</Text>
                            <Text style={styles.roll}>Roll No: {item.roll_no}</Text>
                        </View>
                        <View style={styles.scoreCol}>
                            <Text style={[styles.percentage, { color: color }]}>
                                {item.percentage.toFixed(1)}%
                            </Text>
                            <Text style={styles.marks}>
                                {Math.round(item.obtained)} / {Math.round(item.max)}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${item.percentage}%`, backgroundColor: color }]} />
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* --- HEADER --- */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Performance Analytics</Text>

                <View style={styles.pickerWrapper}>
                    <Text style={styles.filterLabel}>Class:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={selectedClass}
                            onValueChange={setSelectedClass}
                            style={styles.picker}
                            dropdownIconColor={COLORS.textSub}
                        >
                            {classList.map(c => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>
                </View>

                <View style={styles.examFilterContainer}>
                    <Text style={styles.filterLabel}>Exam:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.examScroll}>
                        {EXAM_TYPES_DISPLAY.map((exam) => {
                            const isActive = selectedExam === exam;
                            return (
                                <TouchableOpacity 
                                    key={exam} 
                                    style={[styles.examPill, isActive && styles.examPillActive]}
                                    onPress={() => setSelectedExam(exam)}
                                >
                                    <Text style={[styles.examPillText, isActive && styles.examPillTextActive]}>{exam}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                <View style={styles.tabContainer}>
                    {['Toppers', 'Average', 'Least'].map((tab) => {
                        const isActive = activeTab === tab;
                        return (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                                onPress={() => setActiveTab(tab as any)}
                            >
                                <Icon 
                                    name={tab === 'Toppers' ? 'trophy' : tab === 'Average' ? 'scale-balance' : 'arrow-down-bold-box'} 
                                    size={18} 
                                    color={isActive ? '#FFF' : COLORS.textSub} 
                                    style={{marginRight: 6}}
                                />
                                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* --- LIST CONTENT --- */}
            <View style={styles.contentArea}>
                {loading ? (
                    <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
                ) : (
                    <>
                        <View style={styles.listHeader}>
                            <Text style={styles.listHeaderTitle}>
                                {activeTab === 'Toppers' ? 'Toppers (> 90%)' : 
                                 activeTab === 'Least' ? 'Need Attention (< 60%)' : 
                                 'Average Performers (60% - 90%)'}
                            </Text>
                            <Text style={styles.listHeaderSub}>
                                Based on {selectedExam}
                            </Text>
                        </View>

                        <FlatList
                            data={filteredList}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderStudentItem}
                            contentContainerStyle={styles.listContent}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Icon name="clipboard-text-off-outline" size={48} color="#CFD8DC" />
                                    <Text style={styles.emptyText}>No students found in this range.</Text>
                                    <Text style={styles.emptySubText}>
                                        {activeTab === 'Toppers' ? "No one scored above 90%." : 
                                         activeTab === 'Average' ? "No one scored between 60% and 90%." : 
                                         "No one scored below 60%."}
                                    </Text>
                                </View>
                            }
                        />
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    
    header: { backgroundColor: '#FFF', padding: 15, paddingBottom: 0, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 4, zIndex: 10 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.primary, marginBottom: 15 },
    
    pickerWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    filterLabel: { width: 50, fontSize: 14, fontWeight: '700', color: COLORS.textSub },
    pickerContainer: { flex: 1, backgroundColor: '#F0F2F5', borderRadius: 8, height: 45, justifyContent: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
    picker: { width: '100%', color: COLORS.textMain },

    examFilterContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    examScroll: { paddingRight: 20 },
    examPill: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#F0F2F5', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#E0E0E0' },
    examPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    examPillText: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
    examPillTextActive: { color: '#FFF' },

    tabContainer: { flexDirection: 'row', backgroundColor: '#F5F7FA', borderRadius: 12, padding: 4, marginBottom: 15 },
    tabButton: { flex: 1, flexDirection: 'row', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    tabButtonActive: { backgroundColor: COLORS.primary, elevation: 2 },
    tabText: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
    tabTextActive: { color: '#FFF' },

    contentArea: { flex: 1, paddingHorizontal: 15 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 15, marginBottom: 10 },
    listHeaderTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
    listHeaderSub: { fontSize: 12, color: COLORS.textSub },
    listContent: { paddingBottom: 30 },

    card: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 2 },
    rankStrip: { width: 35, justifyContent: 'center', alignItems: 'center' },
    rankText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    cardContent: { flex: 1, padding: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    infoCol: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
    roll: { fontSize: 12, color: COLORS.textSub },
    scoreCol: { alignItems: 'flex-end' },
    percentage: { fontSize: 16, fontWeight: 'bold' },
    marks: { fontSize: 11, color: COLORS.textSub },
    barTrack: { height: 6, backgroundColor: '#ECEFF1', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
    emptyText: { marginTop: 10, color: COLORS.textSub, fontSize: 14, fontWeight: 'bold' },
    emptySubText: { marginTop: 5, color: COLORS.textSub, fontSize: 12, fontStyle: 'italic' }
});

export default PerformanceFilter;