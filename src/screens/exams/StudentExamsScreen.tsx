import React, { useState, useEffect, useCallback }  from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView, TextInput, Modal, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    success: '#43A047',
    danger: '#E53935',
    warning: '#FFC107',
    blue: '#1E88E5'
};

// Custom Radio Button Component
const CustomRadioButton = ({ label, value, selectedValue, onSelect }) => {
    const isSelected = value === selectedValue;
    return (
        <TouchableOpacity style={styles.radioContainer} onPress={() => onSelect(value)} activeOpacity={0.8}>
            <View style={[styles.radioOuterCircle, isSelected && styles.radioOuterCircleSelected]}>
                {isSelected && <View style={styles.radioInnerCircle} />}
            </View>
            <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>{label}</Text>
        </TouchableOpacity>
    );
};

// Main Router Component
const StudentExamsScreen = () => {
    const [view, setView] = useState('list');
    const [selectedExam, setSelectedExam] = useState(null);
    const [selectedAttemptId, setSelectedAttemptId] = useState(null);

    const handleStartExam = (exam) => { setSelectedExam(exam); setView('taking'); };
    const handleViewResult = (attemptId) => { setSelectedAttemptId(attemptId); setView('result'); };
    const backToList = () => { setSelectedExam(null); setSelectedAttemptId(null); setView('list'); };

    if (view === 'list') {
        return <ExamList onStartExam={handleStartExam} onViewResult={handleViewResult} />;
    }
    if (view === 'taking' && selectedExam) {
        return <TakeExamView exam={selectedExam} onFinish={backToList} />;
    }
    if (view === 'result' && selectedAttemptId) {
        return <ResultView attemptId={selectedAttemptId} onBack={backToList} />;
    }
    return null;
};

// Exam List View
const ExamList = ({ onStartExam, onViewResult }) => {
    const { user } = useAuth();
    const [exams, setExams] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const isFocused = useIsFocused();

    const fetchExams = useCallback(async () => {
        if (!user?.id || !user.class_group) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/exams/student/${user.id}/${user.class_group}`);
            setExams(response.data);
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Failed to fetch exams.'); } 
        finally { setIsLoading(false); }
    }, [user?.id, user?.class_group]);

    useEffect(() => {
        if (isFocused) { fetchExams(); }
    }, [isFocused, fetchExams]);

    const renderButton = (item) => {
        switch (item.status) {
            case 'graded':
                return <TouchableOpacity style={styles.buttonViewResult} onPress={() => onViewResult(item.attempt_id)}><Text style={styles.buttonText}>View Result</Text></TouchableOpacity>;
            case 'submitted':
            case 'in_progress':
                return <View style={styles.buttonAwaiting}><Text style={styles.buttonTextAwaiting}>Results Pending</Text></View>;
            default:
                return <TouchableOpacity style={styles.buttonStart} onPress={() => onStartExam(item)}><MaterialIcons name="play-arrow" size={18} color="#fff" /><Text style={styles.buttonText}>Start Exam</Text></TouchableOpacity>;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="clipboard-text-outline" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Exams</Text>
                        <Text style={styles.headerSubtitle}>My Assessments</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={exams}
                keyExtractor={(item: any) => item.exam_id.toString()}
                renderItem={({ item, index }) => (
                    <Animatable.View animation="fadeInUp" duration={500} delay={index * 100}>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.pill}><Text style={styles.pillText}>Quiz</Text></View>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                            </View>
                            
                            <View style={styles.detailsRow}>
                                <View style={styles.detailItem}><MaterialIcons name="help-outline" size={16} color={COLORS.textSub} /><Text style={styles.detailText}>{item.question_count} Qs</Text></View>
                                <View style={styles.detailItem}><MaterialIcons name="check-circle-outline" size={16} color={COLORS.textSub} /><Text style={styles.detailText}>{item.total_marks} Marks</Text></View>
                                <View style={styles.detailItem}><MaterialIcons name="timer" size={16} color={COLORS.textSub} /><Text style={styles.detailText}>{item.time_limit_mins} Min</Text></View>
                            </View>
                            {renderButton(item)}
                        </View>
                    </Animatable.View>
                )}
                onRefresh={fetchExams}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>No exams available for your class yet.</Text> : null}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            />
        </SafeAreaView>
    );
};

// Take Exam View
const TakeExamView = ({ exam, onFinish }) => {
    const { user } = useAuth();
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attemptId, setAttemptId] = useState(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    useEffect(() => {
        const startAndFetch = async () => {
            if (!user?.id) return;
            try {
                const startRes = await apiClient.post(`/exams/${exam.exam_id}/start`, { student_id: user.id });
                const { attempt_id } = startRes.data;
                setAttemptId(attempt_id);

                if (exam.time_limit_mins > 0) {
                    setTimeLeft(exam.time_limit_mins * 60);
                }

                const qRes = await apiClient.get(`/exams/take/${exam.exam_id}`);
                const data = qRes.data;
                const parsedQuestions = data.map(q => ({
                    ...q,
                    options: (typeof q.options === 'string') ? JSON.parse(q.options) : q.options,
                }));
                setQuestions(parsedQuestions);
            } catch (e: any) {
                Alert.alert('Error', e.response?.data?.message || 'Could not start exam.');
                onFinish();
            } finally {
                setIsLoading(false);
            }
        };
        startAndFetch();
    }, [exam.exam_id, user?.id, onFinish, exam.time_limit_mins]);

    useEffect(() => {
        if (timeLeft === null || isSubmitting) return;

        if (timeLeft <= 0) {
            performSubmit(true);
            return;
        }

        const intervalId = setInterval(() => {
            setTimeLeft(prevTime => (prevTime ? prevTime - 1 : 0));
        }, 1000);

        return () => clearInterval(intervalId);
    }, [timeLeft, isSubmitting]);

    const handleAnswerChange = (questionId, value) => setAnswers(prev => ({ ...prev, [questionId]: value }));

    const performSubmit = async (isAutoSubmit = false) => {
        if (isSubmitting || !user?.id) return;
        
        setIsSubmitting(true);
        try {
            await apiClient.post(`/attempts/${attemptId}/submit`, { answers, student_id: user.id });
            Alert.alert(
                'Success',
                isAutoSubmit
                    ? "Time's up! Your exam has been automatically submitted."
                    : 'Your exam has been submitted!',
                [{ text: 'OK', onPress: onFinish }]
            );
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || e.message);
            setIsSubmitting(false);
        }
    };

    const handleSubmit = () => {
        Alert.alert('Confirm Submission', 'Are you sure you want to submit your exam?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Submit',
                onPress: () => performSubmit(false)
            }
        ]);
    };
    
    const formatTime = (seconds: number) => {
        if (seconds < 0) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary}/></View>;
    
    return (
        <SafeAreaView style={styles.container}>
             {/* --- HEADER CARD --- */}
             <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{exam.title}</Text>
                        <Text style={styles.headerSubtitle}>In Progress</Text>
                    </View>
                </View>
                {timeLeft !== null && (
                    <View style={styles.timerContainer}>
                        <MaterialIcons name="timer" size={18} color="#D32F2F" />
                        <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                    </View>
                )}
            </View>

            <ScrollView contentContainerStyle={{paddingHorizontal: 15, paddingBottom: 40}}>
                {questions.map((q: any, index) => (
                    <View key={q.question_id} style={styles.questionBox}>
                        <View style={styles.questionHeader}>
                            <Text style={styles.questionText}>{index + 1}. {q.question_text}</Text>
                            <Text style={styles.marksText}>{q.marks} Marks</Text>
                        </View>
                        
                        {q.question_type === 'multiple_choice' ? (
                            <View style={styles.optionsContainer}>
                                {q.options && Object.entries(q.options).map(([key, value]) => (
                                    <CustomRadioButton
                                        key={key}
                                        label={value as string}
                                        value={key}
                                        selectedValue={answers[q.question_id]}
                                        onSelect={(newValue) => handleAnswerChange(q.question_id, newValue)}
                                    />
                                ))}
                            </View>
                        ) : (
                            <TextInput 
                                style={styles.textInput} 
                                multiline 
                                placeholder="Type your answer here..." 
                                onChangeText={text => handleAnswerChange(q.question_id, text)} 
                            />
                        )}
                    </View>
                ))}
                
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Exam</Text>}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

// Result View
const ResultView = ({ attemptId, onBack }) => {
    const { user } = useAuth();
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchResult = async () => {
            if (!user?.id) return;
            try {
                const response = await apiClient.get(`/attempts/${attemptId}/result?student_id=${user.id}`);
                const data = response.data;
                 if (data.details) {
                    data.details = data.details.map(item => ({
                        ...item,
                        options: (typeof item.options === 'string') ? JSON.parse(item.options) : item.options,
                    }));
                }
                setResult(data);
            } catch (e: any) {
                Alert.alert('Error', e.response?.data?.message || 'Could not fetch results.');
                onBack();
            } finally {
                setIsLoading(false);
            }
        };
        fetchResult();
    }, [attemptId, user?.id, onBack]);

    if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary}/></View>;
    if (!result) return <View style={styles.centered}><Text>No result data found.</Text></View>;

    const { attempt, exam, details } = result;
    return (
        <SafeAreaView style={styles.container}>
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="star-circle-outline" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Result</Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>{exam.title}</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={{paddingHorizontal: 15, paddingBottom: 40}}>
                <View style={styles.resultSummaryCard}>
                    <Text style={styles.resultScoreLabel}>Total Score</Text>
                    <Text style={styles.resultScore}>{attempt.final_score} <Text style={{fontSize: 18, color: '#546E7A'}}>/ {exam.total_marks}</Text></Text>
                    {attempt.teacher_feedback && <Text style={styles.feedbackText}>"{attempt.teacher_feedback}"</Text>}
                </View>

                {details.map((item, index) => (
                    <View key={item.question_id} style={styles.questionBox}>
                        <Text style={styles.questionText}>{index + 1}. {item.question_text}</Text>
                        <Text style={styles.yourAnswer}>Your Answer: <Text style={{fontWeight: 'normal'}}>{item.answer_text || 'Not Answered'}</Text></Text>
                        {item.question_type === 'multiple_choice' && item.options && <Text style={styles.correctAnswer}>Correct Answer: <Text style={{fontWeight: 'normal'}}>{item.options[item.correct_answer]}</Text></Text>}
                        <View style={styles.marksAwardedBadge}>
                            <Text style={styles.marksAwardedText}>Marks: {item.marks_awarded} / {item.marks}</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
};

// Styles
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: COLORS.cardBg,
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
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
    headerSubtitle: { fontSize: 13, color: COLORS.textSub },

    // Card Styles
    card: { backgroundColor: COLORS.cardBg, borderRadius: 12, marginBottom: 15, padding: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    cardHeader: { marginBottom: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginTop: 4 },
    pill: { backgroundColor: '#e0f2f1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
    pillText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 12 },
    
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8 },
    detailItem: { flexDirection: 'row', alignItems: 'center' },
    detailText: { marginLeft: 5, color: COLORS.textSub, fontSize: 13, fontWeight: '600' },
    
    buttonStart: { flexDirection: 'row', backgroundColor: COLORS.blue, paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    buttonViewResult: { backgroundColor: COLORS.success, paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    buttonAwaiting: { backgroundColor: '#FFF3E0', paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFE0B2' },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 5 },
    buttonTextAwaiting: { color: COLORS.warning, fontWeight: 'bold', fontSize: 16 },

    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: COLORS.textSub },
    
    // Exam Taking Styles
    timerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, borderWidth: 1, borderColor: '#FFCDD2' },
    timerText: { fontSize: 14, fontWeight: 'bold', color: '#D32F2F', marginLeft: 5 },
    
    questionBox: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
    questionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    questionText: { fontSize: 16, fontWeight: '600', color: COLORS.textMain, flex: 1, paddingRight: 10 },
    marksText: { fontSize: 12, color: COLORS.textSub, fontStyle: 'italic' },
    
    optionsContainer: { marginTop: 5 },
    radioContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingVertical: 8 },
    radioOuterCircle: { height: 20, width: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    radioOuterCircleSelected: { borderColor: COLORS.blue },
    radioInnerCircle: { height: 10, width: 10, borderRadius: 5, backgroundColor: COLORS.blue },
    radioLabel: { fontSize: 15, color: COLORS.textMain },
    radioLabelSelected: { fontWeight: 'bold', color: COLORS.blue },
    
    textInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', fontSize: 15, backgroundColor: '#FAFAFA' },
    
    submitButton: { backgroundColor: COLORS.success, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 30, elevation: 3 },
    submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    // Result Styles
    resultSummaryCard: { backgroundColor: '#E3F2FD', padding: 20, marginBottom: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#BBDEFB' },
    resultScoreLabel: { fontSize: 14, color: '#1565C0', fontWeight: '600', marginBottom: 5 },
    resultScore: { fontSize: 32, fontWeight: 'bold', color: '#0D47A1' },
    feedbackText: { fontSize: 15, fontStyle: 'italic', marginTop: 10, color: '#1565C0', textAlign: 'center' },
    
    yourAnswer: { fontSize: 14, color: COLORS.textMain, marginTop: 8, backgroundColor: '#F5F5F5', padding: 8, borderRadius: 6 },
    correctAnswer: { fontSize: 14, color: '#2E7D32', marginTop: 5, backgroundColor: '#E8F5E9', padding: 8, borderRadius: 6 },
    marksAwardedBadge: { alignSelf: 'flex-end', backgroundColor: '#E0F2F1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
    marksAwardedText: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary },
});

export default StudentExamsScreen;