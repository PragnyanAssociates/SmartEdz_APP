import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, RefreshControl, FlatList
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Helper to generate academic years
const generateAcademicYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
        const startYear = currentYear - i;
        years.push(`${startYear}-${startYear + 1}`);
    }
    return years;
};

const ACADEMIC_YEARS = generateAcademicYears();

const TeacherPerformanceScreen = () => {
    const { user } = useAuth();
    const userRole = user?.role || 'teacher';
    const userId = user?.id;

    const [performanceData, setPerformanceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedYear, setSelectedYear] = useState(ACADEMIC_YEARS[0]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let response;
            if (userRole === 'admin') {
                response = await apiClient.get(`/performance/admin/all-teachers/${selectedYear}`);
            } else {
                response = await apiClient.get(`/performance/teacher/${userId}/${selectedYear}`);
            }
            setPerformanceData(response.data);
        } catch (error) {
            console.error('Error fetching performance data:', error);
            // Alert.alert('Error', 'Failed to load performance data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedYear]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderAdminView = () => (
        <FlatList
            data={performanceData}
            keyExtractor={item => item.teacher_id.toString()}
            ListHeaderComponent={() => (
                <View style={[styles.tableRow, styles.headerRow]}>
                    <Text style={[styles.headerText, styles.teacherNameCell]}>Teacher Name</Text>
                    <Text style={[styles.headerText, styles.classCell]}>Class/Subject</Text>
                    <Text style={[styles.headerText, styles.averageCell]}>Avg. Marks</Text>
                </View>
            )}
            renderItem={({ item }) => (
                <View style={styles.teacherCard}>
                    <View style={styles.teacherHeader}>
                        <Text style={styles.teacherName}>{item.teacher_name}</Text>
                        <Text style={styles.overallAverage}>
                            Overall Avg: <Text style={styles.overallAverageValue}>{item.overall_average}%</Text>
                        </Text>
                    </View>
                    {item.detailed_performance.length > 0 ? (
                        item.detailed_performance.map((detail, index) => (
                            <View key={index} style={styles.detailRow}>
                                <Text style={styles.detailTextPlaceholder}></Text> 
                                <Text style={styles.detailClassSubject}>{`${detail.class_group} - ${detail.subject}`}</Text>
                                <Text style={styles.detailAverage}>{parseFloat(detail.average_marks).toFixed(2)}%</Text>
                            </View>
                        ))
                    ) : (
                        <View style={styles.detailRow}>
                            <Text style={styles.noDataText}>No performance data available for this year.</Text>
                        </View>
                    )}
                </View>
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
    );

    const renderTeacherView = () => (
        <FlatList
            data={performanceData}
            keyExtractor={(item, index) => `${item.class_group}-${item.subject}-${index}`}
            ListHeaderComponent={() => (
                <View style={[styles.tableRow, styles.headerRow]}>
                    <Text style={[styles.headerText, { flex: 2 }]}>Class Group</Text>
                    <Text style={[styles.headerText, { flex: 3 }]}>Subject</Text>
                    <Text style={[styles.headerText, { flex: 2, textAlign: 'right' }]}>Average Marks</Text>
                </View>
            )}
            renderItem={({ item }) => (
                <View style={styles.tableRow}>
                    <Text style={[styles.cellText, { flex: 2 }]}>{item.class_group}</Text>
                    <Text style={[styles.cellText, { flex: 3 }]}>{item.subject}</Text>
                    <Text style={[styles.cellText, { flex: 2, textAlign: 'right', fontWeight: 'bold' }]}>
                        {parseFloat(item.average_marks).toFixed(2)}%
                    </Text>
                </View>
            )}
            ListEmptyComponent={() => (
                <View style={styles.noDataContainer}>
                    <Text style={styles.noDataText}>No performance data found for the selected year.</Text>
                </View>
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Teacher Performance</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={selectedYear}
                        onValueChange={(itemValue) => setSelectedYear(itemValue)}
                    >
                        {ACADEMIC_YEARS.map(year => (
                            <Picker.Item key={year} label={`Year: ${year}`} value={year} />
                        ))}
                    </Picker>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 20 }} />
            ) : userRole === 'admin' ? (
                renderAdminView()
            ) : (
                renderTeacherView()
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6f8',
    },
    header: {
        backgroundColor: '#ffffff',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#dfe4ea',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 10,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        backgroundColor: '#ffffff',
    },
    // Admin View Styles
    teacherCard: {
        backgroundColor: '#fff',
        marginHorizontal: 15,
        marginVertical: 8,
        borderRadius: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    teacherHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#34495e',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    teacherName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    overallAverage: {
        fontSize: 14,
        color: '#ecf0f1',
    },
    overallAverageValue: {
        fontWeight: 'bold',
        color: '#2ecc71',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
    },
    detailTextPlaceholder: {
        width: 150, // To align with the header text
    },
    detailClassSubject: {
        flex: 1,
        fontSize: 15,
        color: '#34495e',
    },
    detailAverage: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#2c3e50',
        width: 100,
        textAlign: 'right',
    },
    // Teacher View & Shared Styles
    tableRow: {
        flexDirection: 'row',
        padding: 15,
        marginHorizontal: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#dfe4ea',
        alignItems: 'center',
    },
    headerRow: {
        backgroundColor: '#e9ecef',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        marginTop: 10,
    },
    headerText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#495057',
    },
    cellText: {
        fontSize: 15,
        color: '#2c3e50',
    },
    teacherNameCell: {
        flex: 3,
    },
    classCell: {
        flex: 4,
    },
    averageCell: {
        flex: 2,
        textAlign: 'right',
    },
    noDataContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
    },
    noDataText: {
        fontSize: 16,
        color: '#7f8c8d',
        textAlign: 'center',
        padding: 20,
    },
});

export default TeacherPerformanceScreen;