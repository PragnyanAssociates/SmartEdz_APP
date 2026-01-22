import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator,
    TouchableOpacity, Keyboard, Modal, Alert, ScrollView, SafeAreaView, StatusBar
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; // Switched to MaterialIcons for consistency
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
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
    blue: '#1E88E5'
};

const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface DictionaryItem {
    id: number;
    word: string;
    part_of_speech: string;
    definition_en: string;
    definition_te: string;
}

const DictionaryScreen = () => {
    const { user } = useAuth();
    const userRole = user?.role || 'student';
    const canAdd = userRole === 'admin' || userRole === 'teacher';

    // Search & Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [activeLetter, setActiveLetter] = useState('A'); 
    const [results, setResults] = useState<DictionaryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

    // Add Word Modal States
    const [isModalVisible, setModalVisible] = useState(false);
    const [newWord, setNewWord] = useState('');
    const [newPOS, setNewPOS] = useState('');
    const [newDefEn, setNewDefEn] = useState('');
    const [newDefTe, setNewDefTe] = useState('');
    const [adding, setAdding] = useState(false);

    // --- INITIAL LOAD ---
    useEffect(() => {
        fetchDefinitions(activeLetter);
    }, []);

    // --- SEARCH API CALL ---
    const fetchDefinitions = async (query: string) => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/dictionary/search?query=${query}`);
            setResults(response.data);
        } catch (error) {
            console.error("Search Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- HANDLERS ---
    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (text.length === 0) {
            fetchDefinitions(activeLetter);
            return;
        }
        if (typingTimeout) clearTimeout(typingTimeout);
        setLoading(true);
        const newTimeout = setTimeout(() => fetchDefinitions(text), 500);
        setTypingTimeout(newTimeout);
    };

    const handleLetterPress = (letter: string) => {
        setActiveLetter(letter);
        setSearchQuery('');
        Keyboard.dismiss();
        fetchDefinitions(letter);
    };

    const handleAddWord = async () => {
        if (!newWord || !newPOS || !newDefEn || !newDefTe) {
            Alert.alert("Error", "All fields are required.");
            return;
        }
        setAdding(true);
        try {
            await apiClient.post('/dictionary/add', {
                word: newWord,
                part_of_speech: newPOS,
                definition_en: newDefEn,
                definition_te: newDefTe
            });
            Alert.alert("Success", "Word added successfully!");
            setModalVisible(false);
            setNewWord(''); setNewPOS(''); setNewDefEn(''); setNewDefTe('');
            if (newWord.toUpperCase().startsWith(activeLetter) || searchQuery) {
                fetchDefinitions(searchQuery || activeLetter);
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Failed to add word.");
        } finally {
            setAdding(false);
        }
    };

    // --- RENDER ITEM ---
    const renderItem = ({ item, index }: { item: DictionaryItem, index: number }) => (
        <Animatable.View animation="fadeInUp" duration={500} delay={index * 50}>
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.word}>{item.word}</Text>
                    <Text style={styles.pos}>({item.part_of_speech})</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.meaningRow}>
                    <View style={[styles.langBadge, { backgroundColor: '#E3F2FD' }]}>
                        <Text style={[styles.langText, { color: '#1565C0' }]}>ENG</Text>
                    </View>
                    <Text style={styles.definitionText}>{item.definition_en}</Text>
                </View>
                <View style={styles.meaningRow}>
                    <View style={[styles.langBadge, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.langText, { color: '#2E7D32' }]}>TEL</Text>
                    </View>
                    <Text style={[styles.definitionText, styles.teluguText]}>{item.definition_te}</Text>
                </View>
            </View>
        </Animatable.View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F2F5F8" />
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="menu-book" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Dictionary</Text>
                        <Text style={styles.headerSubtitle}>English & Telugu Definitions</Text>
                    </View>
                </View>
                
                {canAdd && (
                    <TouchableOpacity style={styles.headerBtn} onPress={() => setModalVisible(true)}>
                        <MaterialIcons name="add" size={18} color="#fff" />
                        <Text style={styles.headerBtnText}>Add</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* --- SEARCH BAR --- */}
            <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={22} color={COLORS.textSub} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search a word..."
                    placeholderTextColor={COLORS.textSub}
                    value={searchQuery}
                    onChangeText={handleSearch}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); fetchDefinitions(activeLetter); }}>
                        <MaterialIcons name="close" size={20} color={COLORS.textSub} />
                    </TouchableOpacity>
                )}
            </View>

            {/* --- ALPHABET SELECTOR --- */}
            <View style={styles.alphabetContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 10}}>
                    {ALPHABETS.map((letter) => {
                        const isActive = activeLetter === letter && searchQuery === '';
                        return (
                            <TouchableOpacity 
                                key={letter} 
                                style={[styles.letterButton, isActive && styles.letterButtonActive]}
                                onPress={() => handleLetterPress(letter)}
                            >
                                <Text style={[styles.letterText, isActive && styles.letterTextActive]}>{letter}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* --- RESULTS LIST --- */}
            <View style={styles.contentContainer}>
                {loading ? (
                    <View style={styles.centerView}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Loading Dictionary...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.centerView}>
                                <MaterialIcons name="auto-stories" size={60} color="#CFD8DC" />
                                <Text style={styles.emptyText}>
                                    No words found for "{searchQuery || activeLetter}"
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* --- ADD WORD MODAL --- */}
            <Modal visible={isModalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add New Word</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialIcons name="close" size={24} color="#546E7A" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView contentContainerStyle={{paddingBottom: 20}}>
                            <Text style={styles.label}>Word</Text>
                            <TextInput style={styles.modalInput} placeholder="e.g. Village" value={newWord} onChangeText={setNewWord} />
                            
                            <Text style={styles.label}>Part of Speech</Text>
                            <TextInput style={styles.modalInput} placeholder="e.g. Noun, Verb" value={newPOS} onChangeText={setNewPOS} />

                            <Text style={styles.label}>English Definition</Text>
                            <TextInput style={[styles.modalInput, styles.textArea]} placeholder="Meaning in English" value={newDefEn} onChangeText={setNewDefEn} multiline />

                            <Text style={styles.label}>Telugu Definition</Text>
                            <TextInput style={[styles.modalInput, styles.textArea]} placeholder="Meaning in Telugu (గ్రామం)" value={newDefTe} onChangeText={setNewDefTe} multiline />

                            <TouchableOpacity style={[styles.submitButton, adding && {backgroundColor: '#B0BEC5'}]} onPress={handleAddWord} disabled={adding}>
                                {adding ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>SAVE WORD</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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

    // --- SEARCH BAR ---
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, marginHorizontal: 15, marginBottom: 10, paddingHorizontal: 10, height: 50, borderWidth: 1, borderColor: COLORS.border },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16, color: COLORS.textMain },

    // --- ALPHABET BAR ---
    alphabetContainer: { backgroundColor: '#FFFFFF', paddingVertical: 10, marginBottom: 5, elevation: 1 },
    letterButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4, backgroundColor: '#F0F0F0' },
    letterButtonActive: { backgroundColor: COLORS.primary },
    letterText: { fontSize: 14, fontWeight: '600', color: '#555' },
    letterTextActive: { color: '#FFF', fontWeight: 'bold' },

    contentContainer: { flex: 1 },
    listContent: { paddingHorizontal: 15, paddingBottom: 20, paddingTop: 5 },
    
    // Card
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
    word: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain, textTransform: 'capitalize' },
    pos: { fontSize: 14, color: COLORS.textSub, marginLeft: 8, fontStyle: 'italic' },
    divider: { height: 1, backgroundColor: '#EEEEEE', marginBottom: 10 },
    
    meaningRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' },
    langBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, marginRight: 10, marginTop: 2 },
    langText: { fontSize: 10, fontWeight: 'bold' },
    definitionText: { fontSize: 15, color: COLORS.textMain, flex: 1, lineHeight: 22 },
    teluguText: { fontSize: 16, color: '#2E7D32' },

    centerView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 10, color: '#90A4AE', fontSize: 16 },
    loadingText: { marginTop: 10, color: '#546E7A' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 15, padding: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
    label: { fontSize: 14, fontWeight: '600', color: '#546E7A', marginBottom: 5, marginTop: 10 },
    modalInput: { backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: '#CFD8DC', borderRadius: 8, padding: 10, color: '#333' },
    textArea: { height: 80, textAlignVertical: 'top' },
    submitButton: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
    submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default DictionaryScreen;