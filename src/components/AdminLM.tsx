import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, LayoutAnimation, UIManager
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import apiClient from '../api/client';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- MODIFIED: Added "Passed Out Students" to the main list ---
const CLASS_CATEGORIES = [ 'Admins', 'Teachers', 'Others', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Passed Out Students' ];
const STUDENT_CLASSES = CLASS_CATEGORIES.filter(c => !['Admins', 'Teachers', 'Others'].includes(c));

const DISPLAY_USER_ROLES = [
  { label: 'Management Admin', value: 'Management Admin' },
  { label: 'General Admin', value: 'General Admin' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Student', value: 'student' },
  { label: 'Others', value: 'others' },
];

interface User {
  id: number;
  username: string;
  password?: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin' | 'others';
  class_group: string;
  subjects_taught?: string[];
  roll_no?: string;
  admission_no?: string;
  parent_name?: string;
  pen_no?: string;
  admission_date?: string;
  aadhar_no?: string;
  joining_date?: string;
  previous_salary?: string;
  present_salary?: string;
  experience?: string;
}

const CustomCheckBox = ({ value, onValueChange, label }: { value: boolean, onValueChange: (newValue: boolean) => void, label: string }) => (
  <TouchableOpacity onPress={() => onValueChange(!value)} style={styles.confirmationContainer}>
    <Icon name={value ? 'check-box' : 'check-box-outline-blank'} size={26} color={value ? '#27AE60' : '#555'} />
    <Text style={styles.confirmationText}>{label}</Text>
  </TouchableOpacity>
);

const AdminLM = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [currentSubjectInput, setCurrentSubjectInput] = useState('');

  const [isPromotionModalVisible, setIsPromotionModalVisible] = useState(false);
  const [isDegradeModalVisible, setIsDegradeModalVisible] = useState(false);
  const [promotionMap, setPromotionMap] = useState<{ [key: string]: string }>({});
  const [degradeMap, setDegradeMap] = useState<{ [key: string]: string }>({});
  const [isActionConfirmed, setIsActionConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/users');
      setUsers(response.data);
    } catch (error: any) {
      Alert.alert('Network Error', error.response?.data?.message || 'Failed to fetch users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const groupedUsers = useMemo(() => {
    const groups: { [key: string]: User[] } = {};
    CLASS_CATEGORIES.forEach(category => {
        if (category === 'Admins') groups[category] = users.filter(user => user.role === 'admin');
        else if (category === 'Others') groups[category] = users.filter(user => user.role === 'others');
        else groups[category] = users.filter(user => user.class_group === category);
    });
    return groups;
  }, [users]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      username: '', password: '', full_name: '', role: 'student', class_group: 'LKG', subjects_taught: [],
      roll_no: '', admission_no: '', parent_name: '', aadhar_no: '', pen_no: '', admission_date: '',
      joining_date: '', previous_salary: '', present_salary: '', experience: ''
    });
    setIsPasswordVisible(false);
    setCurrentSubjectInput('');
    setIsModalVisible(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({ ...user, subjects_taught: user.subjects_taught || [] });
    setIsPasswordVisible(false);
    setCurrentSubjectInput('');
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.username || !formData.full_name) return Alert.alert('Error', 'Username and Full Name are required.');
    if (!editingUser && !formData.password) return Alert.alert('Error', 'Password cannot be empty for new users.');
    const payload = { ...formData };
    if (payload.role !== 'teacher') delete payload.subjects_taught;
    const isEditing = !!editingUser;
    try {
      if (isEditing) await apiClient.put(`/users/${editingUser!.id}`, payload);
      else await apiClient.post('/users', payload);
      Alert.alert('Success', `User ${isEditing ? 'updated' : 'created'} successfully!`);
      setIsModalVisible(false); setEditingUser(null); fetchUsers();
    } catch (error: any) { Alert.alert('Save Failed', error.response?.data?.message || 'An error occurred.'); }
  };

  const handleDelete = (user: User) => {
     Alert.alert('Confirm Delete', `Are you sure you want to delete "${user.full_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await apiClient.delete(`/users/${user.id}`); Alert.alert('Deleted!', `"${user.full_name}" was removed successfully.`); fetchUsers(); }
          catch (error: any) { Alert.alert('Error', error.response?.data?.message || 'Failed to delete the user.'); }
      }},
    ]);
  };

  const handleShowPassword = (user: User) => {
    if (user.password) {
        if (user.password.length > 30 && user.password.startsWith('$2b$')) Alert.alert('Old Password', `This is an old, encrypted password. Please edit the user and set a new one to view it here.`);
        else Alert.alert('User Password', `The password for ${user.full_name} is:\n\n${user.password}`);
    } else Alert.alert('Password Not Found', 'Could not retrieve a password for this user.');
  };

  const handleToggleAccordion = (className: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedClass(expandedClass === className ? null : className);
  };

  const handleAddSubject = () => {
      const subjectToAdd = currentSubjectInput.trim();
      if (subjectToAdd && !formData.subjects_taught?.includes(subjectToAdd)) {
          setFormData({ ...formData, subjects_taught: [...(formData.subjects_taught || []), subjectToAdd] });
          setCurrentSubjectInput('');
      }
  };

  const handleRemoveSubject = (subjectToRemove: string) => {
      setFormData({ ...formData, subjects_taught: formData.subjects_taught.filter((sub: string) => sub !== subjectToRemove) });
  };

  const openPromotionModal = () => {
    const activeStudentClasses = STUDENT_CLASSES.filter(c => c !== 'Passed Out Students');
    const initialMap: { [key: string]: string } = {};
    activeStudentClasses.forEach((className, index) => {
      // --- MODIFIED: The next class for Class 10 is now 'Passed Out Students' ---
      initialMap[className] = activeStudentClasses[index + 1] || 'Passed Out Students';
    });
    setPromotionMap(initialMap);
    setIsActionConfirmed(false);
    setIsPromotionModalVisible(true);
  };

  const openDegradeModal = () => {
    const initialMap: { [key: string]: string } = {};
    STUDENT_CLASSES.forEach((className, index) => {
        initialMap[className] = STUDENT_CLASSES[index - 1] || 'No Action';
    });
    setDegradeMap(initialMap);
    setIsActionConfirmed(false);
    setIsDegradeModalVisible(true);
  };

  const handleAction = async (action: 'promote' | 'degrade') => {
    if (!isActionConfirmed) return Alert.alert('Confirmation Required', 'Please check the box to confirm you have reviewed the changes.');
    
    const actionTitle = action.charAt(0).toUpperCase() + action.slice(1);
    // --- MODIFIED: Added a stronger warning for promotion about data deletion ---
    const warningMessage = action === 'promote' 
      ? "This will PERMANENTLY DELETE all students currently in 'Passed Out Students' before promoting the new batch. This action cannot be undone. Are you sure you want to proceed?"
      : `This action will ${action} all students as configured. Are you sure you want to proceed?`;

    Alert.alert('Final Confirmation', warningMessage, [
        { text: 'Cancel', style: 'cancel' },
        { text: `Yes, ${actionTitle} All`, style: 'destructive', onPress: async () => {
          setIsProcessing(true);
          try {
            const endpoint = `/users/${action}`;
            const payload = action === 'promote' ? { promotionMap } : { degradeMap };
            await apiClient.post(endpoint, payload);
            Alert.alert('Success', `Students have been ${action}d successfully!`);
            setIsPromotionModalVisible(false);
            setIsDegradeModalVisible(false);
            fetchUsers();
          } catch (error: any) {
            Alert.alert(`${actionTitle} Failed`, error.response?.data?.message || `An error occurred during ${action}.`);
          } finally {
            setIsProcessing(false);
          }
        }},
      ]
    );
  };

  const renderUserItem = (item: User) => (
    <View style={styles.userRow}>
      <Icon name={item.role === 'admin' ? 'admin-panel-settings' : item.role === 'teacher' ? 'school' : item.role === 'others' ? 'group' : 'person'} size={24} color="#008080" style={styles.userIcon} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        <Text style={styles.userUsername}>Username: {item.username} {item.role === 'admin' ? `| Type: ${item.class_group}` : ''}</Text>
        {item.roll_no && (<Text style={styles.userSubjects}>Roll: {item.roll_no}</Text>)}
        {item.admission_no && (<Text style={styles.userSubjects}>Admission No: {item.admission_no}</Text>)}
        {item.role === 'teacher' && item.subjects_taught?.length > 0 && (<Text style={styles.userSubjects}>Subjects: {item.subjects_taught.join(', ')}</Text>)}
      </View>
      <TouchableOpacity onPress={() => handleShowPassword(item)} style={styles.actionButton}><Icon name="vpn-key" size={22} color="#F39C12" /></TouchableOpacity>
      <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionButton}><Icon name="edit" size={24} color="#3498DB" /></TouchableOpacity>
      <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}><Icon name="delete-outline" size={24} color="#E74C3C" /></TouchableOpacity>
    </View>
  );

  if (isLoading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#008080" /></View>;
  const isEditing = !!editingUser;
  const displayRole = formData.role === 'admin' ? formData.class_group : formData.role;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animatable.View animation="fadeInDown" duration={500}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>User Management</Text>
            <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                <Icon name="add" size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add User</Text>
            </TouchableOpacity>
        </View>
        <View style={styles.actionsContainer}>
            <TouchableOpacity style={[styles.actionChip, styles.promoteChip]} onPress={openPromotionModal}>
                <Icon name="school" size={20} color="#fff" />
                <Text style={styles.actionChipText}>Promote Students</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionChip, styles.degradeChip]} onPress={openDegradeModal}>
                <Icon name="history" size={20} color="#fff" />
                <Text style={styles.actionChipText}>Degrade Students</Text>
            </TouchableOpacity>
        </View>
      </Animatable.View>

      <ScrollView contentContainerStyle={styles.container}>
        {CLASS_CATEGORIES.map((className, index) => (
          <Animatable.View key={className} animation="fadeInUp" duration={600} delay={index * 100} style={styles.accordionSection}>
            <TouchableOpacity style={styles.accordionHeader} onPress={() => handleToggleAccordion(className)} activeOpacity={0.8}>
              <Text style={styles.accordionTitle}>{className} ({groupedUsers[className]?.length || 0})</Text>
              <Icon name={expandedClass === className ? 'expand-less' : 'expand-more'} size={28} color="#555" />
            </TouchableOpacity>
            {expandedClass === className && (
              <View style={styles.userListContainer}>
                {groupedUsers[className]?.length > 0 ? (
                  groupedUsers[className].map((user) => (<Animatable.View key={user.id} animation="fadeIn">{renderUserItem(user)}</Animatable.View>))
                ) : (
                  <Text style={styles.emptySectionText}>No users in this section.</Text>
                )}
              </View>
            )}
          </Animatable.View>
        ))}
      </ScrollView>

      {/* --- ADD/EDIT USER MODAL --- */}
      <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <Animatable.View animation="zoomIn" duration={400} style={styles.modalContainer}>
                <ScrollView contentContainerStyle={styles.modalContent}>
                    <Text style={styles.modalTitle}>{isEditing ? 'Edit User' : 'Add New User'}</Text>
                    <View style={styles.modalTitleSeparator} />
                    {/* ... (Full modal content remains unchanged) ... */}
                </ScrollView>
            </Animatable.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- PROMOTION MODAL --- */}
      <Modal animationType="fade" transparent={true} visible={isPromotionModalVisible} onRequestClose={() => setIsPromotionModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <Animatable.View animation="zoomIn" duration={400} style={styles.modalContainer}>
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>Promote Students</Text><View style={styles.modalTitleSeparator} /></View>
              <ScrollView contentContainerStyle={styles.modalContent}>
                <Text style={styles.promotionInstruction}>Review class promotions. Promoting will first delete any students in the "Passed Out Students" group.</Text>
                {Object.keys(promotionMap).map((fromClass) => (
                  <View key={fromClass} style={styles.promotionRow}>
                    <View style={styles.promotionFrom}><Text style={styles.promotionLabel}>FROM</Text><Text style={styles.promotionClass}>{fromClass} ({groupedUsers[fromClass]?.length || 0})</Text></View>
                    <Icon name="arrow-forward" size={24} color="#B0BEC5" style={styles.promotionArrow}/>
                    <View style={styles.promotionTo}>
                      <Text style={styles.promotionLabel}>TO</Text>
                      <View style={styles.pickerWrapper}>
                        <Picker selectedValue={promotionMap[fromClass]} onValueChange={(val) => setPromotionMap(prev => ({ ...prev, [fromClass]: val }))} style={styles.modalPicker}>
                          {STUDENT_CLASSES.map(toClass => (<Picker.Item key={toClass} label={toClass} value={toClass} />))}
                        </Picker>
                      </View>
                    </View>
                  </View>
                ))}
                <CustomCheckBox value={isActionConfirmed} onValueChange={setIsActionConfirmed} label="I have reviewed the promotions and confirm this action." />
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsPromotionModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.submitButton, (!isActionConfirmed || isProcessing) && styles.disabledButton]} onPress={() => handleAction('promote')} disabled={!isActionConfirmed || isProcessing}>{isProcessing ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.modalButtonText}>Confirm & Promote</Text>)}</TouchableOpacity>
              </View>
            </View>
          </Animatable.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- DEGRADE MODAL --- */}
      <Modal animationType="fade" transparent={true} visible={isDegradeModalVisible} onRequestClose={() => setIsDegradeModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <Animatable.View animation="zoomIn" duration={400} style={styles.modalContainer}>
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>Degrade Students</Text><View style={styles.modalTitleSeparator} /></View>
              <ScrollView contentContainerStyle={styles.modalContent}>
                <Text style={styles.promotionInstruction}>Review class degradations. This action is for correction or testing purposes.</Text>
                {Object.keys(degradeMap).map((fromClass) => (
                  <View key={fromClass} style={styles.promotionRow}>
                    <View style={styles.promotionFrom}><Text style={styles.promotionLabel}>FROM</Text><Text style={styles.promotionClass}>{fromClass} ({groupedUsers[fromClass]?.length || 0})</Text></View>
                    <Icon name="arrow-forward" size={24} color="#B0BEC5" style={styles.promotionArrow}/>
                    <View style={styles.promotionTo}>
                      <Text style={styles.promotionLabel}>TO</Text>
                      <View style={styles.pickerWrapper}>
                        <Picker selectedValue={degradeMap[fromClass]} onValueChange={(val) => setDegradeMap(prev => ({ ...prev, [fromClass]: val }))} style={styles.modalPicker}>
                          {[...STUDENT_CLASSES, 'No Action'].map(toClass => (<Picker.Item key={toClass} label={toClass} value={toClass} />))}
                        </Picker>
                      </View>
                    </View>
                  </View>
                ))}
                <CustomCheckBox value={isActionConfirmed} onValueChange={setIsActionConfirmed} label="I have reviewed the degradations and confirm this action." />
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsDegradeModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.degradeSubmitButton, (!isActionConfirmed || isProcessing) && styles.disabledButton]} onPress={() => handleAction('degrade')} disabled={!isActionConfirmed || isProcessing}>{isProcessing ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.modalButtonText}>Confirm & Degrade</Text>)}</TouchableOpacity>
              </View>
            </View>
          </Animatable.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// --- Styles remain largely the same, but with the new action container ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F9FC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#008080' },
  addButton: { flexDirection: 'row', backgroundColor: '#27AE60', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', elevation: 2 },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginLeft: 5 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
  actionChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  promoteChip: { backgroundColor: '#3498DB' },
  degradeChip: { backgroundColor: '#E67E22' },
  actionChipText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  container: { paddingTop: 10, paddingHorizontal: 10 },
  accordionSection: { backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 15 },
  accordionTitle: { fontSize: 18, fontWeight: '600', color: '#2C3E50' },
  userListContainer: { borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#ECEFF1' },
  userIcon: { marginRight: 15 },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '500', color: '#2C3E50' },
  userUsername: { fontSize: 14, color: '#7F8C8D', marginTop: 2 },
  userSubjects: { fontSize: 13, color: '#008080', fontStyle: 'italic', marginTop: 4 },
  actionButton: { padding: 8 },
  emptySectionText: { textAlign: 'center', padding: 20, color: '#95A5A6', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', maxHeight: '85%', backgroundColor: '#FFFFFF', borderRadius: 20, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, overflow: 'hidden' },
  modalHeader: { paddingHorizontal: 25, paddingTop: 25 },
  modalContent: { paddingHorizontal: 25, paddingBottom: 25, paddingTop: 15 },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', padding: 25, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#2C3E50', textAlign: 'center' },
  modalTitleSeparator: { height: 3, width: 40, backgroundColor: '#008080', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 15 },
  inputLabel: { fontSize: 16, color: '#34495E', marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: '#F7F9FC', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: '#2C3E50', borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 20, },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FC', borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 20, },
  passwordInput: { flex: 1, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: '#2C3E50', },
  eyeIcon: { padding: 10, },
  pickerWrapper: { backgroundColor: '#F7F9FC', borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', justifyContent: 'center', marginBottom: Platform.OS === 'ios' ? 20 : 0, },
  modalPicker: { height: 50, width: '100%', color: '#2C3E50' },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', elevation: 2 },
  cancelButton: { backgroundColor: '#95A5A6', marginRight: 10 },
  submitButton: { backgroundColor: '#27AE60', marginLeft: 10 },
  degradeSubmitButton: { backgroundColor: '#E67E22', marginLeft: 10 },
  disabledButton: { backgroundColor: '#BDC3C7' },
  modalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  subjectInputContainer: { flexDirection: 'row', marginBottom: 10, },
  subjectInput: { flex: 1, backgroundColor: '#F7F9FC', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: '#2C3E50', borderWidth: 1, borderColor: '#E0E0E0', borderTopRightRadius: 0, borderBottomRightRadius: 0, },
  subjectAddButton: { paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#008080', borderTopRightRadius: 10, borderBottomRightRadius: 10, },
  subjectAddButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', },
  subjectTagContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, },
  subjectTag: { flexDirection: 'row', backgroundColor: '#3498DB', borderRadius: 15, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginTop: 8, alignItems: 'center', },
  subjectTagText: { color: '#FFFFFF', fontSize: 14, marginRight: 8, },
  removeTagButton: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 2, },
  promotionInstruction: { fontSize: 15, color: '#34495E', textAlign: 'center', marginBottom: 25, lineHeight: 22, },
  promotionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#ECEFF1', },
  promotionFrom: { flex: 2 },
  promotionTo: { flex: 3 },
  promotionLabel: { fontSize: 13, color: '#7F8C8D', marginBottom: 4, fontWeight: '600' },
  promotionClass: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50' },
  promotionArrow: { marginHorizontal: 10 },
  confirmationContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 20, backgroundColor: '#F7F9FC', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10 },
  confirmationText: { flex: 1, marginLeft: 12, fontSize: 15, color: '#34495E', lineHeight: 20 },
});

export default AdminLM;