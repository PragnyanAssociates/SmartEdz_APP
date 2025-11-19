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
import apiClient from '../../api/client';
import ImageView from "react-native-image-viewing";
import DateTimePickerModal from "react-native-modal-datetime-picker";

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
const HORIZONTAL_PADDING = 16;
const GAP = 8;
const TOTAL_GAP_SIZE = (NUM_COLUMNS - 1) * GAP;
const TOTAL_HORIZONTAL_PADDING = HORIZONTAL_PADDING * 2;
const AVAILABLE_WIDTH_FOR_IMAGES = width - TOTAL_HORIZONTAL_PADDING - TOTAL_GAP_SIZE;
const IMAGE_SIZE = Math.floor(AVAILABLE_WIDTH_FOR_IMAGES / NUM_COLUMNS);

// --- Main Component ---
const Screenshots = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    // --- State Management ---
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    
    // State for managing the date picker inputs
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');

    const baseUrl = useMemo(() => apiClient.defaults.baseURL?.replace('/api', ''), []);

    // --- Corrected Data Fetching Logic ---
    const fetchScreenshots = useCallback(async (range?: { start: string, end: string }) => {
        setIsLoading(true);
        let queryString = '/vouchers/screenshots';
        
        // If a valid date range is provided, append it to the query string
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

    // --- Effect for Initial Load and Screen Focus ---
    // This correctly fetches ALL screenshots whenever the user navigates to this screen.
    useEffect(() => {
        if (isFocused) {
            // Clear any previous date selections
            setDateRange({ start: '', end: '' });
            // Fetch data without any date range to get all screenshots
            fetchScreenshots();
        }
    }, [isFocused, fetchScreenshots]);

    // --- Data Processing for Display (Memoized for performance) ---
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

    // --- Event Handlers ---
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
        
        // If user selects a "From" date, also set the "To" date for quick single-day filtering.
        // They can override the "To" date by selecting it again.
        if (datePickerMode === 'start') {
            setDateRange({ start: formattedDate, end: formattedDate });
        } else {
            setDateRange(prev => ({ ...prev, end: formattedDate }));
        }
        
        hideDatePicker();
    };

    // Corrected: Handler to apply the selected date filter
    const handleApplyFilter = () => {
        if (!dateRange.start || !dateRange.end) {
            Alert.alert("Incomplete Selection", "Please select both a 'From' and 'To' date to apply the filter.");
            return;
        }
        // Fetch data using the dates stored in the state
        fetchScreenshots(dateRange);
    };

    // Corrected: Handler to clear filters and show all data
    const handleClearFilters = () => {
        // Clear the date state
        setDateRange({ start: '', end: '' });
        // Fetch data without a range to get all screenshots
        fetchScreenshots();
    };
    
    // --- Render Functions ---
    const renderFilterSection = () => (
        <View style={styles.filterContainer}>
            <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('start')}>
                <MaterialIcons name="calendar-today" size={16} color="#546E7A" />
                <Text style={styles.dateText}>{dateRange.start ? dateRange.start.split('-').reverse().join('/') : 'From Date'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('end')}>
                <MaterialIcons name="calendar-today" size={16} color="#546E7A" />
                <Text style={styles.dateText}>{dateRange.end ? dateRange.end.split('-').reverse().join('/') : 'To Date'}</Text>
            </TouchableOpacity>
            {/* "Go" button now correctly calls handleApplyFilter */}
            <TouchableOpacity style={styles.goButton} onPress={handleApplyFilter}>
                <Text style={styles.goButtonText}>Go</Text>
            </TouchableOpacity>
            {/* Show clear button only when a date is selected */}
             {(dateRange.start || dateRange.end) && (
                <TouchableOpacity style={styles.clearButton} onPress={handleClearFilters}>
                    <MaterialIcons name="close" size={20} color="#d9534f" />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#263238" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Screenshots</Text>
            </View>

            {renderFilterSection()}

            {isLoading ? (
                <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : screenshots.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="image-not-supported" size={60} color="#B0BEC5" />
                    <Text style={styles.emptyText}>No screenshots found.</Text>
                    <Text style={styles.emptySubText}>Try adjusting the date filters or add new voucher attachments.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent}>
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
                </ScrollView>
            )}

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
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#CFD8DC' },
    backButton: { padding: 5, marginRight: 15 },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#263238' },
    filterContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F7F9FC', borderBottomWidth: 1, borderBottomColor: '#E0E6ED' },
    dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E9ECEF', padding: Platform.OS === 'ios' ? 12 : 10, borderRadius: 8, marginRight: 10 },
    dateText: { marginLeft: 8, color: '#495057', fontWeight: '500' },
    goButton: { backgroundColor: '#28a745', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center' },
    goButtonText: { color: '#FFF', fontWeight: 'bold' },
    clearButton: { padding: 8, marginLeft: 8 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#78909C', marginTop: 16 },
    emptySubText: { fontSize: 14, color: '#90A4AE', marginTop: 8, textAlign: 'center' },
    scrollContent: { paddingVertical: 16, paddingHorizontal: HORIZONTAL_PADDING },
    dateSection: { marginBottom: 24 },
    dateHeader: { fontSize: 16, fontWeight: 'bold', color: '#37474F', marginBottom: 12 },
    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    thumbnail: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 8, backgroundColor: '#ECEFF1' },
});

export default Screenshots;