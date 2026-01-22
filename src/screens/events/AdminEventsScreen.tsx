import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView, Platform, SafeAreaView, UIManager, LayoutAnimation } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; // For Header Icon consistency
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
    tag_bg: '#E0F2F1',
    tag_text: '#00695C'
};

const THEME = {
    ...COLORS,
    white: '#ffffff',
    shadow: '#000'
};

const parseServerDateTime = (dateTimeString) => {
    if (!dateTimeString) return new Date();
    if (String(dateTimeString).includes('T') && String(dateTimeString).includes('Z')) {
        return new Date(dateTimeString);
    }
    const parts = String(dateTimeString).match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (parts) {
        return new Date(parts[1], parseInt(parts[2], 10) - 1, parts[3], parts[4], parts[5], parts[6]);
    }
    return new Date();
};

const formatDateTimeForServer = (date) => {
    const pad = (num) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day} ${hours}:${minutes}:00`;
};

// Main Component
const AdminEventsScreen = () => {
    const [view, setView] = useState('list'); 
    const [eventToEdit, setEventToEdit] = useState(null);
    const { user } = useAuth();
    
    const handleBack = () => {
        setEventToEdit(null);
        setView('list');
    };

    const handleCreate = () => {
        setEventToEdit(null);
        setView('form');
    };

    const handleEdit = (event) => {
        setEventToEdit(event);
        setView('form');
    };

    return (
        <SafeAreaView style={styles.container}>
            {view === 'list' && <EventListView user={user} onCreate={handleCreate} onEdit={handleEdit} />}
            {view === 'form' && <EventForm onBack={handleBack} user={user} eventToEdit={eventToEdit} />}
        </SafeAreaView>
    );
};

// Admin Event List
const EventListView = ({ user, onCreate, onEdit }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedEventId, setExpandedEventId] = useState(null);

    const fetchData = useCallback(() => {
        setLoading(true);
        apiClient.get('/events/all-for-admin')
            .then(response => setEvents(response.data))
            .catch(err => Alert.alert("Error", "Could not load events."))
            .finally(() => setLoading(false));
    }, []);

    useFocusEffect(fetchData);

    const toggleExpand = (eventId) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedEventId(expandedEventId === eventId ? null : eventId);
    };

    const handleDelete = (eventId) => {
        Alert.alert(
            "Delete Event",
            "Are you sure you want to permanently delete this event?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/events/${eventId}`, { data: { userId: user.id } });
                            Alert.alert("Success", "Event deleted.");
                            fetchData();
                        } catch (error) {
                            Alert.alert("Error", error.response?.data?.message || "Could not delete event.");
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={{flex: 1, backgroundColor: COLORS.background}}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="event" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Events</Text>
                        <Text style={styles.headerSubtitle}>Manage School Calendar</Text>
                    </View>
                </View>
                
                <TouchableOpacity style={styles.headerBtn} onPress={onCreate}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 40}} /> :
            <FlatList
                data={events}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                    <AdminEventCard
                        event={item}
                        currentUser={user}
                        isExpanded={expandedEventId === item.id}
                        onPress={() => toggleExpand(item.id)}
                        onEdit={() => onEdit(item)}
                        onDelete={() => handleDelete(item.id)}
                    />
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No events found.</Text>}
                contentContainerStyle={styles.listContainer}
            />}
        </View>
    );
};

// Admin Event Card
const AdminEventCard = ({ event, currentUser, isExpanded, onPress, onEdit, onDelete }) => {
    const date = parseServerDateTime(event.event_datetime);
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const isCreator = event.created_by === currentUser.id || currentUser.role === 'admin';

    return (
        <Animatable.View animation="fadeInUp" duration={500} style={styles.card}>
            <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
                <View style={styles.cardContent}>
                    <View style={styles.dateBlock}>
                        <Text style={styles.dateMonth}>{month}</Text>
                        <Text style={styles.dateDay}>{day}</Text>
                    </View>
                    <View style={styles.detailsBlock}>
                        <View style={styles.tagContainer}>
                            <Text style={styles.tagText}>{event.target_class}</Text>
                        </View>
                        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
                        <View style={styles.detailRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.textSub} />
                            <Text style={styles.detailText}>{event.location || 'TBD'}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.expandedContainer}>
                    <InfoRow icon="clock-outline" text={time} />
                    {event.creator_name && <InfoRow icon="account-circle-outline" text={`Created by: ${event.creator_name}`} />}
                    {event.description ? <InfoRow icon="text" text={event.description} /> : <InfoRow icon="text" text="No description." />}
                    
                    {isCreator && (
                        <View style={styles.actionsContainer}>
                            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: COLORS.success}]} onPress={onEdit}>
                                <MaterialCommunityIcons name="pencil-outline" size={16} color={COLORS.white} />
                                <Text style={styles.actionBtnText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: COLORS.danger}]} onPress={onDelete}>
                                <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.white} />
                                <Text style={styles.actionBtnText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}
        </Animatable.View>
    );
};

const InfoRow = ({ icon, text }) => (
    <View style={styles.infoRow}>
        <MaterialCommunityIcons name={icon} size={16} color={COLORS.textSub} style={styles.infoRowIcon} />
        <Text style={styles.infoRowText}>{text}</Text>
    </View>
);

// Form Component
const EventForm = ({ onBack, user, eventToEdit }) => {
    const isEditMode = !!eventToEdit;
    const initialDate = isEditMode ? parseServerDateTime(eventToEdit.event_datetime) : new Date();

    const [title, setTitle] = useState(isEditMode ? eventToEdit.title : '');
    const [category, setCategory] = useState(isEditMode ? eventToEdit.category : '');
    const [location, setLocation] = useState(isEditMode ? eventToEdit.location : '');
    const [description, setDescription] = useState(isEditMode ? eventToEdit.description : '');
    const [targetClass, setTargetClass] = useState(isEditMode ? eventToEdit.target_class : 'All');
    const [classes, setClasses] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [date, setDate] = useState(initialDate);
    const [showPicker, setShowPicker] = useState(false);
    const [mode, setMode] = useState('date');

    useEffect(() => {
        apiClient.get('/classes').then(res => setClasses(['All', ...res.data]));
    }, []);

    const onChangeDateTime = (event, selectedValue) => {
        setShowPicker(Platform.OS === 'ios');
        const currentDate = selectedValue || date;
        if (selectedValue) { setDate(new Date(currentDate)); }
    };

    const showMode = (currentMode) => {
        setShowPicker(true);
        setMode(currentMode);
    };

    const handleSubmit = async () => {
        if (!title.trim()) return Alert.alert("Heads up!", "Event Title is required.");
        setIsSaving(true);
        const event_datetime = formatDateTimeForServer(date);
        const payload = { title, category, event_datetime, location, description, target_class: targetClass, userId: user.id };
        try {
            if (isEditMode) {
                await apiClient.put(`/events/${eventToEdit.id}`, payload);
                Alert.alert("Success!", "Event has been updated.");
            } else {
                await apiClient.post('/events', { ...payload, created_by: user.id });
                Alert.alert("Success!", "Event has been published.");
            }
            onBack();
        } catch (error) {
            Alert.alert("Submission Failed", error.response?.data?.message || "An error occurred.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const getFormattedDate = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

    return (
        <View style={{flex: 1, backgroundColor: COLORS.background}}>
            {/* --- HEADER CARD (Form) --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="edit-calendar" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>{isEditMode ? "Edit Event" : "New Event"}</Text>
                        <Text style={styles.headerSubtitle}>Event Details</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
                <FormInput icon="format-title" placeholder="Event Title *" value={title} onChangeText={setTitle} />
                <FormInput icon="tag-outline" placeholder="Category (e.g., Academic)" value={category} onChangeText={setCategory} />
                
                <Text style={styles.label}>Date & Time *</Text>
                <View style={styles.dateTimePickerContainer}>
                    <TouchableOpacity style={styles.dateTimePickerButton} onPress={() => showMode('date')}>
                        <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
                        <Text style={styles.dateTimePickerText}>{getFormattedDate(date)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateTimePickerButton} onPress={() => showMode('time')}>
                        <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
                        <Text style={styles.dateTimePickerText}>{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</Text>
                    </TouchableOpacity>
                </View>
                
                <Text style={styles.label}>Target Class</Text>
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={targetClass} onValueChange={(itemValue) => setTargetClass(itemValue)} style={styles.picker}>
                        {classes.map((c) => <Picker.Item key={c} label={c} value={c} />)}
                    </Picker>
                </View>
                
                <FormInput icon="map-marker-outline" placeholder="Location" value={location} onChangeText={setLocation} />
                <FormInput icon="text" placeholder="Description..." multiline value={description} onChangeText={setDescription} />
                
                <TouchableOpacity onPress={handleSubmit} disabled={isSaving} style={styles.publishButton}>
                    {isSaving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.publishButtonText}>{isEditMode ? "Save Changes" : "Publish Event"}</Text>}
                </TouchableOpacity>
                
                {showPicker && <DateTimePicker value={date} mode={mode} is24Hour={false} display="default" onChange={onChangeDateTime} />}
            </ScrollView>
        </View>
    );
};

const FormInput = ({ icon, ...props }) => (
    <View style={styles.inputContainer}>
        <MaterialCommunityIcons name={icon} size={20} color={COLORS.textSub} style={styles.inputIcon} />
        <TextInput style={[styles.input, props.multiline && { height: 100, textAlignVertical: 'top', paddingTop: 10 }]} placeholderTextColor={COLORS.textSub} {...props}/>
    </View>
);

const styles = StyleSheet.create({
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

    // List & Cards
    listContainer: { paddingHorizontal: 15, paddingBottom: 100, paddingTop: 5 },
    card: { backgroundColor: COLORS.cardBg, borderRadius: 12, marginBottom: 15, elevation: 2, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, overflow: 'hidden' },
    cardContent: { flexDirection: 'row', padding: 15 },
    dateBlock: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2F1', borderRadius: 10, paddingVertical: 8, width: 60, height: 65, marginRight: 15 },
    dateMonth: { fontSize: 12, color: '#00695C', fontWeight: 'bold', textTransform: 'uppercase' },
    dateDay: { fontSize: 24, color: '#004D40', fontWeight: 'bold', marginTop: -2 },
    detailsBlock: { flex: 1, justifyContent: 'center' },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, marginTop: 4, marginBottom: 4 },
    
    tagContainer: { alignSelf: 'flex-start', backgroundColor: '#f0fdfa', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 4, borderWidth: 1, borderColor: '#ccfbf1' },
    tagText: { color: '#00796B', fontSize: 10, fontWeight: '700' },
    
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    detailText: { fontSize: 13, color: COLORS.textSub, marginLeft: 5 },
    
    expandedContainer: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingHorizontal: 15, paddingTop: 10, paddingBottom: 15 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    infoRowIcon: { marginRight: 8, marginTop: 2 },
    infoRowText: { flex: 1, fontSize: 13, color: COLORS.textMain, lineHeight: 18 },
    
    actionsContainer: { flexDirection: 'row', marginTop: 10, gap: 10 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 5 },
    actionBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 12 },
    
    emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.textSub, fontSize: 16 },

    // Form
    formContainer: { paddingHorizontal: 15, paddingBottom: 40 },
    label: { fontSize: 14, color: COLORS.textSub, fontWeight: '600', marginBottom: 8, marginLeft: 4, marginTop: 10 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 15 },
    inputIcon: { marginHorizontal: 10 },
    input: { flex: 1, paddingVertical: 10, paddingRight: 10, fontSize: 15, color: COLORS.textMain },
    
    dateTimePickerContainer: { flexDirection: 'row', marginBottom: 15, justifyContent: 'space-between', gap: 10 },
    dateTimePickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, flex: 1, justifyContent: 'center', gap: 8 },
    dateTimePickerText: { fontSize: 14, color: COLORS.textMain },
    
    pickerContainer: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, marginBottom: 15, backgroundColor: '#FFF', justifyContent: 'center' },
    picker: { height: 50 },
    
    publishButton: { backgroundColor: COLORS.primary, paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, elevation: 2 },
    publishButtonText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
});

export default AdminEventsScreen;