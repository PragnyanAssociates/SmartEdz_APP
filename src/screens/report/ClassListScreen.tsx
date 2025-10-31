/**
 * File: src/screens/report/ClassListScreen.js
 * Purpose: Displays a list of all classes with performance summaries for Teachers/Admins.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const ClassListScreen = ({ navigation }) => {
    // Renamed state to be more descriptive
    const [classSummaries, setClassSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Fetch summaries when the screen is focused (e.g., after returning from marks entry)
        const unsubscribe = navigation.addListener('focus', () => {
            fetchClassSummaries();
        });

        return unsubscribe;
    }, [navigation]);

    const fetchClassSummaries = async () => {
        setLoading(true);
        try {
            // Call the new API endpoint
            const response = await apiClient.get('/reports/class-summaries');
            setClassSummaries(response.data);
        } catch (err) {
            console.error('Failed to fetch class summaries:', err);
            setError('Could not load class data. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#2c3e50" /></View>;
    }

    if (error) {
        return <View style={styles.loaderContainer}><Text style={styles.errorText}>{error}</Text></View>;
    }

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.cardContainer}
            onPress={() => navigation.navigate('MarksEntry', { classGroup: item.class_group })}
        >
            {/* Left Side: Class Name */}
            <View style={styles.classSection}>
                <Text style={styles.classText}>{item.class_group}</Text>
            </View>

            {/* Right Side: Stats */}
            <View style={styles.statsSection}>
                <View style={styles.statRow}>
                    <Icon name="sigma" size={16} color="#34495e" style={styles.icon} />
                    <Text style={styles.statLabel}>Total Class Marks:</Text>
                    <Text style={styles.statValue}>{item.totalClassMarks}</Text>
                </View>

                <View style={styles.statRow}>
                    <Icon name="account-star" size={16} color="#e67e22" style={styles.icon} />
                    <Text style={styles.statLabel}>Top Student:</Text>
                    <Text style={styles.statValue}>{`${item.topStudent.name} (${item.topStudent.marks})`}</Text>
                </View>

                <View style={styles.statRow}>
                    <Icon name="book-open-variant" size={16} color="#2980b9" style={styles.icon} />
                    <Text style={styles.statLabel}>Top Subject:</Text>
                    <Text style={styles.statValue}>{`${item.topSubject.name} (${item.topSubject.marks})`}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={classSummaries}
                renderItem={renderItem}
                keyExtractor={(item) => item.class_group}
                ListEmptyComponent={<Text style={styles.emptyText}>No classes with students were found.</Text>}
                contentContainerStyle={{ padding: 10 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5'
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    cardContainer: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        marginVertical: 8,
        borderRadius: 12,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        overflow: 'hidden', // Ensures children conform to border radius
    },
    classSection: {
        backgroundColor: '#34495e',
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
        width: 120, // Fixed width for the class name section
    },
    classText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    statsSection: {
        flex: 1,
        padding: 15,
        justifyContent: 'center',
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    icon: {
        marginRight: 8,
    },
    statLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7f8c8d',
        marginRight: 5,
    },
    statValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2c3e50',
        flexShrink: 1, // Allows text to wrap if it's too long
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: '#666'
    },
    errorText: {
        fontSize: 16,
        color: '#e74c3c',
        textAlign: 'center'
    }
});

export default ClassListScreen;