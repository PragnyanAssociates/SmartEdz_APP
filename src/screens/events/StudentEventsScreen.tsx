import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, ScrollView, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import * as Animatable from 'react-native-animatable';

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    tag_bg: '#E0F2F1',
    tag_text: '#00695C',
    border: '#CFD8DC'
};

const StudentEventsScreen = () => {
    const [view, setView] = useState('list');
    const [selectedEventId, setSelectedEventId] = useState(null);
    
    const handleViewDetails = (eventId) => { setSelectedEventId(eventId); setView('details'); };
    const handleBackToList = () => { setSelectedEventId(null); setView('list'); };
    
    return (
        <SafeAreaView style={styles.container}>
            {view === 'list' && <EventListView onViewDetails={handleViewDetails} />}
            {view === 'details' && <EventDetailsView eventId={selectedEventId} onBack={handleBackToList} />}
        </SafeAreaView>
    );
};

const EventListView = ({ onViewDetails }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchEvents = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/events/all-for-user/${user.id}`);
            setEvents(response.data);
        } catch (error) { Alert.alert("Error", "Could not load school events."); }
        finally { setLoading(false); }
    }, [user]);

    useFocusEffect(fetchEvents);

    return (
        <View style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="calendar-star" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>School Events</Text>
                        <Text style={styles.headerSubtitle}>Activities & Updates</Text>
                    </View>
                </View>
            </View>

            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 40}} /> :
            <FlatList
                data={events}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item, index }) => (
                    <Animatable.View animation="fadeInUp" duration={500} delay={index * 100}>
                        <EventCard event={item} onViewDetails={onViewDetails} />
                    </Animatable.View>
                )}
                ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>No upcoming events found.</Text></View>}
                contentContainerStyle={styles.listContainer}
            />}
        </View>
    );
};

const EventCard = ({ event, onViewDetails }) => {
    const date = new Date(event.event_datetime);
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();

    return (
        <View style={styles.card}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => onViewDetails(event.id)}>
                <View style={styles.cardContent}>
                    <View style={styles.dateBlock}>
                        <Text style={styles.dateMonth}>{month}</Text>
                        <Text style={styles.dateDay}>{day}</Text>
                    </View>
                    <View style={styles.detailsBlock}>
                        {event.category && (
                            <View style={styles.tagContainer}>
                                <Text style={styles.tagText}>{event.category}</Text>
                            </View>
                        )}
                        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
                        <View style={styles.detailRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.textSub} />
                            <Text style={styles.detailText}>{event.location || 'TBD'}</Text>
                        </View>
                    </View>
                    <View style={styles.arrowContainer}>
                        <MaterialIcons name="chevron-right" size={24} color={COLORS.textSub} />
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const EventDetailsView = ({ eventId, onBack }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchDetails = useCallback(async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/events/details/${eventId}`);
            setDetails(response.data);
        } finally { setLoading(false); }
    }, [eventId]);

    useFocusEffect(fetchDetails);
    
    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    if (!details || !details.event) return ( <View style={styles.centered}><Text>Event not found.</Text></View> );
    
    const { event } = details;
    const eventDate = new Date(event.event_datetime).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <View style={styles.container}>
            {/* --- HEADER CARD (With Back) --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="information-outline" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Event Details</Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>{event.title}</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.detailsPageContainer}>
                {event.category && (
                    <View style={styles.tagContainerLarge}>
                        <Text style={styles.tagTextLarge}>{event.category}</Text>
                    </View>
                )}
                
                <Text style={styles.detailsTitle}>{event.title}</Text>
                
                <View style={styles.infoBox}>
                    <InfoRow icon="calendar-clock" text={eventDate} />
                    <View style={styles.divider} />
                    <InfoRow icon="map-marker-outline" text={event.location || 'To be determined'} />
                    <View style={styles.divider} />
                    <InfoRow icon="account-group-outline" text={`For: ${event.target_class}`} />
                </View>
                
                <Text style={styles.descriptionTitle}>About this Event</Text>
                <Text style={styles.descriptionFull}>{event.description || 'No further details available.'}</Text>
            </ScrollView>
        </View>
    );
};

const InfoRow = ({ icon, text }) => (
    <View style={styles.infoRow}>
        <MaterialCommunityIcons name={icon} size={20} color={COLORS.primary} style={{marginRight: 15}} />
        <Text style={styles.infoText}>{text}</Text>
    </View>
);

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

    // List & Cards
    listContainer: { paddingHorizontal: 15, paddingBottom: 40 },
    card: { backgroundColor: COLORS.cardBg, borderRadius: 12, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
    cardContent: { flexDirection: 'row', padding: 15, alignItems: 'center' },
    
    dateBlock: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2F1', borderRadius: 10, paddingVertical: 8, width: 60, height: 65, marginRight: 15 },
    dateMonth: { fontSize: 12, color: '#00695C', fontWeight: 'bold', textTransform: 'uppercase' },
    dateDay: { fontSize: 22, color: '#004D40', fontWeight: 'bold', marginTop: -2 },
    
    detailsBlock: { flex: 1, justifyContent: 'center' },
    arrowContainer: { justifyContent: 'center', marginLeft: 5 },
    
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, marginTop: 4, marginBottom: 4 },
    
    tagContainer: { alignSelf: 'flex-start', backgroundColor: '#f0fdfa', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 4, borderWidth: 1, borderColor: '#ccfbf1' },
    tagText: { color: '#00796B', fontSize: 10, fontWeight: '700' },
    
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    detailText: { fontSize: 13, color: COLORS.textSub, marginLeft: 5 },

    emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.textSub, fontSize: 16 },

    // Details View
    detailsPageContainer: { paddingHorizontal: 20, paddingBottom: 40 },
    tagContainerLarge: { alignSelf: 'flex-start', backgroundColor: '#E0F2F1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginBottom: 10, marginTop: 10 },
    tagTextLarge: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold' },
    
    detailsTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 20 },
    
    infoBox: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 5, paddingHorizontal: 15, marginBottom: 25, elevation: 1 },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
    infoText: { fontSize: 15, color: COLORS.textMain, flex: 1 },
    divider: { height: 1, backgroundColor: '#F0F0F0' },

    descriptionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 10 },
    descriptionFull: { fontSize: 15, color: COLORS.textSub, lineHeight: 24 },
});

export default StudentEventsScreen;