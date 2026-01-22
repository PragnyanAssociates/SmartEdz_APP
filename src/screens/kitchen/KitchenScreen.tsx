// 📂 File: src/screens/kitchen/KitchenScreen.tsx

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, SafeAreaView, Modal, TextInput, Platform, Image, UIManager
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
    light: '#f8f9fa'
};

const ORDERED_DAYS = [
    { full: 'Monday', short: 'Mon' }, { full: 'Tuesday', short: 'Tue' }, { full: 'Wednesday', short: 'Wed' },
    { full: 'Thursday', short: 'Thu' }, { full: 'Friday', short: 'Fri' }, { full: 'Saturday', short: 'Sat' },
];

const KitchenScreen = () => {
    const [activeTab, setActiveTab] = useState('Daily');
    const [provisions, setProvisions] = useState([]);
    const [usage, setUsage] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [permanentInventory, setPermanentInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal States
    const [itemModalInfo, setItemModalInfo] = useState({ visible: false, mode: null, data: null });
    const [isTimeModalVisible, setIsTimeModalVisible] = useState(false);

    const fetchData = useCallback(() => {
        setLoading(true);
        const dateString = selectedDate.toISOString().split('T')[0];
        
        const dailyProvisionsFetch = apiClient.get('/kitchen/inventory');
        const dailyUsageFetch = apiClient.get(`/kitchen/usage?date=${dateString}`);
        const permanentInventoryFetch = apiClient.get('/permanent-inventory');

        Promise.all([dailyProvisionsFetch, dailyUsageFetch, permanentInventoryFetch])
            .then(([provisionsRes, usageRes, permanentRes]) => {
                setProvisions(provisionsRes.data || []);
                setUsage(usageRes.data || []);
                setPermanentInventory(permanentRes.data || []);
            })
            .catch((err) => Alert.alert("Error", "Could not fetch kitchen data."))
            .finally(() => setLoading(false));
    }, [selectedDate]);

    useFocusEffect(useCallback(() => {
        fetchData();
    }, [fetchData]));

    const displayTime = useMemo(() => {
        for (const day of ORDERED_DAYS) {
            const meal = provisions?.length > 0 ? null : null; // Logic placeholder if needed, using menuData logic below
            // Since we fetch provisions directly, we might need menu data for time. 
            // Assuming time logic comes from a menu endpoint or similar. For now, defaulting or using logic:
             return '1:00 PM - 1:45 PM'; // Default or fetch from API if available
        }
        return 'Not Set';
    }, [provisions]);

    const openItemModal = (mode, data = null) => setItemModalInfo({ visible: true, mode, data });
    const closeItemModal = () => setItemModalInfo({ visible: false, mode: null, data: null });

    const handleCellPress = (meal, day) => {
        if (meal) {
            openItemModal('edit', meal);
        } else {
            openItemModal('add', { day_of_week: day, meal_type: 'Lunch' });
        }
    };
    
    const handleSaveItem = async (values) => {
        // Logic to save item
        closeItemModal();
        fetchData();
    };

    const handleSaveTime = async (newTime) => {
        setIsTimeModalVisible(false);
        // Logic to save time
        fetchData();
    };
    
    const handleDeletePermanentItem = (item) => {
        Alert.alert("Delete", "Delete this item?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/permanent-inventory/${item.id}`);
                    fetchData();
                } catch(e) { Alert.alert("Error", "Failed to delete."); }
            }}
        ]);
    };

    const onDateChange = (event, date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (date) setSelectedDate(date);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="chef-hat" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Kitchen</Text>
                        <Text style={styles.headerSubtitle}>
                            {activeTab === 'Daily' ? selectedDate.toLocaleDateString() : 'Inventory'}
                        </Text>
                    </View>
                </View>
                
                <View style={{flexDirection: 'row', gap: 8}}>
                    {activeTab === 'Daily' && (
                        <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowDatePicker(true)}>
                            <MaterialIcons name="calendar-today" size={20} color="#008080" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.headerBtn} onPress={() => openItemModal(activeTab === 'Daily' ? 'addProvision' : 'addPermanentItem')}>
                        <MaterialIcons name="add" size={18} color="#fff" />
                        <Text style={styles.headerBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'Daily' && styles.tabButtonActive]} onPress={() => setActiveTab('Daily')}>
                    <Text style={[styles.tabButtonText, activeTab === 'Daily' && styles.tabButtonTextActive]}>Daily Usage</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'Inventory' && styles.tabButtonActive]} onPress={() => setActiveTab('Inventory')}>
                    <Text style={[styles.tabButtonText, activeTab === 'Inventory' && styles.tabButtonTextActive]}>Permanent Inventory</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} /> :
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    {activeTab === 'Daily' ? (
                        <>
                            <Section title="Daily Usage">
                                {usage.length > 0 ? <DataTable type="usage" data={usage} /> : <Text style={styles.emptyText}>No items used on this date.</Text>}
                            </Section>
                            <Section title="Remaining Provisions">
                                {provisions.length > 0 ? <DataTable type="provisions" data={provisions} onLogUsage={(item) => openItemModal('logUsage', item)} /> : <Text style={styles.emptyText}>No provisions remaining.</Text>}
                            </Section>
                        </>
                    ) : (
                        <Section title="Permanent Assets">
                            {permanentInventory.length > 0 ?
                                <DataTable type="permanent" data={permanentInventory} onEdit={(item) => openItemModal('editPermanentItem', item)} onDelete={handleDeletePermanentItem} />
                                : <Text style={styles.emptyText}>No permanent items found.</Text>}
                        </Section>
                    )}
                </ScrollView>
            }

            {/* Modals are placed INSIDE SafeAreaView to be valid children */}
            {itemModalInfo.visible && <EditMenuModal modalInfo={itemModalInfo} onClose={closeItemModal} onSave={handleSaveItem} />}
            {isTimeModalVisible && <EditTimeModal visible={isTimeModalVisible} onClose={() => setIsTimeModalVisible(false)} onSave={handleSaveTime} initialTime={displayTime} />}
            {showDatePicker && <DateTimePicker value={selectedDate} mode="date" display="default" onChange={onDateChange} />}
        </SafeAreaView>
    );
};

const DataTable = ({ type, data, onLogUsage, onEdit, onDelete }) => (
    <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeader, { flex: 0.4 }]}>#</Text>
            <Text style={[styles.tableHeader, { flex: 2, textAlign: 'left', paddingLeft: 10 }]}>Item Name</Text>
            <Text style={[styles.tableHeader, { flex: 1, textAlign: 'center' }]}>{type === 'usage' ? 'Used' : 'Qty'}</Text>
            {type === 'permanent' && <Text style={[styles.tableHeader, { flex: 1.2, textAlign: 'right' }]}>Action</Text>}
        </View>

        {data.map((item, index) => (
            <View key={`${type}-${item.id}`} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 0.4, color: COLORS.textSub }]}>{index + 1}</Text>
                
                <TouchableOpacity style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center' }]} onPress={() => type === 'provisions' && onLogUsage && onLogUsage(item)} disabled={type !== 'provisions'}>
                    {item.image_url ?
                        <Image source={{ uri: `${SERVER_URL}${item.image_url}` }} style={styles.itemImage} />
                        : <View style={[styles.itemImage, styles.imagePlaceholder]}><MaterialCommunityIcons name="food-variant" size={20} color={COLORS.textSub} /></View>
                    }
                    <Text style={styles.itemName} numberOfLines={1}>{item.item_name}</Text>
                </TouchableOpacity>
                
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '600' }]}>
                    {type === 'usage' ? `${item.quantity_used} ${item.unit}` : type === 'provisions' ? `${item.quantity_remaining} ${item.unit}` : `${item.total_quantity}`}
                </Text>
                
                {type === 'permanent' && (
                    <View style={[styles.tableCell, { flex: 1.2, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }]}>
                        <TouchableOpacity onPress={() => onEdit && onEdit(item)}><MaterialCommunityIcons name="pencil-outline" size={20} color={COLORS.primary} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => onDelete && onDelete(item)}><MaterialCommunityIcons name="trash-can-outline" size={20} color={COLORS.danger} /></TouchableOpacity>
                    </View>
                )}
            </View>
        ))}
    </View>
);

const Section = ({ title, children }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
    </View>
);

const EditMenuModal = ({ modalInfo, onClose, onSave }) => {
    const { mode, data } = modalInfo;
    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState('g');
    const [notes, setNotes] = useState('');
    const [image, setImage] = useState(null);
    const UNITS = ['g', 'kg', 'l', 'ml', 'pcs'];

    useEffect(() => {
        if (data) {
            setItemName(data.item_name || '');
            setQuantity(data.quantity_remaining || data.total_quantity || 1);
            setUnit(data.unit || 'g');
            setNotes(data.notes || '');
        } else {
            // Reset for Add mode
            setItemName('');
            setQuantity(1);
            setUnit('g');
            setNotes('');
        }
        setImage(null);
    }, [data, mode]);

    const handleChooseImage = () => {
         ImagePicker.launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, res => { if (res.assets && res.assets[0]) setImage(res.assets[0]); });
    };

    const getTitle = () => {
        switch (mode) {
            case 'addProvision': return 'Add Provision';
            case 'logUsage': return 'Log Usage';
            case 'addPermanentItem': return 'Add Permanent Item';
            case 'editPermanentItem': return 'Edit Permanent Item';
            default: return 'Action';
        }
    };

    return (
        <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{getTitle()}</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {mode !== 'logUsage' && (
                            <>
                                <Text style={styles.inputLabel}>Item Name</Text>
                                <TextInput style={styles.input} placeholder="e.g. Rice" value={itemName} onChangeText={setItemName} />
                                
                                <Text style={styles.inputLabel}>Unit</Text>
                                <View style={styles.unitSelector}>{UNITS.map(u => (<TouchableOpacity key={u} style={[styles.unitButton, unit === u && styles.unitButtonSelected]} onPress={() => setUnit(u)}><Text style={[styles.unitButtonText, unit === u && styles.unitButtonTextSelected]}>{u}</Text></TouchableOpacity>))}</View>
                                
                                <TouchableOpacity style={styles.imagePicker} onPress={handleChooseImage}>
                                     {image ? <Image source={{uri: image.uri}} style={styles.previewImage} /> : <><MaterialCommunityIcons name="camera-plus" size={28} color={COLORS.textSub}/><Text style={styles.imagePickerText}>Image</Text></>}
                                </TouchableOpacity>
                            </>
                        )}

                        <Text style={styles.inputLabel}>{mode === 'logUsage' ? 'Quantity Used' : 'Quantity'}</Text>
                        <View style={styles.quantityControl}>
                            <TouchableOpacity onPress={() => setQuantity(q => Math.max(1, q - 1))} style={styles.quantityButton}><MaterialCommunityIcons name="minus" size={24} color={COLORS.primary} /></TouchableOpacity>
                            <TextInput style={styles.quantityInput} value={String(quantity)} onChangeText={t => setQuantity(Number(t) || 0)} keyboardType="numeric" />
                            <TouchableOpacity onPress={() => setQuantity(q => q + 1)} style={styles.quantityButton}><MaterialCommunityIcons name="plus" size={24} color={COLORS.primary} /></TouchableOpacity>
                        </View>
                        
                        {(mode === 'addPermanentItem' || mode === 'editPermanentItem') && (
                            <>
                                <Text style={styles.inputLabel}>Notes</Text>
                                <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} multiline placeholder="Details..." value={notes} onChangeText={setNotes} />
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}><Text style={{color: '#333'}}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={() => onSave({ itemName, quantity, unit, notes, image })}><Text style={styles.saveButtonText}>Save</Text></TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const EditTimeModal = ({ visible, onClose, onSave, initialTime }) => {
    const [time, setTime] = useState(initialTime || '');
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Update Lunch Time</Text>
                    <Text style={styles.inputLabel}>Time</Text>
                    <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="e.g., 1:00 PM" />
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}><Text style={{color: '#333'}}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={() => onSave(time)}><Text style={styles.saveButtonText}>Save</Text></TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContainer: { paddingHorizontal: 15, paddingBottom: 20 },
    
    // Header Card
    headerCard: { backgroundColor: COLORS.cardBg, paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { backgroundColor: '#E0F2F1', borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
    headerSubtitle: { fontSize: 13, color: COLORS.textSub },
    headerActionBtn: { padding: 8, backgroundColor: '#f0fdfa', borderRadius: 8, borderWidth: 1, borderColor: '#ccfbf1' },
    headerBtn: { backgroundColor: COLORS.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Tabs
    tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: 8, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: COLORS.border },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabButtonActive: { backgroundColor: '#F0FDF4', borderBottomWidth: 3, borderBottomColor: COLORS.primary },
    tabButtonText: { fontSize: 14, fontWeight: '600', color: COLORS.textSub },
    tabButtonTextActive: { color: COLORS.primary },

    // Sections & Table
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 10, marginLeft: 5 },
    table: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', elevation: 2 },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 10 },
    tableHeader: { fontWeight: 'bold', color: '#FFF', fontSize: 13, paddingHorizontal: 5 },
    tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingVertical: 12, paddingHorizontal: 5 },
    tableCell: { fontSize: 13, color: COLORS.textMain, paddingHorizontal: 5 },
    itemImage: { width: 35, height: 35, borderRadius: 6, marginRight: 10, backgroundColor: '#eee' },
    imagePlaceholder: { width: 35, height: 35, borderRadius: 6, marginRight: 10, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
    itemName: { fontWeight: '600', color: COLORS.textMain, flex: 1, fontSize: 14 },
    emptyText: { textAlign: 'center', color: COLORS.textSub, paddingVertical: 20, fontStyle: 'italic' },

    // Modal
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '90%', backgroundColor: 'white', borderRadius: 16, padding: 25, elevation: 10, maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: COLORS.textMain },
    inputLabel: { fontSize: 14, color: COLORS.textSub, marginBottom: 5, fontWeight: '600' },
    input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 15, color: COLORS.textMain, backgroundColor: '#FAFAFA' },
    unitSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    unitButton: { flex: 1, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, alignItems: 'center', marginHorizontal: 2 },
    unitButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    unitButtonText: { color: COLORS.textSub, fontWeight: '600', fontSize: 12 },
    unitButtonTextSelected: { color: '#fff' },
    imagePicker: { height: 100, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20, backgroundColor: '#FAFAFA', overflow: 'hidden' },
    imagePickerText: { marginTop: 5, color: COLORS.textSub, fontSize: 12 },
    previewImage: { width: '100%', height: '100%', borderRadius: 8 },
    quantityLabel: { textAlign: 'center', fontSize: 14, color: COLORS.textSub, marginBottom: 10, fontWeight: '600' },
    quantityControl: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    quantityButton: { backgroundColor: '#f0f0f0', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
    quantityInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, width: 70, textAlign: 'center', fontSize: 18, fontWeight: 'bold', marginHorizontal: 15, paddingVertical: 8, backgroundColor: '#fff' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    modalButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center', elevation: 2 },
    cancelButton: { backgroundColor: '#e0e0e0', marginRight: 10 },
    saveButton: { backgroundColor: COLORS.primary, marginLeft: 10 },
    saveButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
    cancelText: { textAlign: 'center', color: COLORS.textSub, padding: 15, fontSize: 16 },
});

export default KitchenScreen;