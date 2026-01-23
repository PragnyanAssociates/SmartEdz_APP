import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, RefreshControl, Linking, Alert, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import { MeetingCard, Meeting } from './MeetingCard';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC'
};

const StudentPTMScreen = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMeetings = useCallback(async () => {
    try {
      setError(null);
      const response = await apiClient.get('/ptm');
      setMeetings(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not fetch meeting schedules.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const onRefresh = () => {
      setIsRefreshing(true);
      fetchMeetings();
  };

  const handleJoinMeeting = (link: string) => {
      if(link) {
          Linking.openURL(link).catch(() => Alert.alert("Error", "Could not open the meeting link."));
      }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
        
        {/* --- HEADER CARD --- */}
        <View style={styles.headerCard}>
            <View style={styles.headerLeft}>
                <View style={styles.headerIconContainer}>
                    <MaterialIcons name="groups" size={24} color="#008080" />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>PTM Schedules</Text>
                    <Text style={styles.headerSubtitle}>Parent-Teacher Meetings</Text>
                </View>
            </View>
        </View>

        <FlatList
            data={meetings}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <View style={styles.cardWrapper}>
                    <MeetingCard 
                        meeting={item} 
                        isAdmin={false} 
                        onJoin={handleJoinMeeting}
                    />
                </View>
            )}
            ListEmptyComponent={ 
                <View style={styles.center}>
                    <MaterialIcons name="event-busy" size={50} color={COLORS.border} />
                    <Text style={styles.emptyText}>No meetings scheduled.</Text>
                </View> 
            }
            refreshControl={ <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[COLORS.primary]}/> }
            contentContainerStyle={{ paddingBottom: 20 }}
        />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, paddingTop: 50 },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: COLORS.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 8,
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

    // --- LIST STYLES ---
    cardWrapper: {
        width: '96%',       // Matches Header Width
        alignSelf: 'center',
        marginBottom: 8,   // Space between cards
    },
    
    emptyText: { textAlign: 'center', fontSize: 16, color: COLORS.textSub, marginTop: 10 },
    errorText: { color: COLORS.danger || 'red', fontSize: 16, textAlign: 'center' },
});

export default StudentPTMScreen;