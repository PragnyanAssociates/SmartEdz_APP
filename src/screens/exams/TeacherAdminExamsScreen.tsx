import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView, TextInput, Modal, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    success: '#43A047',
    danger: '#E53935',
    border: '#CFD8DC',
    blue: '#007bff'
};

// --- Main Router Component ---
const TeacherAdminExamsScreen = () => {
    const [view, setView] = useState('list');
    const [selectedExam, setSelectedExam] = useState(null);

    const backToList = () => { setSelectedExam(null); setView('list'); };
    const handleCreateNew = () => { setSelectedExam(null); setView('create'); };
    const handleEdit = (exam) => { setSelectedExam(exam); setView('create'); };
    const handleViewSubmissions = (exam) => { setSelectedExam(exam); setView('submissions'); };

    if (view === 'list') {
        return <ExamList onCreateNew={handleCreateNew} onEdit={handleEdit} onViewSubmissions={handleViewSubmissions} />;
    }
    if (view === 'create') {
        return <CreateOrEditExamView examToEdit={selectedExam} onFinish={backToList} />;
    }
    if (view === 'submissions' && selectedExam) {
        return <SubmissionsView exam={selectedExam} onBack={backToList} />;
    }
    return null;
};

// --- View 1: List of Created Exams ---
const ExamList = ({ onCreateNew, onEdit, onViewSubmissions }) => {
    const { user } = useAuth();
    const [exams, setExams] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const isFocused = useIsFocused();

    const fetchExams = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/exams/teacher/${user.id}`);
            setExams(response.data);
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Failed to fetch exams.'); }
        finally { setIsLoading(false); }
    }, [user?.id]);

    useEffect(() => {
        if (isFocused) { fetchExams(); }
    }, [isFocused, fetchExams]);

    const handleDelete = (exam) => {
        Alert.alert("Confirm Delete", `Are you sure you want to delete "${exam.title}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    setIsLoading(true);
                    try {
                        await apiClient.delete(`/exams/${exam.exam_id}`);
                        setExams(prevExams => prevExams.filter(e => e.exam_id !== exam.exam_id));
                        Alert.alert("Success", "Exam deleted.");
                    } catch (e: any) { Alert.alert("Error", e.response?.data?.message || 'Failed to delete.'); }
                    finally { setIsLoading(false); }
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="assignment" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Exam Manager</Text>
                        <Text style={styles.headerSubtitle}>Create & Manage Exams</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={onCreateNew}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={exams}
                keyExtractor={(item) => item.exam_id.toString()}
                renderItem={({ item, index }) => (
                    <Animatable.View animation="fadeInUp" duration={600} delay={index * 100}>
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                                <View style={styles.actionIconContainer}>
                                    <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconBtn}><MaterialIcons name="edit" size={20} color={COLORS.blue} /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.iconBtn, {backgroundColor: '#fee2e2'}]}><MaterialIcons name="delete" size={20} color={COLORS.danger} /></TouchableOpacity>
                                </View>
                            </View>
                            <Text style={styles.cardSubtitle}>For: {item.class_group}</Text>
                            
                            <View style={styles.footerRow}>
                                <View style={item.submission_count > 0 ? styles.badge : styles.badgeMuted}>
                                    <Text style={styles.badgeText}>{item.submission_count} Submitted</Text>
                                </View>
                                <TouchableOpacity style={styles.viewSubmissionsBtn} onPress={() => onViewSubmissions(item)}>
                                    <Text style={styles.viewSubmissionsBtnText}>View & Grade</Text>
                                    <MaterialIcons name="arrow-forward" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animatable.View>
                )}
                onRefresh={fetchExams}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>You have not created any exams yet.</Text> : null}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            />
        </SafeAreaView>
    );
};

// --- View 2: Create OR Edit Exam ---
const CreateOrEditExamView = ({ examToEdit, onFinish }) => {
    const { user } = useAuth();
    const isEditMode = !!examToEdit;
    const [examDetails, setExamDetails] = useState({ title: '', description: '', class_group: '', time_limit_mins: '0' });
    const [questions, setQuestions] = useState([]);
    const [isLoading, setIsLoading] = useState(isEditMode);
    const [isSaving, setIsSaving] = useState(false);
    const [studentClasses, setStudentClasses] = useState([]);
    
    useEffect(() => {
        const bootstrapData = async () => {
            try {
                const classesRes = await apiClient.get('/student-classes');
                setStudentClasses(classesRes.data);

                if (isEditMode) {
                    const examRes = await apiClient.get(`/exams/${examToEdit.exam_id}`);
                    const data = examRes.data;
                    setExamDetails({ title: data.title, description: data.description || '', class_group: data.class_group, time_limit_mins: String(data.time_limit_mins || '0') });
                    setQuestions(data.questions.map(q => ({ ...q, id: q.question_id, options: (q.options && typeof q.options === 'string') ? JSON.parse(q.options) : (q.options || {A:'', B:'', C:'', D:''}) })));
                }
            } catch (e: any) { 
                Alert.alert("Error", e.response?.data?.message || "Failed to load data.");
                if(isEditMode) onFinish();
            } finally { 
                setIsLoading(false); 
            }
        };
        bootstrapData();
    }, [isEditMode, examToEdit, onFinish]);

    const addQuestion = () => setQuestions([...questions, { id: Date.now(), question_text: '', question_type: 'multiple_choice', options: { A: '', B: '', C: '', D: '' }, correct_answer: '', marks: '1' }]);
    
    const handleQuestionChange = (id, field, value) => {
        setQuestions(questions.map(q => {
            if (q.id !== id) return q;
            let newQ = { ...q, [field]: value };
            if (field === 'question_type') {
                if (value !== 'multiple_choice') {
                    const { options, correct_answer, ...rest } = newQ;
                    return rest;
                } else if (value === 'multiple_choice') {
                    newQ.options = { A: '', B: '', C: '', D: '' };
                    newQ.correct_answer = '';
                }
            }
            return newQ;
        }));
    };

    const handleOptionChange = (id, optionKey, value) => setQuestions(questions.map(q => (q.id === id ? { ...q, options: { ...q.options, [optionKey]: value } } : q)));
    const handleRemoveQuestion = (id) => setQuestions(questions.filter(q => q.id !== id));
    
    const handleSave = async () => {
        if (!user?.id) return Alert.alert("Session Error", "Could not identify user.");
        if (!examDetails.title || !examDetails.class_group || questions.length === 0) return Alert.alert('Validation Error', 'Title, Class Group, and at least one question are required.');
        setIsSaving(true);
        const sanitizedQuestions = questions.map(q => {
            const questionPayload: any = { question_text: q.question_text, question_type: q.question_type, marks: parseInt(q.marks, 10) || 1, };
            if (q.question_type === 'multiple_choice') { questionPayload.options = q.options; questionPayload.correct_answer = q.correct_answer; }
            return questionPayload;
        });
        const payload = { ...examDetails, questions: sanitizedQuestions, teacher_id: user.id };
        try {
            if (isEditMode) { await apiClient.put(`/exams/${examToEdit.exam_id}`, payload); } else { await apiClient.post('/exams', payload); }
            Alert.alert('Success', `Exam ${isEditMode ? 'updated' : 'created'}!`);
            onFinish();
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || "Failed to save exam."); } 
        finally { setIsSaving(false); }
    };

    if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary}/></View>
    
    return ( 
        <SafeAreaView style={styles.container}>
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onFinish} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Exam' : 'Create Exam'}</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 15, paddingBottom: 50}}>
                <View style={styles.formSection}>
                    <Text style={styles.label}>Exam Title *</Text>
                    <TextInput style={styles.input} value={examDetails.title} onChangeText={t => setExamDetails({ ...examDetails, title: t })} />
                    
                    <Text style={styles.label}>Class *</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={examDetails.class_group} onValueChange={v => setExamDetails({ ...examDetails, class_group: v })}>
                            <Picker.Item label="-- Select a Class --" value="" />
                            {studentClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>
                    
                    <Text style={styles.label}>Time Limit (minutes)</Text>
                    <TextInput style={styles.input} keyboardType="number-pad" value={examDetails.time_limit_mins} onChangeText={t => setExamDetails({ ...examDetails, time_limit_mins: t })} />
                </View>

                <Text style={styles.headerTitleSecondary}>Questions</Text>
                
                {questions.map((q: any, index) => (
                    <View key={q.id} style={styles.questionEditor}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.questionEditorTitle}>Question {index + 1}</Text>
                            <TouchableOpacity onPress={() => handleRemoveQuestion(q.id)}>
                                <MaterialIcons name="close" size={22} color="#dc3545" />
                            </TouchableOpacity>
                        </View>
                        
                        <TextInput style={styles.input} multiline placeholder="Enter question text..." value={q.question_text} onChangeText={t => handleQuestionChange(q.id, 'question_text', t)} />
                        
                        <Text style={styles.label}>Type</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={q.question_type} onValueChange={v => handleQuestionChange(q.id, 'question_type', v)}>
                                <Picker.Item label="Multiple Choice" value="multiple_choice" />
                                <Picker.Item label="Written Answer" value="short_answer" />
                            </Picker>
                        </View>
                        
                        {q.question_type === 'multiple_choice' && q.options && (<>
                            {Object.keys(q.options).map(key => (<TextInput key={key} style={styles.input} placeholder={`Option ${key}`} value={q.options[key]} onChangeText={t => handleOptionChange(q.id, key, t)} />))}
                            <Text style={styles.label}>Correct Answer</Text>
                            <View style={styles.pickerContainer}><Picker selectedValue={q.correct_answer} onValueChange={v => handleQuestionChange(q.id, 'correct_answer', v)}><Picker.Item label="-- Select correct option --" value="" />{Object.keys(q.options).map(key => q.options[key] && <Picker.Item key={key} label={`Option ${key}`} value={key} />)}</Picker></View>
                        </>)}

                        <Text style={styles.label}>Marks</Text>
                        <TextInput style={styles.input} keyboardType="number-pad" value={String(q.marks)} onChangeText={t => handleQuestionChange(q.id, 'marks', t)} />
                    </View>
                ))}
                
                <TouchableOpacity style={styles.addQuestionBtn} onPress={addQuestion}>
                    <Text style={styles.addQuestionBtnText}>+ Add Another Question</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{isEditMode ? 'Save Changes' : 'Save and Publish Exam'}</Text>}
                </TouchableOpacity>
            </ScrollView> 
        </SafeAreaView> 
    );
};

// --- View 3: Submissions View ---
const SubmissionsView = ({ exam, onBack }) => {
    const { user } = useAuth();
    const [submissions, setSubmissions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [gradingSubmission, setGradingSubmission] = useState(null);
    const [submissionDetails, setSubmissionDetails] = useState([]);
    const [gradedAnswers, setGradedAnswers] = useState({});
    const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchSubmissions = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/exams/${exam.exam_id}/submissions`);
            setSubmissions(response.data);
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Failed to fetch submissions.'); } 
        finally { setIsLoading(false); }
    }, [exam.exam_id]);

    useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

    const openGradingModal = async (submission) => {
        setIsLoading(true);
        setGradingSubmission(submission);
        try {
            const response = await apiClient.get(`/submissions/${submission.attempt_id}`);
            let details = response.data.map(item => ({...item, options: (item.options && typeof item.options === 'string') ? JSON.parse(item.options) : item.options,}));
            setSubmissionDetails(details);
            const initialGrades = details.reduce((acc, item) => ({ ...acc, [item.question_id]: item.marks_awarded || '' }), {});
            setGradedAnswers(initialGrades);
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Could not fetch submission details.'); setGradingSubmission(null); } 
        finally { setIsLoading(false); }
    };

    const handleGradeChange = (questionId, marks) => setGradedAnswers(prev => ({ ...prev, [questionId]: marks }));
    
    const submitGrade = async () => {
        if (!user?.id) return Alert.alert('Session Error', 'Could not identify the grading teacher.');
        setIsSubmittingGrade(true);
        const answersPayload = Object.entries(gradedAnswers).map(([qid, marks]) => ({ question_id: qid, marks_awarded: marks || 0 }));
        try {
            await apiClient.post(`/submissions/${gradingSubmission.attempt_id}/grade`, { gradedAnswers: answersPayload, teacher_feedback: '', teacher_id: user.id });
            Alert.alert('Success', 'Grades submitted successfully!');
            setGradingSubmission(null);
            fetchSubmissions();
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || "Failed to submit grade."); } 
        finally { setIsSubmittingGrade(false); }
    };

    const filteredSubmissions = submissions.filter(submission => {
        const query = searchQuery.toLowerCase();
        const nameMatch = submission.student_name.toLowerCase().includes(query);
        const rollNoMatch = submission.roll_no && submission.roll_no.toLowerCase().includes(query);
        return nameMatch || rollNoMatch;
    });
    
    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD (Submissions) --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="fact-check" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Submissions</Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>{exam.title}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={22} color={COLORS.textSub} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or roll no..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={COLORS.textSub}
                />
            </View>

            <FlatList
                data={filteredSubmissions}
                keyExtractor={(item) => item.attempt_id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                                {item.roll_no ? `(${item.roll_no}) ` : ''}{item.student_name}
                            </Text>
                            {item.grade && (
                                <View style={styles.gradeBadge}>
                                   <MaterialIcons name="star" size={14} color="#fff"/>
                                   <Text style={styles.gradeBadgeText}>{item.grade}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.cardDetail}>Status: <Text style={{fontWeight: 'bold', color: item.status === 'graded' ? COLORS.success : COLORS.textSub}}>{item.status}</Text></Text>
                        {item.status === 'graded' && <Text style={styles.cardDetail}>Score: {item.final_score} / {exam.total_marks}</Text>}
                        <TouchableOpacity style={styles.gradeButton} onPress={() => openGradingModal(item)}><Text style={styles.gradeButtonText}>{item.status === 'graded' ? 'Update Grade' : 'Grade Now'}</Text></TouchableOpacity>
                    </View>
                )}
                onRefresh={fetchSubmissions}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>No students have submitted this exam yet.</Text> : null}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            />
            
            <Modal visible={!!gradingSubmission} onRequestClose={() => setGradingSubmission(null)} animationType="slide">
                <ScrollView style={styles.modalView}>
                    <Text style={styles.modalTitle}>Grading: {gradingSubmission?.student_name}</Text>
                    {isLoading ? <ActivityIndicator size="large" /> : submissionDetails.map((item, index) => {
                        let correctAnswerDisplay = 'N/A';
                        if (item.question_type === 'multiple_choice' && item.correct_answer && item.options && item.options[item.correct_answer]) {
                            correctAnswerDisplay = `${item.correct_answer}. ${item.options[item.correct_answer]}`;
                        }

                        return (
                            <View key={item.question_id} style={styles.gradingItem}>
                                <Text style={styles.questionText}>{index + 1}. {item.question_text}</Text>
                                <Text style={styles.studentAnswer}>Student Answer: <Text style={{ fontWeight: 'normal' }}>{item.answer_text || 'Not answered'}</Text></Text>
                                {item.question_type === 'multiple_choice' && <Text style={styles.correctAnswerText}>Correct Answer: <Text style={{ fontWeight: 'normal' }}>{correctAnswerDisplay}</Text></Text>}
                                <Text style={styles.label}>Award Marks (out of {item.marks})</Text>
                                <TextInput style={styles.input} keyboardType="number-pad" placeholder={`Max ${item.marks}`} value={String(gradedAnswers[item.question_id] ?? '')} onChangeText={text => handleGradeChange(item.question_id, text)} />
                            </View>
                        );
                    })}
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setGradingSubmission(null)}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalBtn, styles.saveButton]} onPress={submitGrade} disabled={isSubmittingGrade}>{isSubmittingGrade ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Submit Grades</Text>}</TouchableOpacity>
                    </View>
                </ScrollView>
            </Modal>
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
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
    headerSubtitle: { fontSize: 13, color: COLORS.textSub },
    headerBtn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 10,
    },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Card Styles
    card: { backgroundColor: COLORS.cardBg, borderRadius: 12, marginBottom: 15, padding: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    actionIconContainer: { flexDirection: 'row', gap: 10 },
    iconBtn: { padding: 6, backgroundColor: '#e0f2f1', borderRadius: 8 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, flex: 1, marginRight: 10 },
    cardSubtitle: { fontSize: 13, color: COLORS.textSub, marginTop: 2, marginBottom: 4 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    viewSubmissionsBtn: { flexDirection: 'row', backgroundColor: COLORS.blue, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', gap: 5 },
    viewSubmissionsBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    badge: { backgroundColor: '#fff3cd', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#ffecb5' },
    badgeMuted: { backgroundColor: '#f8f9fa', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#e9ecef' },
    badgeText: { color: '#856404', fontSize: 11, fontWeight: 'bold' },

    // Form Styles
    formSection: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10 },
    label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 5, marginTop: 10 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 15 },
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: '#fff' },
    questionEditor: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 10, marginVertical: 10, backgroundColor: '#fafafa' },
    questionEditorTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 10, color: COLORS.textMain },
    headerTitleSecondary: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 10 },
    addQuestionBtn: { backgroundColor: '#e8eaf6', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 20 },
    addQuestionBtnText: { color: '#3f51b5', fontWeight: 'bold' },
    saveButton: { backgroundColor: COLORS.success, padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 30 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Submission List
    searchContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 15, marginBottom: 15, alignItems: 'center', elevation: 2, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.border },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, height: 45, fontSize: 15, color: COLORS.textMain },
    cardDetail: { fontSize: 13, color: '#777', marginTop: 2 },
    gradeButton: { marginTop: 12, backgroundColor: '#ffc107', paddingVertical: 10, borderRadius: 5, alignItems: 'center' },
    gradeButtonText: { color: '#212529', fontWeight: 'bold' },
    gradeBadge: { flexDirection: 'row', backgroundColor: COLORS.blue, borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8, alignItems: 'center' },
    gradeBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },

    // Modal
    modalView: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    gradingItem: { marginVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    questionText: { fontSize: 15, fontWeight: '500' },
    studentAnswer: { fontStyle: 'italic', color: '#333', marginVertical: 5, padding: 8, backgroundColor: '#f0f0f0', borderRadius: 5 },
    correctAnswerText: { fontStyle: 'italic', color: COLORS.success, marginVertical: 5, padding: 8, backgroundColor: '#e9f5e9', borderRadius: 5 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 30, marginBottom: 50 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    modalBtnText: { color: '#fff', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', marginRight: 10 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 15, color: '#777' },
});

export default TeacherAdminExamsScreen;