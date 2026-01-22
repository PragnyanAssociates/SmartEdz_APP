import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, 
    Modal, ScrollView, TextInput, Platform, Image, LayoutAnimation, UIManager, Dimensions, SafeAreaView 
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SERVER_URL } from '../../../apiConfig';
import apiClient from '../../api/client';
import { launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

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
    orange: '#FFA000',
    blue: '#1E88E5'
};

// --- TYPE DEFINITIONS ---
type Status = 'Pending' | 'Approved' | 'Rejected';
interface PreAdmissionRecord { 
    id: number; 
    admission_no: string; 
    submission_date: string; 
    student_name: string; 
    photo_url?: string; 
    dob?: string; 
    pen_no?: string; 
    phone_no?: string; 
    aadhar_no?: string; 
    parent_name?: string; 
    parent_phone?: string; 
    previous_institute?: string; 
    previous_grade?: string; 
    joining_grade: string; 
    address?: string; 
    status: Status; 
}

// --- HELPER FUNCTIONS ---
const formatDate = (dateString?: string, includeTime = false): string => { 
    if (!dateString) return 'N/A'; 
    const date = new Date(dateString); 
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + userTimezoneOffset);
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }; 
    if (includeTime) { 
        options.hour = '2-digit'; 
        options.minute = '2-digit'; 
    } 
    return localDate.toLocaleDateString('en-GB', options); 
};
const toYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];
const getCurrentYear = () => new Date().getFullYear();

// --- UX COMPONENTS ---
const StatusPill = ({ status }: { status: Status }) => { 
    const statusStyle = { 
        Pending: { backgroundColor: '#FFF3E0', color: '#FF9800' }, 
        Approved: { backgroundColor: '#E8F5E9', color: '#4CAF50' }, 
        Rejected: { backgroundColor: '#FFEBEE', color: '#F44336' }, 
    }; 
    return (
        <View style={[styles.statusPill, { backgroundColor: statusStyle[status].backgroundColor }]}>
            <Text style={[styles.statusPillText, { color: statusStyle[status].color }]}>{status}</Text>
        </View>
    ); 
};

const InfoRow = ({ icon, label, value, isMultiLine = false }) => (
    <View style={[styles.infoRow, isMultiLine && { alignItems: 'flex-start' }]}>
        <FontAwesome name={icon} size={14} color={COLORS.textSub} style={[styles.infoIcon, isMultiLine && { marginTop: 3 }]} />
        <Text style={styles.infoLabel}>{label}:</Text>
        <Text style={styles.infoValue} numberOfLines={isMultiLine ? undefined : 1}>{value}</Text>
    </View>
);

const ImageEnlargerModal: React.FC<{ visible: boolean, uri: string, onClose: () => void }> = ({ visible, uri, onClose }) => {
    if (!uri || !visible) return null;
    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={enlargeStyles.modalBackground}>
                <TouchableOpacity style={enlargeStyles.closeButton} onPress={onClose}>
                    <MaterialIcons name="close" size={30} color="#fff" />
                </TouchableOpacity>
                <Image source={{ uri }} style={enlargeStyles.fullImage} resizeMode="contain" />
            </View>
        </Modal>
    );
};

const YearPickerModal: React.FC<{ visible: boolean, years: string[], selectedValue: string, onSelect: (year: string) => void, onClose: () => void }> = ({ visible, years, selectedValue, onSelect, onClose }) => {
    const sortedYears = years.sort((a, b) => parseInt(b) - parseInt(a));
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={pickerStyles.pickerContainer}>
                    <Text style={pickerStyles.pickerTitle}>Select Application Year</Text>
                    <ScrollView style={pickerStyles.scrollArea}>
                        {sortedYears.map((year) => (
                            <TouchableOpacity key={year} style={pickerStyles.option} onPress={() => { onSelect(year); onClose(); }}>
                                <Text style={[pickerStyles.optionText, year === selectedValue && pickerStyles.selectedOptionText]}>{year}</Text>
                                {year === selectedValue && <MaterialIcons name="check" size={20} color={COLORS.primary} />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={pickerStyles.closeButton} onPress={onClose}>
                        <Text style={pickerStyles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

// --- CARD ITEM ---
const PreAdmissionCardItem: React.FC<{ item: PreAdmissionRecord, onEdit: (item: PreAdmissionRecord) => void, onDelete: (id: number) => void, isExpanded: boolean, onPress: () => void, onDpPress: (url: string) => void }> = ({ item, onEdit, onDelete, isExpanded, onPress, onDpPress }) => {
    const imageUri = item.photo_url ? `${SERVER_URL}${item.photo_url}` : undefined;
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
            <View style={styles.cardHeader}>
                 <TouchableOpacity onPress={(e) => { e.stopPropagation(); if (imageUri) onDpPress(item.photo_url!); }} disabled={!imageUri} style={styles.avatarWrapper}>
                    {imageUri ? <Image source={{ uri: imageUri }} style={styles.avatarImage} /> : <View style={[styles.avatarImage, styles.avatarFallback]}><FontAwesome name="user" size={30} color="#90A4AE" /></View>}
                </TouchableOpacity>

                <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{item.student_name}</Text>
                    <Text style={styles.cardSubtitle}>Joining: {item.joining_grade}</Text>
                </View>
                <View style={styles.cardActions}>
                    <StatusPill status={item.status} />
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onEdit(item); }} style={styles.iconButton}><MaterialIcons name="edit" size={20} color={COLORS.orange} /></TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDelete(item.id); }} style={styles.iconButton}><MaterialIcons name="delete" size={20} color={COLORS.danger} /></TouchableOpacity>
                    </View>
                </View>
            </View>

            {isExpanded && (
                <View style={styles.expandedContainer}>
                    <InfoRow icon="id-card" label="Admission No" value={item.admission_no} />
                    <InfoRow icon="calendar" label="Submitted" value={formatDate(item.submission_date, true)} />
                    <InfoRow icon="birthday-cake" label="D.O.B" value={formatDate(item.dob)} />
                    <InfoRow icon="phone" label="Phone" value={item.phone_no || 'N/A'} />
                    <InfoRow icon="user" label="Parent" value={item.parent_name || 'N/A'} />
                    <InfoRow icon="mobile" label="Parent Phone" value={item.parent_phone || 'N/A'} />
                    <InfoRow icon="university" label="Prev. Institute" value={item.previous_institute || 'N/A'} />
                    <InfoRow icon="graduation-cap" label="Prev. Grade" value={item.previous_grade || 'N/A'} />
                    <InfoRow icon="map-marker" label="Address" value={item.address || 'N/A'} isMultiLine />
                </View>
            )}
        </TouchableOpacity>
    );
};

// --- MAIN SCREEN COMPONENT ---
const PreAdmissionsScreen: React.FC = () => {
    const [data, setData] = useState<PreAdmissionRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [currentItem, setCurrentItem] = useState<PreAdmissionRecord | null>(null);
    const [formData, setFormData] = useState<Partial<PreAdmissionRecord>>({});
    const [selectedImage, setSelectedImage] = useState<Asset | null>(null);
    const [date, setDate] = useState(new Date());
    const [pickerTarget, setPickerTarget] = useState<'dob' | null>(null);
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);

    // --- Search/Filter State ---
    const [searchText, setSearchText] = useState<string>('');
    const [filterYear, setFilterYear] = useState<string>(getCurrentYear().toString()); 
    const [yearPickerVisible, setYearPickerVisible] = useState<boolean>(false);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [availableYears, setAvailableYears] = useState<string[]>([]); 
    
    // --- Image Enlarge State ---
    const [enlargeModalVisible, setEnlargeModalVisible] = useState<boolean>(false);
    const [enlargeImageUri, setEnlargeImageUri] = useState<string>('');
    
    // --- Data Fetching Logic ---
    const fetchData = useCallback(async (isSearch: boolean = false) => {
        if (isSearch) setIsSearching(true); else setLoading(true);
        try {
            const params = { search: searchText, year: filterYear };
            const response = await apiClient.get('/preadmissions', { params });
            const records: PreAdmissionRecord[] = response.data;
            setData(records);

            const years = records.map((item: PreAdmissionRecord) => item.submission_date ? new Date(item.submission_date).getFullYear().toString() : null).filter((year: string | null): year is string => year !== null);
            const currentYear = getCurrentYear();
            const uniqueYears = Array.from(new Set([...years, (currentYear - 1).toString(), currentYear.toString(), (currentYear + 1).toString()]));
            setAvailableYears(uniqueYears);

        } catch (error: any) { 
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch data.'); 
        } finally { 
            if (isSearch) setIsSearching(false); else setLoading(false); 
        }
    }, [searchText, filterYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCardPress = (id: number) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpandedCardId(prevId => (prevId === id ? null : id)); };
    
    const handleOpenModal = (item: PreAdmissionRecord | null = null) => { 
        setSelectedImage(null); 
        if (item) { setIsEditing(true); setCurrentItem(item); setFormData(item); } 
        else { setIsEditing(false); setCurrentItem(null); setFormData({ status: 'Pending' }); } 
        setModalVisible(true); 
    };
    
    const handleChoosePhoto = () => { 
        launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (response: ImagePickerResponse) => { 
            if (!response.didCancel && !response.errorCode && response.assets && response.assets.length > 0) { setSelectedImage(response.assets[0]); } 
        }); 
    };
    
    const handleSave = async () => {
        if (!formData.admission_no || !formData.student_name || !formData.joining_grade) { return Alert.alert('Validation Error', 'Admission No, Student Name, and Joining Grade are required.'); }
        const body = new FormData();
        Object.keys(formData).forEach(key => { const value = formData[key as keyof PreAdmissionRecord]; if (value !== null && value !== undefined) body.append(key, String(value)); });
        if (selectedImage?.uri) { body.append('photo', { uri: selectedImage.uri, type: selectedImage.type || 'image/jpeg', name: selectedImage.fileName || 'preadmission_photo.jpg' } as any); }
        try {
            let response;
            if (isEditing && currentItem) response = await apiClient.put(`/preadmissions/${currentItem.id}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
            else response = await apiClient.post('/preadmissions', body, { headers: { 'Content-Type': 'multipart/form-data' } });
            Alert.alert('Success', response.data.message); setModalVisible(false); fetchData();
        } catch (error: any) { Alert.alert('Save Error', error.response?.data?.message || 'An error occurred during save.'); }
    };

    const handleDelete = (id: number) => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this record?", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { const response = await apiClient.delete(`/preadmissions/${id}`); Alert.alert("Success", response.data.message); fetchData(); } catch (error: any) { Alert.alert('Delete Error', error.response?.data?.message || 'Failed to delete record.'); }}}]);
    };

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => { setPickerTarget(null); if (event.type === 'set' && selectedDate) { setFormData(prev => ({ ...prev, dob: toYYYYMMDD(selectedDate) })); } };
    const handleImageEnlarge = (url: string) => { setEnlargeImageUri(`${SERVER_URL}${url}`); setEnlargeModalVisible(true); };
    const handleYearSelect = (year: string) => { setFilterYear(year); }

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="person-add-alt-1" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Pre-Admissions</Text>
                        <Text style={styles.headerSubtitle}>Applications</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={() => handleOpenModal()}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>
            
            {/* --- SEARCH & FILTER --- */}
            <View style={styles.searchFilterContainer}>
                <View style={styles.searchWrapper}>
                    <MaterialIcons name="search" size={20} color={COLORS.textSub} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search Name, ID..."
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholderTextColor={COLORS.textSub}
                        autoCapitalize="none"
                        onSubmitEditing={() => fetchData(true)}
                    />
                    {isSearching && <ActivityIndicator size="small" color={COLORS.primary} style={styles.loadingIndicator} />}
                </View>
                <TouchableOpacity style={styles.filterButton} onPress={() => setYearPickerVisible(true)}>
                    <Text style={styles.filterButtonText}>{filterYear}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={data}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <PreAdmissionCardItem 
                        item={item} 
                        onEdit={handleOpenModal} 
                        onDelete={handleDelete} 
                        isExpanded={expandedCardId === item.id} 
                        onPress={() => handleCardPress(item.id)} 
                        onDpPress={handleImageEnlarge}
                    />
                )}
                ListEmptyComponent={<View style={styles.emptyContainer}><MaterialIcons name="inbox" size={60} color="#CFD8DC" /><Text style={styles.emptyText}>No applications found.</Text></View>}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 100 }}
            />
            
            {/* --- Modal Forms --- */}
            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
                    <ScrollView style={styles.modalContainer} contentContainerStyle={{paddingBottom: 50}}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>{isEditing ? 'Edit Application' : 'New Application'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}><MaterialIcons name="close" size={24} color="#333" /></TouchableOpacity>
                        </View>
                        
                        <View style={styles.imagePickerContainer}>
                            {selectedImage?.uri || formData.photo_url ? (
                                <Image source={selectedImage?.uri ? { uri: selectedImage.uri } : { uri: `${SERVER_URL}${formData.photo_url}` }} style={styles.profileImage} />
                            ) : (
                                <View style={[styles.profileImage, styles.avatarFallback]}><FontAwesome name="user-circle" size={60} color="#9E9E9E" /></View>
                            )}
                            <TouchableOpacity style={styles.imagePickerButton} onPress={handleChoosePhoto}><MaterialIcons name="camera-alt" size={16} color="#fff" /><Text style={styles.imagePickerButtonText}>Photo</Text></TouchableOpacity>
                        </View>
                        
                        <Text style={styles.label}>Admission No*</Text><TextInput style={styles.input} value={formData.admission_no || ''} onChangeText={t => setFormData(p => ({...p, admission_no: t}))} />
                        <Text style={styles.label}>Student Name*</Text><TextInput style={styles.input} value={formData.student_name || ''} onChangeText={t => setFormData(p => ({...p, student_name: t}))} />
                        <Text style={styles.label}>Date of Birth</Text><TouchableOpacity onPress={() => setPickerTarget('dob')} style={styles.input}><Text style={styles.dateText}>{formData.dob ? formatDate(formData.dob) : 'Select Date'}</Text></TouchableOpacity>
                        <Text style={styles.label}>Joining Grade*</Text><TextInput style={styles.input} value={formData.joining_grade || ''} onChangeText={t => setFormData(p => ({...p, joining_grade: t}))} />
                        
                        <Text style={styles.sectionHeader}>Status</Text>
                        <View style={styles.statusSelector}>{(['Pending', 'Approved', 'Rejected'] as Status[]).map(status => (<TouchableOpacity key={status} onPress={() => setFormData(p => ({...p, status}))} style={[styles.statusButton, formData.status === status && styles.selectedStatusButton]}><Text style={[styles.statusButtonText, formData.status === status && styles.selectedStatusButtonText]}>{status}</Text></TouchableOpacity>))}</View>
                        
                        {pickerTarget && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}><Text style={{color: '#333'}}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            <YearPickerModal visible={yearPickerVisible} years={availableYears} selectedValue={filterYear} onSelect={handleYearSelect} onClose={() => setYearPickerVisible(false)} />
            <ImageEnlargerModal visible={enlargeModalVisible} uri={enlargeImageUri} onClose={() => setEnlargeModalVisible(false)} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({ 
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }, 
    container: { flex: 1, backgroundColor: COLORS.background }, 

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
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
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

    // --- SEARCH & FILTER ---
    searchFilterContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 15 },
    searchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, height: 45, borderWidth: 1, borderColor: COLORS.border },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16, color: COLORS.textMain },
    loadingIndicator: { marginLeft: 5 },
    filterButton: { marginLeft: 10, backgroundColor: COLORS.primary, paddingHorizontal: 12, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
    filterButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14, marginRight: 4 },
    
    // --- CARD STYLES ---
    card: { backgroundColor: COLORS.cardBg, borderRadius: 12, marginVertical: 6, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, overflow: 'hidden' }, 
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }, 
    avatarWrapper: { marginRight: 12 },
    avatarImage: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' },
    avatarFallback: { backgroundColor: '#B0BEC5' },
    cardHeaderText: { flex: 1, justifyContent: 'center', marginTop: 2 }, 
    cardTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.textMain }, 
    cardSubtitle: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
    cardActions: { alignItems: 'flex-end' }, 
    buttonGroup: { flexDirection: 'row', marginTop: 5 }, 
    iconButton: { marginLeft: 12, padding: 4 }, 
    statusPill: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, alignItems: 'center', marginBottom: 5 }, 
    statusPillText: { fontSize: 11, fontWeight: 'bold' }, 
    expandedContainer: { paddingHorizontal: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 }, 
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, 
    infoIcon: { width: 20, textAlign: 'center', marginRight: 8 }, 
    infoLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMain, marginRight: 5 }, 
    infoValue: { fontSize: 13, color: COLORS.textSub, flex: 1 }, 
    
    // --- MODAL & GENERAL ---
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50, opacity: 0.6 }, 
    emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textSub, marginTop: 10 }, 
    emptySubText: { fontSize: 14, color: COLORS.textSub, marginTop: 4 }, 
    modalContainer: { padding: 20 }, 
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain }, 
    label: { fontSize: 14, color: COLORS.textSub, marginBottom: 5, fontWeight: '500' }, 
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 10, fontSize: 15, color: COLORS.textMain }, 
    dateText: { color: COLORS.textMain, fontSize: 15 }, 
    textArea: { height: 80, textAlignVertical: 'top' }, 
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 50 }, 
    modalButton: { paddingVertical: 12, borderRadius: 8, flex: 1, alignItems: 'center', elevation: 2 }, 
    cancelButton: { backgroundColor: '#e0e0e0', marginRight: 10 }, 
    saveButton: { backgroundColor: COLORS.primary, marginLeft: 10 }, 
    modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }, 
    imagePickerContainer: { alignItems: 'center', marginBottom: 20 }, 
    profileImage: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', marginBottom: 10, borderWidth: 2, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }, 
    imagePickerButton: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, alignItems: 'center' }, 
    imagePickerButtonText: { color: '#fff', marginLeft: 6, fontWeight: 'bold', fontSize: 12 }, 
    sectionHeader: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginTop: 15, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
    statusSelector: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }, 
    statusButton: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#B0BEC5', alignItems: 'center', marginHorizontal: 4 }, 
    selectedStatusButton: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, 
    statusButtonText: { color: COLORS.textMain, fontWeight: '600' }, 
    selectedStatusButtonText: { color: '#FFFFFF' }, 
});

// --- Year Picker Styles ---
const pickerStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    pickerContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 15, paddingHorizontal: 20, maxHeight: height * 0.7 },
    pickerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, textAlign: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 10 },
    pickerScrollArea: { maxHeight: height * 0.5 },
    pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    pickerOptionText: { fontSize: 16, color: COLORS.textMain },
    pickerSelectedOptionText: { fontWeight: 'bold', color: COLORS.primary },
    pickerCloseButton: { backgroundColor: COLORS.blue, padding: 15, borderRadius: 10, marginTop: 15, marginBottom: Platform.OS === 'ios' ? 30 : 15, alignItems: 'center' },
    pickerCloseButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});

// --- Image Enlarger Styles ---
const enlargeStyles = StyleSheet.create({
    modalBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' },
    enlargeFullImage: { width: width * 0.9, height: height * 0.7 },
    enlargeCloseButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }
});

export default PreAdmissionsScreen;