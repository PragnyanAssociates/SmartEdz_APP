// 📂 File: src/screens/students/StudentResourcesScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, Linking, FlatList, Image, SafeAreaView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native'; 
import apiClient from '../../api/client';
import * as Animatable from 'react-native-animatable';

const SERVER_URL = 'https://vivekanandapublicschoolerp-production.up.railway.app'; 

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    success: '#43A047',
    blue: '#1E88E5'
};

const StudentResourcesScreen = () => {
    const navigation = useNavigation(); 
    const [view, setView] = useState('CLASS_LIST'); 
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [availableClasses, setAvailableClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedBoard, setSelectedBoard] = useState<'state' | 'central' | null>(null);
    const [subjects, setSubjects] = useState([]);
    const [resourceType, setResourceType] = useState<'Syllabus' | 'Textbooks' | null>(null);

    const fetchAvailableClasses = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/resources/classes');
            setAvailableClasses(response.data);
        } catch (e) {
            setError("Could not load available classes.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAvailableClasses();
    }, [fetchAvailableClasses]);

    const handleCardPress = async (item) => {
        if (!item.url) return Alert.alert("Not Available", "The link for this item has not been provided yet.");
        if (item.url.toLowerCase().endsWith('.pdf')) {
            navigation.navigate('PDFViewer', { url: item.url, title: item.subject_name });
        } else {
            const canOpen = await Linking.canOpenURL(item.url);
            if (canOpen) await Linking.openURL(item.url);
            else Alert.alert("Error", `Could not open the link.`);
        }
    };
    
    const handleClassPress = (classGroup) => { setSelectedClass(classGroup); setView('BOARD_TYPE'); };
    const handleBoardPress = (boardType) => { setSelectedBoard(boardType); setView('OPTIONS'); };
    
    const handleSyllabusPress = async () => { 
        if (!selectedClass || !selectedBoard) return; 
        setIsLoading(true); 
        setResourceType('Syllabus'); 
        try { 
            const response = await apiClient.get(`/resources/syllabus/class/${selectedClass}/${selectedBoard}`); 
            setSubjects(response.data); 
            setView('SUBJECTS'); 
        } catch (e) { Alert.alert("Not Found", "Syllabus has not been published for this class and board yet."); } 
        finally { setIsLoading(false); } 
    };

    const handleTextbookPress = async () => { 
        if (!selectedClass || !selectedBoard) return; 
        setIsLoading(true); 
        setResourceType('Textbooks'); 
        try { 
            const response = await apiClient.get(`/resources/textbook/class/${selectedClass}/${selectedBoard}`); 
            setSubjects(response.data); 
            setView('SUBJECTS'); 
        } catch (e) { Alert.alert("Not Found", "Textbooks have not been published for this class and board yet."); } 
        finally { setIsLoading(false); } 
    };

    const goBack = (targetView) => { 
        setView(targetView); 
        if (targetView === 'CLASS_LIST') { setSelectedClass(null); setSelectedBoard(null); setResourceType(null); } 
        if (targetView === 'BOARD_TYPE') { setSelectedBoard(null); setResourceType(null); } 
        if (targetView === 'OPTIONS') { setResourceType(null); } 
    };

    // --- REUSABLE HEADER CARD ---
    const RenderHeaderCard = ({ title, subtitle, backTarget, icon }) => (
        <View style={styles.headerCard}>
            <View style={styles.headerLeft}>
                {backTarget && (
                    <TouchableOpacity onPress={() => goBack(backTarget)} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                )}
                <View style={styles.headerIconContainer}>
                    <MaterialCommunityIcons name={icon} size={24} color="#008080" />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <Text style={styles.headerSubtitle}>{subtitle}</Text>
                </View>
            </View>
        </View>
    );

    if (isLoading && view === 'CLASS_LIST') {
        return <View style={styles.centeredContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    if (error) {
        return ( <View style={styles.centeredContainer}> <MaterialIcons name="error-outline" size={40} color={COLORS.textSub} /> <Text style={styles.errorText}>{error}</Text> </View> );
    }
    
    // --- VIEW: SUBJECTS LIST ---
    if (view === 'SUBJECTS') {
         return (
            <SafeAreaView style={styles.container}>
                <RenderHeaderCard 
                    title={selectedClass} 
                    subtitle={resourceType} 
                    backTarget="OPTIONS" 
                    icon="book-open-page-variant" 
                />
                
                <FlatList
                    data={subjects}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={2}
                    contentContainerStyle={styles.gridContainer}
                    renderItem={({ item, index }) => {
                        const imageUri = item.cover_image_url ? `${SERVER_URL}${item.cover_image_url}` : `https://via.placeholder.com/300x400/DCDCDC/808080?text=${item.subject_name.replace(' ', '+')}`;
                        return (
                            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.gridItemWrapper}>
                                <TouchableOpacity style={styles.gridItem} onPress={() => handleCardPress(item)} activeOpacity={0.9}>
                                    <Image source={{ uri: imageUri }} style={styles.coverImage} />
                                    <View style={styles.infoContainer}>
                                        <Text style={styles.gridTitle} numberOfLines={1}>{item.subject_name}</Text>
                                        <Text style={styles.gridSubtitle}>{item.class_group}</Text>
                                    </View>
                                </TouchableOpacity>
                            </Animatable.View>
                        );
                    }}
                    ListEmptyComponent={<Text style={styles.errorText}>No {resourceType?.toLowerCase()} found for this class.</Text>}
                />
            </SafeAreaView>
        );
    }

    // --- VIEW: SELECT RESOURCE TYPE ---
    if (view === 'OPTIONS') { 
        return ( 
            <SafeAreaView style={styles.container}> 
                <RenderHeaderCard 
                    title={`${selectedClass} (${selectedBoard === 'state' ? 'State' : 'Central'})`} 
                    subtitle="Select Resource Type" 
                    backTarget="BOARD_TYPE" 
                    icon="format-list-bulleted-type" 
                />
                
                {/* Changed to optionsContainer for better alignment (less gap) */}
                <View style={styles.optionsContainer}> 
                    <TouchableOpacity style={styles.optionCard} onPress={handleSyllabusPress}> 
                        <View style={[styles.iconCircle, {backgroundColor: '#E0F2F1'}]}>
                            <MaterialIcons name="menu-book" size={32} color="#008080" /> 
                        </View>
                        <Text style={styles.optionText}>Academic Syllabus</Text> 
                    </TouchableOpacity> 
                    
                    <TouchableOpacity style={styles.optionCard} onPress={handleTextbookPress}> 
                        <View style={[styles.iconCircle, {backgroundColor: '#E3F2FD'}]}>
                            <MaterialIcons name="auto-stories" size={32} color="#1E88E5" /> 
                        </View>
                        <Text style={styles.optionText}>Textbooks</Text> 
                    </TouchableOpacity> 
                </View> 
            </SafeAreaView> 
        ); 
    }

    // --- VIEW: SELECT BOARD ---
    if (view === 'BOARD_TYPE') { 
        return ( 
            <SafeAreaView style={styles.container}> 
                <RenderHeaderCard 
                    title={selectedClass} 
                    subtitle="Select Board" 
                    backTarget="CLASS_LIST" 
                    icon="domain" 
                />

                <View style={styles.optionsContainer}> 
                    <TouchableOpacity style={styles.optionCard} onPress={() => handleBoardPress('state')}> 
                        <View style={[styles.iconCircle, {backgroundColor: '#FFEBEE'}]}>
                            <MaterialIcons name="account-balance" size={32} color="#c62828" /> 
                        </View>
                        <Text style={styles.optionText}>State Board</Text> 
                    </TouchableOpacity> 
                    
                    <TouchableOpacity style={styles.optionCard} onPress={() => handleBoardPress('central')}> 
                        <View style={[styles.iconCircle, {backgroundColor: '#E1F5FE'}]}>
                            <MaterialIcons name="corporate-fare" size={32} color="#0277bd" /> 
                        </View>
                        <Text style={styles.optionText}>Central Board</Text> 
                    </TouchableOpacity> 
                </View> 
            </SafeAreaView> 
        ); 
    }

    // --- VIEW: CLASS LIST (Initial View) ---
    return ( 
        <SafeAreaView style={styles.container}> 
            <RenderHeaderCard 
                title="Resources" 
                subtitle="Select Class" 
                backTarget={null} 
                icon="school" 
            />

            <FlatList 
                data={availableClasses} 
                keyExtractor={(item) => item} 
                numColumns={3} 
                renderItem={({ item, index }) => ( 
                    <Animatable.View animation="zoomIn" duration={400} delay={index * 50} style={styles.classItemWrapper}>
                        <TouchableOpacity style={styles.classGridItem} onPress={() => handleClassPress(item as string)}> 
                            {/* Updated to show full Class name */}
                            <Text style={styles.classGridText}>{item}</Text> 
                        </TouchableOpacity> 
                    </Animatable.View>
                )} 
                contentContainerStyle={styles.classGridContainer} 
                ListEmptyComponent={<Text style={styles.errorText}>No resources have been published yet.</Text>} 
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchAvailableClasses} />} 
            /> 
        </SafeAreaView> 
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: COLORS.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 5, // Tightened gap below header
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

    errorText: { marginTop: 20, textAlign: 'center', fontSize: 16, color: COLORS.textSub },
    
    // --- OPTION CARDS CONTAINER ---
    // Replaces centeredContainer for better gap control
    optionsContainer: {
        alignItems: 'center',
        paddingTop: 10, // Small gap from header
    },
    optionCard: { 
        width: '90%', 
        paddingVertical: 20, 
        paddingHorizontal: 20, 
        marginVertical: 8, // Reduced gap between cards
        backgroundColor: '#fff', 
        borderRadius: 16, 
        alignItems: 'center', 
        elevation: 4, 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.1, 
        shadowRadius: 4 
    },
    iconCircle: { 
        width: 60, 
        height: 60, 
        borderRadius: 30, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 10 
    },
    optionText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, marginTop: 5, textAlign: 'center' },
    
    // --- CLASS GRID ---
    classGridContainer: { padding: 10, paddingTop: 5 },
    classItemWrapper: { flex: 1, margin: 5 },
    classGridItem: { 
        height: 80, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#fff', 
        borderRadius: 12, 
        elevation: 3, 
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 3 
    },
    classGridText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
    
    // --- SUBJECT GRID ---
    gridContainer: { paddingHorizontal: 10, paddingTop: 8 },
    gridItemWrapper: { width: '50%', padding: 6 },
    gridItem: { backgroundColor: '#fff', borderRadius: 12, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2.5, overflow: 'hidden' },
    coverImage: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#e0e0e0' },
    infoContainer: { padding: 10, alignItems: 'center' },
    gridTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.textMain, textAlign: 'center' },
    gridSubtitle: { fontSize: 12, color: COLORS.textSub, marginTop: 2, textAlign: 'center' },
});

export default StudentResourcesScreen;