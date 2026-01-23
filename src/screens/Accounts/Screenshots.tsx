import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';
import ImageView from "react-native-image-viewing";
import DateTimePickerModal from "react-native-modal-datetime-picker";

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
    blue: '#1E88E5',
    warning: '#F59E0B'
};

// --- Type Definitions ---
interface Screenshot {
    id: number;
    voucher_date: string;
    attachment_url: string;
}

interface GroupedScreenshots {
    [key: string]: Screenshot[];
}

// --- Dynamic Layout Calculations ---
const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const CARD_PADDING = 15;
const GAP = 8;
const AVAILABLE_WIDTH = width - (CARD_PADDING * 2) - 30; 
const IMAGE_SIZE = Math.floor((AVAILABLE_WIDTH - ((NUM_COLUMNS - 1) * GAP)) / NUM_COLUMNS);

// --- Main Component ---
const Screenshots = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    // --- State Management ---
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');

    const baseUrl = useMemo(() => apiClient.defaults.baseURL?.replace('/api', ''), []);

    // --- Data Fetching ---
    const fetchScreenshots = useCallback(async (range?: { start: string, end: string }) => {
        setIsLoading(true);
        let queryString = '/vouchers/screenshots';
        
        if (range && range.start && range.end) {
            queryString += `?startDate=${range.start}&endDate=${range.end}`;
        }
        
        try {
            const response = await apiClient.get<Screenshot[]>(queryString);
            setScreenshots(response.data);
        } catch (error) {
            console.error("Failed to fetch screenshots:", error);
            Alert.alert("Error", "Could not fetch screenshots. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isFocused) {
            setDateRange({ start: '', end: '' });
            fetchScreenshots();
        }
    }, [isFocused, fetchScreenshots]);

    // --- Data Processing ---
    const groupedScreenshots = useMemo(() => {
        return screenshots.reduce((acc: GroupedScreenshots, screenshot) => {
            const date = new Date(screenshot.voucher_date).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
            if (!acc[date]) acc[date] = [];
            acc[date].push(screenshot);
            return acc;
        }, {});
    }, [screenshots]);

    const imageUrisForViewer = useMemo(() => {
        return screenshots.map(s => ({ uri: `${baseUrl}${s.attachment_url}` }));
    }, [screenshots, baseUrl]);

    // --- Handlers ---
    const openImageViewer = (screenshot: Screenshot) => {
        const index = screenshots.findIndex(s => s.id === screenshot.id);
        if (index > -1) {
            setSelectedImageIndex(index);
            setViewerVisible(true);
        }
    };

    const showDatePicker = (mode: 'start' | 'end') => {
        setDatePickerMode(mode);
        setDatePickerVisibility(true);
    };

    const hideDatePicker = () => setDatePickerVisibility(false);

    const handleConfirmDate = (date: Date) => {
        const formattedDate = date.toISOString().split('T')[0];
        if (datePickerMode === 'start') {
            setDateRange({ start: formattedDate, end: formattedDate });
        } else {
            setDateRange(prev => ({ ...prev, end: formattedDate }));
        }
        hideDatePicker();
    };

    const handleApplyFilter = () => {
        if (!dateRange.start || !dateRange.end) {
            Alert.alert("Incomplete Selection", "Please select both a 'From' and 'To' date.");
            return;
        }
        fetchScreenshots(dateRange);
    };

    const handleClearFilters = () => {
        setDateRange({ start: '', end: '' });
        fetchScreenshots();
    };
    
    // --- Render Components ---
    const renderFilterSection = () => (
        <View style={styles.filterCard}>
            <View style={styles.filterRow}>
                {/* From Date Input */}
                <TouchableOpacity style={styles.dateInput} onPress={() => showDatePicker('start')}>
                    <MaterialIcons name="event" size={20} color={COLORS.textSub} />
                    <Text style={styles.dateText}>
                        {dateRange.start ? dateRange.start.split('-').reverse().join('/') : 'From Date'}
                    </Text>
                </TouchableOpacity>

                {/* To Date Input */}
                <TouchableOpacity style={styles.dateInput} onPress={() => showDatePicker('end')}>
                    <MaterialIcons name="event" size={20} color={COLORS.textSub} />
                    <Text style={styles.dateText}>
                        {dateRange.end ? dateRange.end.split('-').reverse().join('/') : 'To Date'}
                    </Text>
                </TouchableOpacity>
                
                {/* Small "Go/Search" Button */}
                <TouchableOpacity style={styles.searchButton} onPress={handleApplyFilter}>
                    <MaterialIcons name="search" size={24} color="#FFF" />
                </TouchableOpacity>

                {/* Optional: Small Clear X Button next to search if active */}
                {(dateRange.start || dateRange.end) && (
                    <TouchableOpacity style={styles.iconButton} onPress={handleClearFilters}>
                        <MaterialIcons name="close" size={24} color={COLORS.danger} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>

                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="image-multiple" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Screenshots</Text>
                        <Text style={styles.headerSubtitle}>Vouchers & Attachments</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                {renderFilterSection()}

                {isLoading ? (
                    <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
                ) : screenshots.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="image-not-supported" size={60} color="#B0BEC5" />
                        <Text style={styles.emptyText}>No screenshots found.</Text>
                        <Text style={styles.emptySubText}>Try adjusting the date filters.</Text>
                    </View>
                ) : (
                    <View style={styles.resultsCard}>
                        {Object.entries(groupedScreenshots).map(([date, images]) => (
                            <View key={date} style={styles.dateSection}>
                                <Text style={styles.dateHeader}>{date}</Text>
                                <View style={styles.imageGrid}>
                                    {images.map((image) => (
                                        <TouchableOpacity key={image.id} onPress={() => openImageViewer(image)}>
                                            <Image
                                                source={{ uri: `${baseUrl}${image.attachment_url}` }}
                                                style={styles.thumbnail}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            <ImageView
                images={imageUrisForViewer}
                imageIndex={selectedImageIndex}
                visible={viewerVisible}
                onRequestClose={() => setViewerVisible(false)}
            />

            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmDate}
                onCancel={hideDatePicker}
            />
        </SafeAreaView>
    );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    
    // Header
    headerCard: {
        backgroundColor: COLORS.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 0,
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
    backButton: { marginRight: 10, padding: 4 },
    headerIconContainer: {
        backgroundColor: '#E0F2F1',
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

    // Layout
    scrollContent: { padding: 15 },

    // Filter Section (Updated)
    filterCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    filterRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
    },
    dateInput: { 
        flex: 1, 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#F8F9FA', 
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 8, 
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E9ECEF'
    },
    dateText: { marginLeft: 8, color: COLORS.textMain, fontWeight: '500', fontSize: 13 },
    
    // New Small Button Style
    searchButton: { 
        backgroundColor: COLORS.primary, // Teal
        width: 45,
        height: 45,
        borderRadius: 8, 
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2
    },
    iconButton: {
        marginLeft: 8,
        padding: 5
    },

    // Results
    resultsCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 3,
        minHeight: 300,
    },
    loader: { marginTop: 50 },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.textSub, marginTop: 16 },
    emptySubText: { fontSize: 14, color: '#90A4AE', marginTop: 8, textAlign: 'center' },
    
    // Grid
    dateSection: { marginBottom: 24 },
    dateHeader: { fontSize: 15, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 5 },
    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    thumbnail: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 8, backgroundColor: '#ECEFF1' },
});

export default Screenshots;