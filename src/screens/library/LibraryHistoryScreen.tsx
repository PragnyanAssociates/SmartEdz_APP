import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, Platform, ActivityIndicator, RefreshControl, SafeAreaView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native'; // Added navigation hook
import apiClient from '../../api/client'; 
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

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
    tableHeader: '#34495e'
};

const LibraryHistoryScreen = () => {
    const navigation = useNavigation(); // Hook for navigation
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    // Date Filters
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    // --- 1. Auto-Fetch when screen is focused ---
    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [])
    );

    // --- 2. Filter Logic (Triggered on any change) ---
    React.useEffect(() => {
        applyFilters();
    }, [search, startDate, endDate, data]);

    const fetchHistory = async () => {
        try {
            const res = await apiClient.get('/library/admin/history');
            setData(res.data || []);
        } catch (error) {
            console.error("History Fetch Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const applyFilters = () => {
        let result = [...data];

        // 1. Text Search
        if (search) {
            const lower = search.toLowerCase();
            result = result.filter(item => 
                (item.book_title && item.book_title.toLowerCase().includes(lower)) || 
                (item.full_name && item.full_name.toLowerCase().includes(lower)) ||
                (item.roll_no && item.roll_no.toLowerCase().includes(lower))
            );
        }

        // 2. Date Filter
        if (startDate) {
            result = result.filter(item => new Date(item.actual_return_date) >= startDate);
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59);
            result = result.filter(item => new Date(item.actual_return_date) <= endOfDay);
        }

        // 3. "Latest 10" Logic for Initial View
        if (!search && !startDate && !endDate) {
            result = result.slice(0, 10);
        }

        setFilteredData(result);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    };

    // --- Render Header ---
    const renderHeader = () => (
        <View style={styles.headerRow}>
            <Text style={[styles.cell, styles.col1, styles.headText]}>Student</Text>
            <Text style={[styles.cell, styles.col2, styles.headText]}>Book</Text>
            <Text style={[styles.cell, styles.col3, styles.headText]}>Issued</Text>
            <Text style={[styles.cell, styles.col4, styles.headText]}>Returned</Text>
        </View>
    );

    // --- Render Row ---
    const renderItem = ({ item }) => (
        <View style={styles.row}>
            {/* Student Column */}
            <View style={[styles.cell, styles.col1]}>
                <Text style={styles.cellTextBold} numberOfLines={1}>{item.full_name}</Text>
                <Text style={styles.cellSubText}>{item.roll_no}</Text>
            </View>
            
            {/* Book Column */}
            <View style={[styles.cell, styles.col2]}>
                <Text style={styles.cellText} numberOfLines={1}>{item.book_title}</Text>
                <Text style={styles.cellSubText}>{item.book_no}</Text>
            </View>
            
            {/* Issued Date */}
            <View style={[styles.cell, styles.col3]}>
                <Text style={styles.cellText}>{formatDate(item.borrow_date)}</Text>
            </View>
            
            {/* Returned Date */}
            <View style={[styles.cell, styles.col4]}>
                <Text style={[styles.cellText, styles.greenText]}>
                    {formatDate(item.actual_return_date)}
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    {/* Back Button */}
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>

                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="history" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>History</Text>
                        <Text style={styles.headerSubtitle}>Transaction Logs</Text>
                    </View>
                </View>
            </View>
            
            {/* --- Filters Section --- */}
            <View style={styles.filterContainer}>
                <View style={styles.searchBox}>
                    <MaterialIcons name="search" size={20} color={COLORS.textSub} style={{marginRight: 8}} />
                    <TextInput 
                        style={styles.searchInput}
                        placeholder="Search Student or Book..."
                        placeholderTextColor={COLORS.textSub}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                
                <View style={styles.dateRow}>
                    <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateBtn}>
                        <Text style={styles.dateBtnTxt}>
                            {startDate ? formatDate(startDate.toISOString()) : 'Start Date'}
                        </Text>
                        <MaterialIcons name="calendar-today" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                    
                    <MaterialIcons name="arrow-right-alt" size={24} color={COLORS.textSub} />
                    
                    <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateBtn}>
                        <Text style={styles.dateBtnTxt}>
                            {endDate ? formatDate(endDate.toISOString()) : 'End Date'}
                        </Text>
                        <MaterialIcons name="calendar-today" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                    
                    {(startDate || endDate) && (
                        <TouchableOpacity 
                            onPress={() => {setStartDate(null); setEndDate(null)}} 
                            style={styles.clearBtn}
                        >
                            <MaterialIcons name="close" size={18} color="#FFF" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* --- Date Pickers --- */}
            {showStartPicker && (
                <DateTimePicker value={startDate || new Date()} mode="date" 
                    onChange={(e, d) => { setShowStartPicker(Platform.OS === 'ios'); if(d) setStartDate(d); }} 
                />
            )}
            {showEndPicker && (
                <DateTimePicker value={endDate || new Date()} mode="date" 
                    onChange={(e, d) => { setShowEndPicker(Platform.OS === 'ios'); if(d) setEndDate(d); }} 
                />
            )}

            {/* --- Table --- */}
            <View style={styles.tableContainer}>
                {renderHeader()}
                {loading ? <ActivityIndicator style={{marginTop: 50}} color={COLORS.primary} /> : (
                    <FlatList
                        data={filteredData}
                        renderItem={renderItem}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true); fetchHistory()}} colors={[COLORS.primary]} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No history found.</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

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

    // Filters
    filterContainer: { paddingHorizontal: 15, marginBottom: 15 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 10, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, height: 45 },
    searchInput: { flex: 1, fontSize: 15, color: COLORS.textMain, padding: 0 },
    
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateBtn: { flexDirection: 'row', alignItems:'center', justifyContent:'space-between', backgroundColor: '#FFF', padding: 10, borderRadius: 8, width: '40%', borderWidth: 1, borderColor: COLORS.border },
    dateBtnTxt: { fontSize: 12, fontWeight: '600', color: COLORS.textMain },
    clearBtn: { backgroundColor: COLORS.danger, padding: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

    // Table
    tableContainer: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 5, overflow: 'hidden' },
    headerRow: { flexDirection: 'row', backgroundColor: COLORS.tableHeader, paddingVertical: 14, paddingHorizontal: 10 },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 14, paddingHorizontal: 10, alignItems:'center' },
    
    // Grid System
    col1: { flex: 3 },   // Student Name (Wider)
    col2: { flex: 3 },   // Book Title (Wider)
    col3: { flex: 2 },   // Issue Date
    col4: { flex: 2 },   // Return Date
    
    cell: { paddingRight: 5 },
    headText: { color: '#FFF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    cellText: { fontSize: 12, color: COLORS.textMain, fontWeight: '500' },
    cellTextBold: { fontSize: 13, color: COLORS.textMain, fontWeight: '700' },
    cellSubText: { fontSize: 10, color: COLORS.textSub, marginTop: 2 },
    greenText: { color: COLORS.success, fontWeight: '700' },
    
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { textAlign: 'center', color: COLORS.textSub, fontSize: 16 }
});

export default LibraryHistoryScreen;