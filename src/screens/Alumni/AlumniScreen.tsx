import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator,
  Modal, ScrollView, TextInput, Platform, Image, LayoutAnimation, UIManager, Dimensions
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
                <Image 
                    source={{ uri }} 
                    style={enlargeStyles.fullImage} 
                    resizeMode="contain" 
                />
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
    
    // Sort years from newest to oldest
    const sortedYears = years.sort((a, b) => parseInt(b) - parseInt(a));

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={pickerStyles.pickerContainer}>
                    <Text style={pickerStyles.pickerTitle}>Select Outgoing Year</Text>
                    <ScrollView style={pickerStyles.scrollArea}>
                        {sortedYears.map((year) => (
                            <TouchableOpacity
                                key={year}
                                style={pickerStyles.option}
                                onPress={() => { onSelect(year); onClose(); }}
                            >
                                <Text style={[pickerStyles.optionText, year === selectedValue && pickerStyles.selectedOptionText]}>
                                    {year}
                                </Text>
                                {year === selectedValue && <MaterialIcons name="check" size={20} color="#00796B" />}
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

    // Hardcoding sort to name ASC since explicit sorting dropdown was removed
    const sortBy = 'alumni_name';
    const sortOrder = 'ASC';

    // --- Data Fetching Logic ---
    const fetchData = useCallback(async (isSearch: boolean = false) => {
        if (isSearch) setIsSearching(true); else setLoading(true);

        try {
            const params = {
                search: searchText,
                sortBy: sortBy, 
                sortOrder: sortOrder,
                year: filterYear
            };

            const response = await apiClient.get('/alumni', { params });
            const data = response.data;
            setAlumniData(data);
            
            // Extract unique years 
            const years = data
                .map((item: AlumniRecord) => item.school_outgoing_date ? new Date(item.school_outgoing_date).getFullYear().toString() : null)
                .filter((year: string | null): year is string => year !== null);

            // Add the current year and get unique values
            const uniqueYears = Array.from(new Set([...years, (getCurrentYear() - 1).toString(), getCurrentYear().toString(), (getCurrentYear() + 1).toString()]));
            setAvailableYears(uniqueYears);

        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch alumni data.');
        } finally {
            if (isSearch) setIsSearching(false); else setLoading(false);
        }
    }, [searchText, filterYear]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleOpenModal = (item: AlumniRecord | null = null) => {
        setSelectedImage(null);
        if (item) {
            setIsEditing(true);
            setCurrentItem(item);
            setFormData(item);
        } else {
            setIsEditing(false);
            setCurrentItem(null);
            setFormData(initialFormState);
        }
        setModalVisible(true);
    };
    
    const handleChoosePhoto = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (response: ImagePickerResponse) => {
            if (response.didCancel) { console.log('User cancelled image picker');
            } else if (response.errorCode) { Alert.alert('ImagePicker Error', response.errorMessage || 'An error occurred');
            } else if (response.assets && response.assets.length > 0) { setSelectedImage(response.assets[0]); }
        });
    };

    const handleSave = async () => {
        if (!formData.admission_no || !formData.alumni_name) {
            return Alert.alert('Validation Error', 'Admission Number and Name are required.');
        }

        const data = new FormData();
        Object.keys(formData).forEach(key => {
            const value = formData[key as keyof AlumniRecord];
            if (value !== null && value !== undefined) {
                data.append(key, String(value));
            }
        });

        if (selectedImage?.uri) {
            data.append('profile_pic', { 
                uri: selectedImage.uri, 
                type: selectedImage.type || 'image/jpeg', 
                name: selectedImage.fileName || 'profile_pic.jpg' 
            } as any);
        }
        
        try {
            let response;
            if (isEditing && currentItem) {
                response = await apiClient.put(`/alumni/${currentItem.id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                response = await apiClient.post('/alumni', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            
            Alert.alert('Success', response.data.message || 'Record saved successfully.');
            setModalVisible(false);
            fetchData();
        } catch (error: any) {
            console.error(error.response?.data);
            Alert.alert('Save Error', error.response?.data?.message || 'An error occurred during save.');
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this record?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    const response = await apiClient.delete(`/alumni/${id}`);
                    Alert.alert("Success", response.data.message || 'Record deleted.');
                    fetchData();
                } catch (error: any) {
                    Alert.alert('Delete Error', error.response?.data?.message || 'Failed to delete record.');
                }
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
        if (event.type === 'set' && selectedDate && pickerTarget) {
            setFormData(prev => ({ ...prev, [pickerTarget]: toYYYYMMDD(selectedDate) }));
        }
    };

    const handleImageEnlarge = (url: string) => {
        setEnlargeImageUri(`${SERVER_URL}${url}`);
        setEnlargeModalVisible(true);
    };
    
    const handleYearSelect = (year: string) => {
        setFilterYear(year);
    }
    
    // Function passed to the card for expansion
    const handleCardPress = (id: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedCardId(prevId => (prevId === id ? null : id));
    };


    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color="#00796B" /></View>;
    }

    return (
        <View style={styles.container}>
            
            {/* --- Header & Search --- */}
            <View style={styles.topContainer}>
                <View style={styles.header}>
                    <View style={styles.headerIconContainer}><FontAwesome name="graduation-cap" size={24} color="#00796B" /></View>
                    <View><Text style={styles.headerTitle}>Alumni Network</Text><Text style={styles.headerSubtitle}>Manage and view alumni records</Text></View>
                </View>
                
                <View style={styles.searchFilterContainer}>
                    <View style={styles.searchWrapper}>
                        <FontAwesome name="search" size={18} color="#9E9E9E" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by Name, ID, or Status..."
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholderTextColor="#9E9E9E"
                            autoCapitalize="none"
                            onSubmitEditing={() => fetchData(true)}
                        />
                        {isSearching && <ActivityIndicator size="small" color="#00796B" style={styles.loadingIndicator} />}
                    </View>
                    <TouchableOpacity style={styles.filterButton} onPress={() => setYearPickerVisible(true)}>
                        <Text style={styles.filterButtonText}>{filterYear}</Text>
                    </TouchableOpacity>
                </View>
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
                        onPress={() => handleCardPress(item.id)} // Use the dedicated expansion handler
                        onDpPress={handleImageEnlarge} 
                    />
                )}
                ListEmptyComponent={<View style={styles.emptyContainer}><MaterialIcons name="school" size={80} color="#CFD8DC" /><Text style={styles.emptyText}>No Alumni Found</Text><Text style={styles.emptySubText}>Try adjusting your year or search filters.</Text></View>}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            />

            <TouchableOpacity style={styles.fab} onPress={() => handleOpenModal()}><MaterialIcons name="add" size={24} color="#fff" /></TouchableOpacity>

            {/* --- Add/Edit Modal (Existing) --- */}
            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <ScrollView style={styles.modalContainer} contentContainerStyle={{paddingBottom: 50}}>
                    <Text style={styles.modalTitle}>{isEditing ? 'Edit Alumni Record' : 'Add New Alumni'}</Text>
                    <View style={styles.imagePickerContainer}>
                        {selectedImage?.uri || formData.profile_pic_url ? (
                            <Image 
                                source={selectedImage?.uri ? { uri: selectedImage.uri } : { uri: `${SERVER_URL}${formData.profile_pic_url}` }}
                                style={styles.profileImage} 
                            />
                        ) : (
                            <View style={[styles.profileImage, styles.avatarFallback]}>
                                <FontAwesome name="user-circle" size={80} color="#757575" />
                            </View>
                        )}
                        
                        <TouchableOpacity style={styles.imagePickerButton} onPress={handleChoosePhoto}>
                            <FontAwesome name="camera" size={16} color="#fff" />
                            <Text style={styles.imagePickerButtonText}>Choose Photo</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.label}>Admission No*</Text><TextInput style={styles.input} value={formData.admission_no || ''} onChangeText={t => setFormData(p => ({...p, admission_no: t}))} />
                    <Text style={styles.label}>Alumni Name*</Text><TextInput style={styles.input} value={formData.alumni_name || ''} onChangeText={t => setFormData(p => ({...p, alumni_name: t}))} />
                    <Text style={styles.label}>Date of Birth</Text><TouchableOpacity onPress={() => showDatePicker('dob')} style={styles.input}><Text style={styles.dateText}>{formData.dob ? formatDate(formData.dob) : 'Select Date'}</Text></TouchableOpacity>
                    <Text style={styles.label}>Pen No</Text><TextInput style={styles.input} value={formData.pen_no || ''} onChangeText={t => setFormData(p => ({...p, pen_no: t}))} />
                    <Text style={styles.label}>Phone No</Text><TextInput style={styles.input} value={formData.phone_no || ''} onChangeText={t => setFormData(p => ({...p, phone_no: t}))} keyboardType="phone-pad" />
                    <Text style={styles.label}>Aadhar No</Text><TextInput style={styles.input} value={formData.aadhar_no || ''} onChangeText={t => setFormData(p => ({...p, aadhar_no: t}))} keyboardType="numeric" />
                    <Text style={styles.label}>Parent Name</Text><TextInput style={styles.input} value={formData.parent_name || ''} onChangeText={t => setFormData(p => ({...p, parent_name: t}))} />
                    <Text style={styles.label}>Parent No</Text><TextInput style={styles.input} value={formData.parent_phone || ''} onChangeText={t => setFormData(p => ({...p, parent_phone: t}))} keyboardType="phone-pad" />
                    <Text style={styles.label}>Address</Text><TextInput style={[styles.input, styles.textArea]} value={formData.address || ''} onChangeText={t => setFormData(p => ({...p, address: t}))} multiline />
                    <Text style={styles.label}>School Joined Date</Text><TouchableOpacity onPress={() => showDatePicker('school_joined_date')} style={styles.input}><Text style={styles.dateText}>{formData.school_joined_date ? formatDate(formData.school_joined_date) : 'Select Date'}</Text></TouchableOpacity>
                    <Text style={styles.label}>School Joined Grade</Text><TextInput style={styles.input} value={formData.school_joined_grade || ''} onChangeText={t => setFormData(p => ({...p, school_joined_grade: t}))} />
                    <Text style={styles.label}>School Outgoing Date</Text><TouchableOpacity onPress={() => showDatePicker('school_outgoing_date')} style={styles.input}><Text style={styles.dateText}>{formData.school_outgoing_date ? formatDate(formData.school_outgoing_date) : 'Select Date'}</Text></TouchableOpacity>
                    <Text style={styles.label}>School Outgoing Grade</Text><TextInput style={styles.input} value={formData.school_outgoing_grade || ''} onChangeText={t => setFormData(p => ({...p, school_outgoing_grade: t}))} />
                    <Text style={styles.label}>TC Issued Date</Text><TouchableOpacity onPress={() => showDatePicker('tc_issued_date')} style={styles.input}><Text style={styles.dateText}>{formData.tc_issued_date ? formatDate(formData.tc_issued_date) : 'Select Date'}</Text></TouchableOpacity>
                    <Text style={styles.label}>TC Number</Text><TextInput style={styles.input} value={formData.tc_number || ''} onChangeText={t => setFormData(p => ({...p, tc_number: t}))} />
                    <Text style={styles.label}>Present Status</Text><TextInput style={styles.input} value={formData.present_status || ''} onChangeText={t => setFormData(p => ({...p, present_status: t}))} placeholder="e.g., Software engineer, Doctor" />
                    
                    {pickerTarget && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}
                    
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
                    </View>
                </ScrollView>
            </Modal>

            {/* --- Year Picker Modal --- */}
            <YearPickerModal 
                visible={yearPickerVisible} 
                years={availableYears} 
                selectedValue={filterYear} 
                onSelect={handleYearSelect}
                onClose={() => setYearPickerVisible(false)}
            />

            {/* --- Image Enlarge Modal --- */}
            <ImageEnlargerModal 
                visible={enlargeModalVisible} 
                uri={enlargeImageUri} 
                onClose={() => setEnlargeModalVisible(false)} 
            />

        </View>
    );
};

const AlumniCardItem: React.FC<{ item: AlumniRecord, onEdit: (item: AlumniRecord) => void, onDelete: (id: number) => void, isExpanded: boolean, onPress: () => void, onDpPress: (url: string) => void }> = ({ item, onEdit, onDelete, isExpanded, onPress, onDpPress }) => {
    
    const imageUri = item.profile_pic_url ? `${SERVER_URL}${item.profile_pic_url}` : undefined;
    
    return (
        // 1. The main card wrapper handles expansion (onPress prop from parent)
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
                {/* 2. DP Enlargement touchable wrapper */}
                <TouchableOpacity 
                    onPress={(e) => { 
                        // CRITICAL: Stop propagation so tapping the DP doesn't trigger card expansion
                        e.stopPropagation(); 
                        if (imageUri) onDpPress(item.profile_pic_url!); 
                    }} 
                    disabled={!imageUri}
                    style={styles.avatarWrapper}
                >
                    {imageUri ? (
                        <Image 
                            source={{ uri: imageUri }} 
                            style={styles.avatarImage} 
                        />
                    ) : (
                        <View style={[styles.avatarImage, styles.avatarFallback]}>
                            <FontAwesome name="user" size={30} color="#607D8B" />
                        </View>
                    )}
                </TouchableOpacity>
                <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{item.alumni_name}</Text>
                    <Text style={styles.cardSubtitle}>Admission No: {item.admission_no}</Text>
                </View>
                <View style={styles.cardActions}>
                    {item.present_status && <View style={styles.statusTag}><Text style={styles.statusTagText}>{item.present_status}</Text></View>}
                    {/* Ensure Edit/Delete buttons also stop propagation */}
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onEdit(item); }} style={styles.iconButton}><FontAwesome name="pencil" size={18} color="#FFA000" /></TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDelete(item.id); }} style={styles.iconButton}><FontAwesome name="trash" size={18} color="#D32F2F" /></TouchableOpacity>
                    </View>
                </View>
            </View>
            <View style={styles.cardBody}>
                <InfoRow icon="phone" label="Phone" value={item.phone_no || 'N/A'} />
                <InfoRow icon="calendar-plus-o" label="Joined" value={`${formatDate(item.school_joined_date)} (${item.school_joined_grade || 'N/A'})`} />
                <InfoRow icon="calendar-times-o" label="Left" value={`${formatDate(item.school_outgoing_date)} (${item.school_outgoing_grade || 'N/A'})`} />
            </View>
            {isExpanded && (
                <View style={styles.expandedContainer}>
                    <InfoRow icon="birthday-cake" label="D.O.B" value={formatDate(item.dob)} />
                    <InfoRow icon="id-card-o" label="Pen No" value={item.pen_no || 'N/A'} />
                    <InfoRow icon="vcard" label="Aadhar" value={item.aadhar_no || 'N/A'} />
                    <InfoRow icon="user" label="Parent" value={item.parent_name || 'N/A'} />
                    <InfoRow icon="mobile" label="Parent No" value={item.parent_phone || 'N/A'} />
                    <InfoRow icon="file-text-o" label="TC No" value={item.tc_number || 'N/A'} />
                    <InfoRow icon="calendar-check-o" label="TC Issued" value={formatDate(item.tc_issued_date)} />
                    <InfoRow icon="map-marker" label="Address" value={item.address || 'N/A'} isMultiLine={true} />
                </View>
            )}
        </TouchableOpacity>
    );
};

const InfoRow = ({ icon, label, value, isMultiLine = false }) => (<View style={[styles.infoRow, isMultiLine && { alignItems: 'flex-start' }]}><FontAwesome name={icon} size={15} color="#757575" style={[styles.infoIcon, isMultiLine && { marginTop: 3 }]} /><Text style={styles.infoLabel}>{label}:</Text><Text style={styles.infoValue} numberOfLines={isMultiLine ? undefined : 1}>{value}</Text></View>);

const styles = StyleSheet.create({ 
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4F7' }, 
    container: { flex: 1, backgroundColor: '#F0F4F7' }, 
    
    // Header & Search Styles
    topContainer: {
        backgroundColor: '#FFFFFF',
        paddingTop: Platform.OS === 'android' ? 10 : 0,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        marginBottom: 8,
    },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 10,
    }, 
    headerIconContainer: { 
        width: 45, height: 45, borderRadius: 22.5, 
        backgroundColor: '#E0F2F1', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginRight: 16 
    }, 
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#004D40' }, 
    headerSubtitle: { fontSize: 14, color: '#00796B' },

    searchFilterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 15,
    },
    searchWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECEFF1',
        borderRadius: 25,
        paddingHorizontal: 15,
        height: 45,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        paddingVertical: Platform.OS === 'ios' ? 10 : 0,
    },
    loadingIndicator: {
        marginLeft: 10,
    },
    filterButton: {
        marginLeft: 10,
        backgroundColor: '#00796B',
        width: 70, 
        height: 45,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },


    // Card Styles
    card: { 
        backgroundColor: '#FFFFFF', 
        borderRadius: 12, 
        marginVertical: 6, 
        elevation: 3, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.15, 
        shadowRadius: 5, 
        overflow: 'hidden' 
    }, 
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16 }, 
    avatarWrapper: {
        marginRight: 12, 
    },
    avatarImage: { 
        width: 55, height: 55, borderRadius: 27.5, 
        backgroundColor: '#E0E0E0', 
        borderWidth: 2, borderColor: '#B0BEC5',
        justifyContent: 'center', 
        alignItems: 'center',
    }, 
    avatarFallback: {
        backgroundColor: '#CFD8DC',
    },
    cardHeaderText: { flex: 1, justifyContent: 'center', marginTop: 4 }, 
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#212121' }, 
    cardSubtitle: { fontSize: 14, color: '#607D8B', marginTop: 2 }, 
    cardActions: { alignItems: 'flex-end' }, 
    buttonGroup: { flexDirection: 'row', marginTop: 8 }, 
    iconButton: { marginLeft: 16, padding: 2 }, 
    statusTag: { backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15, marginBottom: 5 }, 
    statusTagText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }, 
    cardBody: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 }, 
    expandedContainer: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#ECEFF1', marginTop: 10, paddingTop: 10 }, 
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, 
    infoIcon: { width: 20, textAlign: 'center' }, 
    infoLabel: { fontSize: 14, fontWeight: '600', color: '#424242', marginLeft: 10 }, 
    infoValue: { fontSize: 14, color: '#546E7A', flex: 1, marginLeft: 5, flexWrap: 'wrap' }, 
    
    // FAB and Empty State
    fab: { position: 'absolute', right: 25, bottom: 25, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0288D1', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowRadius: 5, shadowOpacity: 0.3 }, 
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: '30%', opacity: 0.6 }, 
    emptyText: { fontSize: 18, fontWeight: '600', color: '#78909C', marginTop: 16 }, 
    emptySubText: { fontSize: 14, color: '#78909C', marginTop: 4 }, 
    
    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: '#f9f9f9', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingHorizontal: 20 }, 
    modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 25, textAlign: 'center', color: '#212121' }, 
    label: { fontSize: 16, color: '#555', marginBottom: 8, marginTop: 12, fontWeight: '600' }, 
    input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFD8DC', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginBottom: 10, fontSize: 16, color: '#333' }, 
    dateText: { color: '#333', fontSize: 16, paddingVertical: 4 }, 
    textArea: { height: 100, textAlignVertical: 'top' }, 
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 50 }, 
    modalButton: { paddingVertical: 14, borderRadius: 8, flex: 1, alignItems: 'center', elevation: 2 }, 
    cancelButton: { backgroundColor: '#9E9E9E', marginRight: 10 }, 
    saveButton: { backgroundColor: '#0288D1', marginLeft: 10 }, 
    modalButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }, 
    imagePickerContainer: { alignItems: 'center', marginBottom: 20 }, 
    profileImage: { 
        width: 120, height: 120, borderRadius: 60, 
        backgroundColor: '#E0E0E0', marginBottom: 10, 
        borderWidth: 3, borderColor: '#0288D1',
        justifyContent: 'center',
        alignItems: 'center',
    }, 
    imagePickerButton: { flexDirection: 'row', backgroundColor: '#0288D1', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' }, 
    imagePickerButtonText: { color: '#fff', marginLeft: 10, fontWeight: 'bold' }, 
});

// --- Year Picker Styles ---
const pickerStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    pickerContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 15,
        paddingHorizontal: 20,
        maxHeight: height * 0.7,
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#212121',
        textAlign: 'center',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        paddingBottom: 10,
    },
    scrollArea: {
        maxHeight: height * 0.5,
    },
    option: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    optionText: {
        fontSize: 16,
        color: '#333',
    },
    selectedOptionText: {
        fontWeight: 'bold',
        color: '#00796B',
    },
    closeButton: {
        backgroundColor: '#0288D1',
        padding: 15,
        borderRadius: 10,
        marginTop: 15,
        marginBottom: Platform.OS === 'ios' ? 30 : 15,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
    },
});


// --- Image Enlarger Styles ---
const enlargeStyles = StyleSheet.create({
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: width * 0.9,
        height: height * 0.7,
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 10,
        padding: 10,
    }
});


export default AlumniScreen;