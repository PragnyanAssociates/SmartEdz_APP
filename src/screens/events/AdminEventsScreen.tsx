import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

const PURPLE_THEME = { primary: '#6200EE', textDark: '#212121', textLight: '#757575', danger: '#c62828' };

// Main Screen Component
const AdminEventsScreen = () => {
    const [view, setView] = useState('list');
    const [selectedEvent, setSelectedEvent] = useState(null);
    const { user } = useAuth();
    const handleBack = () => { setView('list'); setSelectedEvent(null); };
    const handleSelectEvent = (event) => { setSelectedEvent(event); setView('details'); };
    const refreshList = () => fetchData(); // Function to allow child components to refresh the list

    // This function will be passed down to the list view
    const [fetchData, setFetchData] = useState(() => () => {});

    return (
        <View style={styles.container}>
            {view === 'list' && <EventListView onSelect={handleSelectEvent} onCreate={() => setView('create')} setFetchData={setFetchData} />}
            {view === 'details' && <EventDetailsView event={selectedEvent} onBack={handleBack} />}
            {view === 'create' && <CreateEventForm onBack={handleBack} editorId={user.id} onCreated={refreshList} />}
        </View>
    );
};

// Event List View (Simplified)
const EventListView = ({ onSelect, onCreate, setFetchData }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchDataCallback = useCallback(() => {
        setLoading(true);
        apiClient.get('/events/all-for-admin')
            .then(response => setEvents(response.data))
            .catch(err => Alert.alert("Error", err.response?.data?.message || "Could not load events."))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        setFetchData(() => fetchDataCallback);
    }, [fetchDataCallback, setFetchData]);

    useFocusEffect(fetchDataCallback);

    return (
        <View style={{flex: 1}}>
            <TouchableOpacity style={styles.createButton} onPress={onCreate}>
                <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" /><Text style={styles.createButtonText}>Create New Event</Text>
            </TouchableOpacity>
            {loading ? <ActivityIndicator size="large" color={PURPLE_THEME.primary} /> :
            <FlatList
                data={events}
                keyExtractor={item => item.id.toString()}
                renderItem={({item}) => (
                    <TouchableOpacity style={styles.card} onPress={() => onSelect(item)}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardDetail}>For: {item.target_class}</Text>
                        <Text style={styles.cardDetail}>Date: {new Date(item.event_datetime).toLocaleString()}</Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No events created yet.</Text>}
                contentContainerStyle={{padding: 15}}
            />}
        </View>
    );
};

// Event Details View (Simplified - No RSVPs)
const EventDetailsView = ({ event, onBack }) => {
    return (
        <ScrollView style={{flex: 1}}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <MaterialCommunityIcons name="arrow-left" size={22} color={PURPLE_THEME.primary} /><Text style={styles.backButtonText}>Back to Events</Text>
            </TouchableOpacity>
            <View style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>{event.title}</Text>
                <InfoRow icon="tag-outline" label="Category" value={event.category || 'N/A'} />
                <InfoRow icon="account-group-outline" label="Target Class" value={event.target_class} />
                <InfoRow icon="calendar-clock" label="Date & Time" value={new Date(event.event_datetime).toLocaleString()} />
                <InfoRow icon="map-marker-outline" label="Location" value={event.location || 'N/A'} />
                <Text style={styles.descriptionTitle}>Description</Text>
                <Text style={styles.descriptionText}>{event.description || 'No description provided.'}</Text>
            </View>
        </ScrollView>
    );
};

const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
        <MaterialCommunityIcons name={icon} size={20} color={PURPLE_THEME.textLight} style={styles.infoIcon} />
        <View>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
        </View>
    </View>
);

// Create Event Form (Heavily Modified)
const CreateEventForm = ({ onBack, editorId, onCreated }) => {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [targetClass, setTargetClass] = useState('All');
    const [classes, setClasses] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // --- Date & Time State ---
    const [date, setDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [mode, setMode] = useState('date'); // 'date' or 'time'

    useEffect(() => {
        // Fetch available classes from the backend when the component mounts.
        apiClient.get('/classes')
            .then(response => setClasses(['All', ...response.data]))
            .catch(() => Alert.alert("Error", "Could not fetch class list."));
    }, []);

    const onChangeDateTime = (event, selectedValue) => {
        setShowPicker(Platform.OS === 'ios');
        if (selectedValue) {
            const currentDate = selectedValue || date;
            setDate(currentDate);
        }
    };

    const showMode = (currentMode) => {
        setShowPicker(true);
        setMode(currentMode);
    };

    const handleSubmit = () => {
        if (!title.trim()) return Alert.alert("Error", "Event Title is required.");
        
        setIsSaving(true);
        // Format date to 'YYYY-MM-DD HH:MM:SS' for the database
        const event_datetime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;

        const payload = { title, category, event_datetime, location, description, created_by: editorId, target_class: targetClass };
        
        apiClient.post('/events', payload)
            .then(() => {
                Alert.alert("Success", "Event created successfully!");
                onCreated(); // Refresh the list on the previous screen
                onBack(); // Go back
            })
            .catch(err => Alert.alert("Error", err.response?.data?.message || "Could not create event."))
            .finally(() => setIsSaving(false));
    };

    return (
        <ScrollView contentContainerStyle={styles.formContainer}>
            <View style={styles.formHeader}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={PURPLE_THEME.primary} />
                    <Text style={styles.backButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.formTitle}>Create New Event</Text>
            </View>

            <TextInput placeholder="Event Title *" style={styles.input} value={title} onChangeText={setTitle} />
            <TextInput placeholder="Category (e.g., Academic, Cultural)" style={styles.input} value={category} onChangeText={setCategory} />
            
            {/* --- Date & Time Picker --- */}
            <Text style={styles.pickerLabel}>Select Date & Time *</Text>
            <View style={styles.dateTimePickerContainer}>
                <TouchableOpacity style={styles.dateTimePickerButton} onPress={() => showMode('date')}>
                    <MaterialCommunityIcons name="calendar" size={20} color={PURPLE_THEME.primary} />
                    <Text style={styles.dateTimePickerText}>{date.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateTimePickerButton} onPress={() => showMode('time')}>
                    <MaterialCommunityIcons name="clock-outline" size={20} color={PURPLE_THEME.primary} />
                    <Text style={styles.dateTimePickerText}>{date.toLocaleTimeString()}</Text>
                </TouchableOpacity>
            </View>
            {showPicker && (
                <DateTimePicker
                    testID="dateTimePicker"
                    value={date}
                    mode={mode}
                    is24Hour={true}
                    display="default"
                    onChange={onChangeDateTime}
                />
            )}

            {/* --- Class Picker --- */}
            <Text style={styles.pickerLabel}>Select Target Class</Text>
            <View style={styles.pickerContainer}>
                <Picker
                    selectedValue={targetClass}
                    onValueChange={(itemValue) => setTargetClass(itemValue)}
                    style={styles.picker}
                >
                    {classes.map((c, index) => <Picker.Item key={index} label={c} value={c} />)}
                </Picker>
            </View>
            
            <TextInput placeholder="Location (e.g., School Auditorium)" style={styles.input} value={location} onChangeText={setLocation} />
            <TextInput placeholder="Description..." style={[styles.input, {height: 120, textAlignVertical: 'top'}]} multiline value={description} onChangeText={setDescription} />
            
            <TouchableOpacity style={styles.createButton} onPress={handleSubmit} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>Publish Event</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f3f9' },
    // Buttons
    createButton: { flexDirection: 'row', backgroundColor: PURPLE_THEME.primary, padding: 15, margin: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    createButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
    backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
    backButtonText: { color: PURPLE_THEME.primary, fontSize: 16, fontWeight: '500', marginLeft: 5 },
    // List Card
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginHorizontal: 15, marginBottom: 15, elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: PURPLE_THEME.textDark },
    cardDetail: { fontSize: 14, color: PURPLE_THEME.textLight, marginTop: 4 },
    // Details View
    detailsContainer: { paddingHorizontal: 15 },
    detailsTitle: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 15, paddingBottom: 20, color: PURPLE_THEME.textDark },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, paddingHorizontal: 15 },
    infoIcon: { marginRight: 15, marginTop: 2 },
    infoLabel: { fontSize: 14, color: PURPLE_THEME.textLight },
    infoValue: { fontSize: 16, color: PURPLE_THEME.textDark, fontWeight: '500' },
    descriptionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 5, paddingHorizontal: 15, color: PURPLE_THEME.textDark },
    descriptionText: { fontSize: 16, color: PURPLE_THEME.textLight, lineHeight: 24, paddingHorizontal: 15 },
    // Form
    formContainer: { paddingBottom: 30 },
    formHeader: { paddingHorizontal: 15 },
    formTitle: { fontSize: 22, fontWeight: 'bold', paddingBottom: 15, color: PURPLE_THEME.textDark },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginHorizontal: 15, marginBottom: 15, fontSize: 16 },
    pickerLabel: { fontSize: 16, color: PURPLE_THEME.textLight, marginHorizontal: 15, marginBottom: 5 },
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginHorizontal: 15, marginBottom: 15, backgroundColor: '#fff' },
    picker: { height: 50 },
    // DateTime Picker
    dateTimePickerContainer: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 15, marginBottom: 15 },
    dateTimePickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', flex: 1, marginHorizontal: 5, justifyContent: 'center' },
    dateTimePickerText: { fontSize: 16, marginLeft: 10 },
    // Misc
    emptyText: { textAlign: 'center', marginTop: 40, color: '#999', fontSize: 16 },
});

export default AdminEventsScreen;