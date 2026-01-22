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
    orange: '#FFA000'
};

// --- TYPE DEFINITIONS ---
interface AlumniRecord {
  id: number;
  admission_no: string;
  alumni_name: string;
  profile_pic_url?: string;
  dob?: string;
  pen_no?: string;
  phone_no?: string;
  aadhar_no?: string;
  parent_name?: string;
  parent_phone?: string;
  address?: string;
  school_joined_date?: string;
  school_joined_grade?: string;
  school_outgoing_date?: string;
  school_outgoing_grade?: string;
  tc_issued_date?: string;
  tc_number?: string;
  present_status?: string;
}

// --- HELPER FUNCTIONS ---
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const toYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];
const getCurrentYear = () => new Date().getFullYear();

// --- Image Enlarger Modal ---
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

// --- Custom Year Picker Component ---
const YearPickerModal: React.FC<{ 
    visible: boolean, 
    years: string[], 
    selectedValue: string, 
    onSelect: (year: string) => void, 
    onClose: () => void 
}> = ({ visible, years, selectedValue, onSelect, onClose }) => {
    const sortedYears = years.sort((a, b) => parseInt(b) - parseInt(a));
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={pickerStyles.pickerContainer}>
                    <Text style={pickerStyles.pickerTitle}>Select Outgoing Year</Text>
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

// --- MAIN SCREEN COMPONENT ---
const AlumniScreen: React.FC = () => {
    const [alumniData, setAlumniData] = useState<AlumniRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [modalVisible, setModalVisible] = useState<boolean>(false); 
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [currentItem, setCurrentItem] = useState<AlumniRecord | null>(null);
    const initialFormState: Partial<AlumniRecord> = {};
    const [formData, setFormData] = useState<Partial<AlumniRecord>>(initialFormState);
    const [selectedImage, setSelectedImage] = useState<Asset | null>(null);
    const [date, setDate] = useState(new Date());
    const [pickerTarget, setPickerTarget] = useState<keyof AlumniRecord | null>(null);
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
    
    // --- Filter State ---
    const [searchText, setSearchText] = useState<string>('');
    const [filterYear, setFilterYear] = useState<string>(getCurrentYear().toString()); 
    const [yearPickerVisible, setYearPickerVisible] = useState<boolean>(false);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [availableYears, setAvailableYears] = useState<string[]>([]); 
    
    // --- Image Enlarge State ---
    const [enlargeModalVisible, setEnlargeModalVisible] = useState<boolean>(false);
    const [enlargeImageUri, setEnlargeImageUri] = useState<string>('');

    const sortBy = 'alumni_name';
    const sortOrder = 'ASC';

    // --- Data Fetching Logic ---
    const fetchData = useCallback(async (isSearch: boolean = false) => {
        if (isSearch) setIsSearching(true); else setLoading(true);
        try {
            const params = { search: searchText, sortBy: sortBy, sortOrder: sortOrder, year: filterYear };
            const response = await apiClient.get('/alumni', { params });
            const data = response.data;
            setAlumniData(data);
            
            const years = data.map((item: AlumniRecord) => item.school_outgoing_date ? new Date(item.school_outgoing_date).getFullYear().toString() : null).filter((year: string | null): year is string => year !== null);
            const uniqueYears = Array.from(new Set([...years, (getCurrentYear() - 1).toString(), getCurrentYear().toString(), (getCurrentYear() + 1).toString()]));
            setAvailableYears(uniqueYears);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch alumni data.');
        } finally {
            if (isSearch) setIsSearching(false); else setLoading(false);
        }
    }, [searchText, filterYear]);

    useEffect(() => { fetchData(); }, [fetchData]);
    
    const handleOpenModal = (item: AlumniRecord | null = null) => {
        setSelectedImage(null);
        if (item) {
            setIsEditing(true); setCurrentItem(item); setFormData(item);
        } else {
            setIsEditing(false); setCurrentItem(null); setFormData(initialFormState);
        }
        setModalVisible(true);
    };
    
    const handleChoosePhoto = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (response: ImagePickerResponse) => {
            if (response.didCancel) { console.log('User cancelled image picker'); }
            else if (response.errorCode) { Alert.alert('ImagePicker Error', response.errorMessage || 'An error occurred'); }
            else if (response.assets && response.assets.length > 0) { setSelectedImage(response.assets[0]); }
        });
    };

    const handleSave = async () => {
        if (!formData.admission_no || !formData.alumni_name) return Alert.alert('Validation Error', 'Admission Number and Name are required.');
        const data = new FormData();
        Object.keys(formData).forEach(key => {
            const value = formData[key as keyof AlumniRecord];
            if (value !== null && value !== undefined) data.append(key, String(value));
        });
        if (selectedImage?.uri) {
            data.append('profile_pic', { uri: selectedImage.uri, type: selectedImage.type || 'image/jpeg', name: selectedImage.fileName || 'profile_pic.jpg' } as any);
        }
        try {
            let response;
            if (isEditing && currentItem) response = await apiClient.put(`/alumni/${currentItem.id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            else response = await apiClient.post('/alumni', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            
            Alert.alert('Success', response.data.message || 'Record saved successfully.');
            setModalVisible(false);
            fetchData();
        } catch (error: any) { Alert.alert('Save Error', error.response?.data?.message || 'An error occurred during save.'); }
    };

    const handleDelete = (id: number) => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this record?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    const response = await apiClient.delete(`/alumni/${id}`);
                    Alert.alert("Success", response.data.message || 'Record deleted.');
                    fetchData();
                } catch (error: any) { Alert.alert('Delete Error', error.response?.data?.message || 'Failed to delete record.'); }
            }}
        ]);
    };

    const showDatePicker = (target: keyof AlumniRecord) => {
        const currentDate = formData[target] ? new Date(formData[target] as string) : new Date();
        setDate(currentDate);
        setPickerTarget(target);
    };

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setPickerTarget(null);
        if (event.type === 'set' && selectedDate && pickerTarget) setFormData(prev => ({ ...prev, [pickerTarget]: toYYYYMMDD(selectedDate) }));
    };

    const handleImageEnlarge = (url: string) => { setEnlargeImageUri(`${SERVER_URL}${url}`); setEnlargeModalVisible(true); };
    const handleYearSelect = (year: string) => { setFilterYear(year); }
    const handleCardPress = (id: number) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpandedCardId(prevId => (prevId === id ? null : id)); };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="school" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Alumni Network</Text>
                        <Text style={styles.headerSubtitle}>Student Records</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={() => handleOpenModal()}>
                    <MaterialIcons name="person-add" size={18} color="#fff" />
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
            
            {/* --- List --- */}
            <FlatList
                data={alumniData}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <AlumniCardItem 
                        item={item} 
                        onEdit={handleOpenModal} 
                        onDelete={handleDelete}
                        isExpanded={expandedCardId === item.id}
                        onPress={() => handleCardPress(item.id)}
                        onDpPress={handleImageEnlarge} 
                    />
                )}
                ListEmptyComponent={<View style={styles.emptyContainer}><MaterialIcons name="school" size={60} color="#CFD8DC" /><Text style={styles.emptyText}>No Alumni Found</Text><Text style={styles.emptySubText}>Try adjusting your year or search filters.</Text></View>}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 100 }}
            />

            {/* --- Add/Edit Modal --- */}
            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
                    <ScrollView style={styles.modalContainer} contentContainerStyle={{paddingBottom: 50}}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>{isEditing ? 'Edit Alumni' : 'New Alumni'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialIcons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.imagePickerContainer}>
                            {selectedImage?.uri || formData.profile_pic_url ? (
                                <Image source={selectedImage?.uri ? { uri: selectedImage.uri } : { uri: `${SERVER_URL}${formData.profile_pic_url}` }} style={styles.profileImage} />
                            ) : (
                                <View style={[styles.profileImage, styles.avatarFallback]}>
                                    <FontAwesome name="user" size={60} color="#9E9E9E" />
                                </View>
                            )}
                            <TouchableOpacity style={styles.imagePickerButton} onPress={handleChoosePhoto}>
                                <MaterialIcons name="camera-alt" size={16} color="#fff" />
                                <Text style={styles.imagePickerButtonText}>Photo</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.formRow}><Text style={styles.label}>Admission No*</Text><TextInput style={styles.input} value={formData.admission_no || ''} onChangeText={t => setFormData(p => ({...p, admission_no: t}))} /></View>
                        <View style={styles.formRow}><Text style={styles.label}>Alumni Name*</Text><TextInput style={styles.input} value={formData.alumni_name || ''} onChangeText={t => setFormData(p => ({...p, alumni_name: t}))} /></View>
                        <View style={styles.formRow}><Text style={styles.label}>DOB</Text><TouchableOpacity onPress={() => showDatePicker('dob')} style={styles.input}><Text style={styles.dateText}>{formData.dob ? formatDate(formData.dob) : 'Select Date'}</Text></TouchableOpacity></View>
                        
                        <View style={styles.formRow}><Text style={styles.label}>Phone No</Text><TextInput style={styles.input} value={formData.phone_no || ''} onChangeText={t => setFormData(p => ({...p, phone_no: t}))} keyboardType="phone-pad" /></View>
                        <View style={styles.formRow}><Text style={styles.label}>Present Status</Text><TextInput style={styles.input} value={formData.present_status || ''} onChangeText={t => setFormData(p => ({...p, present_status: t}))} placeholder="e.g., Engineer" /></View>
                        
                        <Text style={styles.sectionHeader}>School Details</Text>
                        <View style={styles.formRow}><Text style={styles.label}>Joined Date</Text><TouchableOpacity onPress={() => showDatePicker('school_joined_date')} style={styles.input}><Text style={styles.dateText}>{formData.school_joined_date ? formatDate(formData.school_joined_date) : 'Select Date'}</Text></TouchableOpacity></View>
                        <View style={styles.formRow}><Text style={styles.label}>Outgoing Date</Text><TouchableOpacity onPress={() => showDatePicker('school_outgoing_date')} style={styles.input}><Text style={styles.dateText}>{formData.school_outgoing_date ? formatDate(formData.school_outgoing_date) : 'Select Date'}</Text></TouchableOpacity></View>
                        
                        {pickerTarget && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}><Text style={{color: '#333'}}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}><Text style={styles.modalButtonText}>Save Record</Text></TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* --- Year Picker & Image Modal --- */}
            <YearPickerModal visible={yearPickerVisible} years={availableYears} selectedValue={filterYear} onSelect={handleYearSelect} onClose={() => setYearPickerVisible(false)} />
            <ImageEnlargerModal visible={enlargeModalVisible} uri={enlargeImageUri} onClose={() => setEnlargeModalVisible(false)} />

        </SafeAreaView>
    );
};

const AlumniCardItem: React.FC<{ item: AlumniRecord, onEdit: (item: AlumniRecord) => void, onDelete: (id: number) => void, isExpanded: boolean, onPress: () => void, onDpPress: (url: string) => void }> = ({ item, onEdit, onDelete, isExpanded, onPress, onDpPress }) => {
    const imageUri = item.profile_pic_url ? `${SERVER_URL}${item.profile_pic_url}` : undefined;
    
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
            <View style={styles.cardHeader}>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); if (imageUri) onDpPress(item.profile_pic_url!); }} disabled={!imageUri} style={styles.avatarWrapper}>
                    {imageUri ? <Image source={{ uri: imageUri }} style={styles.avatarImage} /> : <View style={[styles.avatarImage, styles.avatarFallback]}><FontAwesome name="user" size={24} color="#fff" /></View>}
                </TouchableOpacity>
                <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{item.alumni_name}</Text>
                    <Text style={styles.cardSubtitle}>ID: {item.admission_no}</Text>
                </View>
                <View style={styles.cardActions}>
                    {item.present_status && <View style={styles.statusTag}><Text style={styles.statusTagText}>{item.present_status}</Text></View>}
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onEdit(item); }} style={styles.iconButton}><MaterialIcons name="edit" size={20} color={COLORS.orange} /></TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDelete(item.id); }} style={styles.iconButton}><MaterialIcons name="delete" size={20} color={COLORS.danger} /></TouchableOpacity>
                    </View>
                </View>
            </View>
            <View style={styles.cardBody}>
                <InfoRow icon="phone" label="Phone" value={item.phone_no || 'N/A'} />
                <InfoRow icon="calendar" label="Joined" value={`${formatDate(item.school_joined_date)}`} />
                <InfoRow icon="school" label="Left" value={`${formatDate(item.school_outgoing_date)}`} />
            </View>
            {isExpanded && (
                <View style={styles.expandedContainer}>
                    <InfoRow icon="cake" label="D.O.B" value={formatDate(item.dob)} />
                    <InfoRow icon="badge" label="Aadhar" value={item.aadhar_no || 'N/A'} />
                    <InfoRow icon="person" label="Parent" value={item.parent_name || 'N/A'} />
                    <InfoRow icon="description" label="TC No" value={item.tc_number || 'N/A'} />
                    <InfoRow icon="place" label="Address" value={item.address || 'N/A'} isMultiLine={true} />
                </View>
            )}
        </TouchableOpacity>
    );
};

const InfoRow = ({ icon, label, value, isMultiLine = false }) => (
    <View style={[styles.infoRow, isMultiLine && { alignItems: 'flex-start' }]}>
        <MaterialIcons name={icon} size={16} color={COLORS.textSub} style={[styles.infoIcon, isMultiLine && { marginTop: 2 }]} />
        <Text style={styles.infoLabel}>{label}:</Text>
        <Text style={styles.infoValue} numberOfLines={isMultiLine ? undefined : 1}>{value}</Text>
    </View>
);

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
    statusTag: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 5, borderWidth: 1, borderColor: '#C8E6C9' }, 
    statusTagText: { color: COLORS.success, fontSize: 10, fontWeight: 'bold' }, 
    cardBody: { padding: 15, paddingTop: 10 }, 
    expandedContainer: { paddingHorizontal: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 }, 
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, 
    infoIcon: { width: 20, textAlign: 'center', marginRight: 8 }, 
    infoLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMain, marginRight: 5 }, 
    infoValue: { fontSize: 13, color: COLORS.textSub, flex: 1 }, 
    
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50, opacity: 0.6 }, 
    emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.textSub, marginTop: 10 }, 
    emptySubText: { fontSize: 14, color: COLORS.textSub, marginTop: 4 }, 
    
    // --- MODAL STYLES ---
    modalContainer: { padding: 20 }, 
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain }, 
    sectionHeader: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginTop: 15, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
    formRow: { marginBottom: 15 },
    label: { fontSize: 14, color: COLORS.textSub, marginBottom: 5, fontWeight: '500' }, 
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, fontSize: 15, color: COLORS.textMain }, 
    dateText: { color: COLORS.textMain, fontSize: 15 }, 
    textArea: { height: 80, textAlignVertical: 'top' }, 
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 20 }, 
    modalButton: { paddingVertical: 12, borderRadius: 8, flex: 1, alignItems: 'center', elevation: 2 }, 
    cancelButton: { backgroundColor: '#e0e0e0', marginRight: 10 }, 
    saveButton: { backgroundColor: COLORS.primary, marginLeft: 10 }, 
    modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }, 
    imagePickerContainer: { alignItems: 'center', marginBottom: 20 }, 
    profileImage: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', marginBottom: 10, borderWidth: 2, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }, 
    imagePickerButton: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, alignItems: 'center' }, 
    imagePickerButtonText: { color: '#fff', marginLeft: 6, fontWeight: 'bold', fontSize: 12 }, 
});

// --- Year Picker Styles ---
const pickerStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    pickerContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 15, paddingHorizontal: 20, maxHeight: height * 0.6 },
    pickerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, textAlign: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 10 },
    scrollArea: { maxHeight: height * 0.4 },
    option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
    optionText: { fontSize: 16, color: COLORS.textMain },
    selectedOptionText: { fontWeight: 'bold', color: COLORS.primary },
    closeButton: { backgroundColor: '#f0f0f0', padding: 15, borderRadius: 10, marginTop: 15, marginBottom: Platform.OS === 'ios' ? 30 : 15, alignItems: 'center' },
    closeButtonText: { color: '#333', fontSize: 16, fontWeight: 'bold' },
});

// --- Image Enlarger Styles ---
const enlargeStyles = StyleSheet.create({
    modalBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: width * 0.9, height: height * 0.7 },
    closeButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }
});

export default AlumniScreen;