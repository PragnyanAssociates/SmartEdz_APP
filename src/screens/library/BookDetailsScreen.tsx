import React, { useState } from 'react';
import { 
    View, Text, StyleSheet, Image, ScrollView, 
    TouchableOpacity, Alert, ActivityIndicator 
} from 'react-native';
import apiClient from '../../api/client'; // Adjust path based on your folder structure
import { SERVER_URL } from '../../../apiConfig'; // Adjust path based on your folder structure
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext'; // Adjust path based on your folder structure

const BookDetailsScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { book } = route.params; // Get book data passed from BookListScreen
    
    const [loading, setLoading] = useState(false);
    
    // 1. Get User Role to show Admin buttons
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    // 2. Logic to delete book (Admin Only)
    const handleDelete = () => {
        Alert.alert(
            "Delete Book",
            "Are you sure you want to delete this book? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await apiClient.delete(`/library/books/${book.id}`);
                            Alert.alert("Success", "Book deleted successfully.");
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert("Error", error.response?.data?.message || "Delete failed.");
                            setLoading(false);
                        }
                    } 
                }
            ]
        );
    };

    // 3. Logic to Edit Book (Admin Only)
    const handleEdit = () => {
        navigation.navigate('AddBookScreen', { book: book });
    };

    // 4. LOGIC FOR BORROW REQUEST
    // If available -> Go to Form Screen
    // If not -> Show Alert or Button is disabled
    const handleBorrowPress = () => {
        if (book.available_copies > 0) {
            // Navigate to the form screen (BorrowRequestScreen)
            // We pass the book ID and Title so the form knows which book is being requested
            navigation.navigate('BorrowRequestScreen', { 
                bookId: book.id, 
                bookTitle: book.title 
            });
        } else {
            Alert.alert("Unavailable", "There are no copies left for this book. Please wait for a return.");
        }
    };

    // Helper for Image URL
    const imageUrl = book.cover_image_url 
        ? `${SERVER_URL}${book.cover_image_url}` 
        : 'https://via.placeholder.com/300/CCCCCC/FFFFFF?text=No+Cover';

    const isAvailable = book.available_copies > 0;

    return (
        <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
            {/* --- Cover Image --- */}
            <View style={styles.imageWrapper}>
                <Image source={{ uri: imageUrl }} style={styles.cover} resizeMode="contain" />
            </View>

            <View style={styles.contentContainer}>
                
                {/* --- Admin Action Buttons (Edit/Delete) --- */}
                {isAdmin && (
                    <View style={styles.adminRow}>
                        <TouchableOpacity style={[styles.adminBtn, styles.editBtn]} onPress={handleEdit}>
                            <Text style={styles.adminBtnText}>Edit Book</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.adminBtn, styles.deleteBtn]} onPress={handleDelete}>
                            <Text style={styles.adminBtnText}>Delete Book</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* --- Header Section (Title, Author, Status) --- */}
                <View style={styles.headerSection}>
                    <Text style={styles.title}>{book.title}</Text>
                    <Text style={styles.author}>by {book.author}</Text>
                    
                    <View style={styles.statusRow}>
                        <View style={[styles.pill, isAvailable ? styles.bgGreen : styles.bgRed]}>
                            <Text style={styles.pillText}>{isAvailable ? 'Available' : 'Out of Stock'}</Text>
                        </View>
                        <Text style={styles.stockText}>
                            {book.available_copies} of {book.total_copies} copies left
                        </Text>
                    </View>
                </View>

                {/* --- Details Grid --- */}
                <Text style={styles.sectionHeader}>Book Details</Text>
                <View style={styles.grid}>
                    <DetailItem label="Book No." value={book.book_no} />
                    <DetailItem label="Rack No." value={book.rack_no} />
                    <DetailItem label="Category" value={book.category} />
                    <DetailItem label="Publisher" value={book.publisher} />
                    <DetailItem label="Language" value={book.language || 'English'} />
                    <DetailItem label="Edition" value={book.edition || 'Standard'} />
                </View>

                {/* --- Main Action Button (Borrow) --- */}
                {/* 
                    Logic: 
                    - If loading: Show Spinner
                    - If Copies > 0: Show "Request to Borrow" (Clicking opens form)
                    - If Copies = 0: Show "No copies left, please wait" (Disabled)
                */}
                <TouchableOpacity 
                    style={[styles.btn, (!isAvailable || loading) && styles.disabledBtn]} 
                    onPress={handleBorrowPress}
                    disabled={!isAvailable || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.btnText}>
                            {isAvailable ? "Request to Borrow" : "No copies left, please wait"}
                        </Text>
                    )}
                </TouchableOpacity>

            </View>
        </ScrollView>
    );
};

// Helper Component for Grid Items
const DetailItem = ({ label, value }) => (
    <View style={styles.item}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={1}>{value || '-'}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    imageWrapper: { 
        backgroundColor: '#F1F5F9', 
        paddingVertical: 30, 
        alignItems: 'center', 
        borderBottomWidth: 1, 
        borderColor: '#E2E8F0' 
    },
    cover: { 
        width: 160, 
        height: 240, 
        borderRadius: 8, 
        elevation: 10, 
        shadowColor: '#000', 
        shadowOpacity: 0.3, 
        shadowRadius: 10 
    },
    contentContainer: { padding: 24 },
    
    // Admin Styles
    adminRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 },
    adminBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, marginLeft: 10 },
    editBtn: { backgroundColor: '#3B82F6' },
    deleteBtn: { backgroundColor: '#EF4444' },
    adminBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

    // Header Styles
    headerSection: { marginBottom: 24, borderBottomWidth: 1, borderColor: '#F1F5F9', paddingBottom: 20 },
    title: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
    author: { fontSize: 16, color: '#64748B', fontWeight: '500' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
    pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginRight: 10 },
    bgGreen: { backgroundColor: '#DCFCE7' }, 
    bgRed: { backgroundColor: '#FEE2E2' },
    pillText: { fontSize: 12, fontWeight: 'bold', color: '#1E293B' },
    stockText: { fontSize: 14, color: '#64748B' },
    
    // Details Grid Styles
    sectionHeader: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 15 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    item: { width: '48%', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, marginBottom: 12 },
    label: { fontSize: 11, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', fontWeight:'700' },
    value: { fontSize: 14, fontWeight: '600', color: '#334155' },
    
    // Main Button Styles
    btn: { 
        backgroundColor: '#2563EB', 
        paddingVertical: 18, 
        borderRadius: 14, 
        alignItems: 'center', 
        marginTop: 30, 
        elevation: 4,
        shadowColor: '#2563EB',
        shadowOpacity: 0.3,
        shadowOffset: {width:0, height:4}
    },
    disabledBtn: { backgroundColor: '#94A3B8', elevation: 0, shadowOpacity: 0 },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 }
});

export default BookDetailsScreen;