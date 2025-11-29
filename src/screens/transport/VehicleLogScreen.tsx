import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    SafeAreaView,
    ScrollView,
    Image,
    ActivityIndicator
} from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Helper for Dates
const getToday = () => new Date().toISOString().split('T')[0];

const VehicleLogScreen = () => {
    const { user } = useAuth();
    
    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [mainTab, setMainTab] = useState<'general' | 'service'>('general');
    const [generalSubTab, setGeneralSubTab] = useState<'daily' | 'monthly' | 'overall'>('daily');
    
    const [vehicles, setVehicles] = useState<any[]>([]); // Dropdown data
    const [logs, setLogs] = useState<any[]>([]); // Table data

    // Modal States
    const [showAddVehicle, setShowAddVehicle] = useState(false);
    const [showDailyModal, setShowDailyModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        vehicle_id: '',
        vehicle_no: '',
        vehicle_name: '',
        log_date: getToday(),
        distance_km: '',
        fuel_consumed: '',
        notes: '',
        service_date: getToday(),
        prev_service_date: '',
        service_details: '',
        cost: ''
    });

    // --- 1. ACCESS CONTROL ---
    if (!user || user.role !== 'admin') {
        return (
            <View style={styles.restrictedContainer}>
                <Image 
                    source={{ uri: 'https://cdn-icons-png.flaticon.com/128/9995/9995370.png' }} 
                    style={{ width: 80, height: 80, marginBottom: 20, tintColor: '#E53E3E' }} 
                />
                <Text style={styles.restrictedTitle}>Access Restricted</Text>
                <Text style={styles.restrictedText}>Only Admins can access Vehicle Logs.</Text>
            </View>
        );
    }

    // --- 2. DATA FETCHING ---
    useEffect(() => {
        fetchVehicles();
    }, []);

    useEffect(() => {
        if (mainTab === 'general') {
            fetchGeneralLogs(generalSubTab);
        } else {
            fetchServiceLogs();
        }
    }, [mainTab, generalSubTab]);

    const fetchVehicles = async () => {
        try {
            const res = await apiClient.get('/vehicles');
            setVehicles(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchGeneralLogs = async (type: string) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/vehicles/logs/${type}`);
            setLogs(res.data);
        } catch (e) { Alert.alert('Error', 'Failed to load logs'); }
        finally { setLoading(false); }
    };

    const fetchServiceLogs = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/vehicles/service');
            setLogs(res.data);
        } catch (e) { Alert.alert('Error', 'Failed to load service logs'); }
        finally { setLoading(false); }
    };

    // --- 3. SUBMIT ACTIONS ---
    const handleAddVehicle = async () => {
        if (!formData.vehicle_no || !formData.vehicle_name) return Alert.alert('Error', 'Fill all fields');
        try {
            await apiClient.post('/vehicles', {
                vehicle_no: formData.vehicle_no,
                vehicle_name: formData.vehicle_name
            });
            setShowAddVehicle(false);
            fetchVehicles();
            Alert.alert('Success', 'Vehicle Added');
        } catch (e) { Alert.alert('Error', 'Failed to add vehicle'); }
    };

    const handleSubmitDaily = async () => {
        if (!formData.vehicle_id || !formData.distance_km) return Alert.alert('Error', 'Select vehicle & distance');
        try {
            await apiClient.post('/vehicles/daily', formData);
            setShowDailyModal(false);
            fetchGeneralLogs('daily');
            Alert.alert('Success', 'Daily Log Saved');
        } catch (e) { Alert.alert('Error', 'Failed to save log'); }
    };

    const handleSubmitService = async () => {
        if (!formData.vehicle_id || !formData.service_date) return Alert.alert('Error', 'Select vehicle & date');
        try {
            await apiClient.post('/vehicles/service', formData);
            setShowServiceModal(false);
            fetchServiceLogs();
            Alert.alert('Success', 'Service Log Saved');
        } catch (e) { Alert.alert('Error', 'Failed to save log'); }
    };

    // --- 4. RENDERERS ---

    // Generic Header for Tables
    const renderHeader = (headers: string[]) => (
        <View style={styles.tableHeader}>
            {headers.map((h, i) => (
                <Text key={i} style={[styles.headerText, { flex: 1 }]}>{h}</Text>
            ))}
        </View>
    );

    const renderRow = (item: any) => {
        // GENERAL LOGS
        if (mainTab === 'general') {
            if (generalSubTab === 'daily') {
                return (
                    <View style={styles.tableRow}>
                        <Text style={styles.cell}>{item.log_date.split('T')[0]}</Text>
                        <Text style={styles.cell}>{item.vehicle_no}</Text>
                        <Text style={styles.cell}>{item.distance_km} km</Text>
                        <Text style={styles.cell}>{item.fuel_consumed} L</Text>
                    </View>
                );
            }
            if (generalSubTab === 'monthly') {
                return (
                    <View style={styles.tableRow}>
                        <Text style={styles.cell}>{item.month}</Text>
                        <Text style={styles.cell}>{item.vehicle_name}</Text>
                        <Text style={styles.cell}>{item.total_distance} km</Text>
                        <Text style={styles.cell}>{item.total_fuel} L</Text>
                    </View>
                );
            }
            if (generalSubTab === 'overall') {
                return (
                    <View style={styles.tableRow}>
                        <Text style={styles.cell}>{item.vehicle_name}</Text>
                        <Text style={styles.cell}>{item.total_trips}</Text>
                        <Text style={styles.cell}>{item.total_distance} km</Text>
                        <Text style={styles.cell}>{item.total_fuel} L</Text>
                    </View>
                );
            }
        }
        // SERVICE LOGS
        else {
            return (
                <View style={styles.tableRow}>
                    <Text style={styles.cell}>{item.vehicle_no}</Text>
                    <Text style={styles.cell}>{item.service_date.split('T')[0]}</Text>
                    <Text style={styles.cell}>{item.service_details}</Text>
                    <Text style={styles.cell}>${item.cost}</Text>
                </View>
            );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Main Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tab, mainTab === 'general' && styles.activeTab]} 
                    onPress={() => setMainTab('general')}
                >
                    <Text style={[styles.tabText, mainTab === 'general' && styles.activeTabText]}>General Log</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, mainTab === 'service' && styles.activeTab]} 
                    onPress={() => setMainTab('service')}
                >
                    <Text style={[styles.tabText, mainTab === 'service' && styles.activeTabText]}>Service Log</Text>
                </TouchableOpacity>
            </View>

            {/* Sub Tabs & Action Buttons */}
            <View style={styles.subHeader}>
                {mainTab === 'general' ? (
                    <View style={{flexDirection:'row'}}>
                        {['daily', 'monthly', 'overall'].map((t) => (
                            <TouchableOpacity 
                                key={t} 
                                onPress={() => setGeneralSubTab(t as any)}
                                style={[styles.subTab, generalSubTab === t && styles.activeSubTab]}
                            >
                                <Text style={{color: generalSubTab === t ? '#3182CE' : '#718096', textTransform:'capitalize'}}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <Text style={styles.sectionTitle}>Maintenance Records</Text>
                )}

                <View style={{flexDirection:'row'}}>
                    <TouchableOpacity style={styles.addButton} onPress={() => setShowAddVehicle(true)}>
                        <Text style={{color:'white', fontWeight:'bold'}}>+ Vehicle</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.addButton, {backgroundColor: '#38A169', marginLeft: 8}]} 
                        onPress={() => mainTab === 'general' ? setShowDailyModal(true) : setShowServiceModal(true)}
                    >
                        <Text style={{color:'white', fontWeight:'bold'}}>+ Log</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Data Table */}
            {loading ? <ActivityIndicator size="large" color="#3182CE" style={{marginTop: 50}} /> : (
                <View style={{flex: 1, padding: 10}}>
                    {mainTab === 'general' && generalSubTab === 'daily' && renderHeader(['Date', 'Vehicle', 'Dist.', 'Fuel'])}
                    {mainTab === 'general' && generalSubTab === 'monthly' && renderHeader(['Month', 'Vehicle', 'Total Dist.', 'Total Fuel'])}
                    {mainTab === 'general' && generalSubTab === 'overall' && renderHeader(['Vehicle', 'Trips', 'Total Dist.', 'Total Fuel'])}
                    {mainTab === 'service' && renderHeader(['Vehicle', 'Date', 'Details', 'Cost'])}

                    <FlatList 
                        data={logs}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({item}) => renderRow(item)}
                        ListEmptyComponent={<Text style={styles.emptyText}>No logs found.</Text>}
                    />
                </View>
            )}

            {/* --- MODAL 1: Add Vehicle --- */}
            <Modal visible={showAddVehicle} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add New Vehicle</Text>
                        <TextInput placeholder="Vehicle No (e.g., TS09 AB 1234)" style={styles.input} onChangeText={t => setFormData({...formData, vehicle_no: t})} />
                        <TextInput placeholder="Vehicle Name (e.g., School Bus 1)" style={styles.input} onChangeText={t => setFormData({...formData, vehicle_name: t})} />
                        <View style={styles.modalBtns}>
                            <TouchableOpacity onPress={() => setShowAddVehicle(false)} style={styles.cancelBtn}><Text>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleAddVehicle} style={styles.saveBtn}><Text style={{color:'white'}}>Save</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- MODAL 2: Daily Log --- */}
            <Modal visible={showDailyModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Daily Log Entry</Text>
                        
                        <Text style={styles.label}>Select Vehicle:</Text>
                        <View style={{flexDirection:'row', flexWrap:'wrap', marginBottom:10}}>
                            {vehicles.map(v => (
                                <TouchableOpacity 
                                    key={v.id} 
                                    onPress={() => setFormData({...formData, vehicle_id: v.id})}
                                    style={[styles.badge, formData.vehicle_id === v.id && styles.activeBadge]}
                                >
                                    <Text style={formData.vehicle_id === v.id ? {color:'white'} : {color:'#333'}}>{v.vehicle_no}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput placeholder="Date (YYYY-MM-DD)" value={formData.log_date} style={styles.input} onChangeText={t => setFormData({...formData, log_date: t})} />
                        <TextInput placeholder="Distance (km)" keyboardType="numeric" style={styles.input} onChangeText={t => setFormData({...formData, distance_km: t})} />
                        <TextInput placeholder="Fuel Consumed (L)" keyboardType="numeric" style={styles.input} onChangeText={t => setFormData({...formData, fuel_consumed: t})} />
                        <TextInput placeholder="Notes (Optional)" style={styles.input} onChangeText={t => setFormData({...formData, notes: t})} />

                        <View style={styles.modalBtns}>
                            <TouchableOpacity onPress={() => setShowDailyModal(false)} style={styles.cancelBtn}><Text>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmitDaily} style={styles.saveBtn}><Text style={{color:'white'}}>Save Log</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- MODAL 3: Service Log --- */}
            <Modal visible={showServiceModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Service Log Entry</Text>

                        <Text style={styles.label}>Select Vehicle:</Text>
                        <View style={{flexDirection:'row', flexWrap:'wrap', marginBottom:10}}>
                            {vehicles.map(v => (
                                <TouchableOpacity 
                                    key={v.id} 
                                    onPress={() => setFormData({...formData, vehicle_id: v.id})}
                                    style={[styles.badge, formData.vehicle_id === v.id && styles.activeBadge]}
                                >
                                    <Text style={formData.vehicle_id === v.id ? {color:'white'} : {color:'#333'}}>{v.vehicle_no}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput placeholder="Current Service Date" value={formData.service_date} style={styles.input} onChangeText={t => setFormData({...formData, service_date: t})} />
                        <TextInput placeholder="Previous Service Date" style={styles.input} onChangeText={t => setFormData({...formData, prev_service_date: t})} />
                        <TextInput placeholder="Service Details (Oil change, tires...)" style={styles.input} onChangeText={t => setFormData({...formData, service_details: t})} />
                        <TextInput placeholder="Cost" keyboardType="numeric" style={styles.input} onChangeText={t => setFormData({...formData, cost: t})} />

                        <View style={styles.modalBtns}>
                            <TouchableOpacity onPress={() => setShowServiceModal(false)} style={styles.cancelBtn}><Text>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmitService} style={styles.saveBtn}><Text style={{color:'white'}}>Save Log</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    
    // Restricted
    restrictedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    restrictedTitle: { fontSize: 22, fontWeight: 'bold', color: '#E53E3E', marginBottom: 10 },
    restrictedText: { fontSize: 16, color: '#4A5568' },

    // Tabs
    tabContainer: { flexDirection: 'row', backgroundColor: 'white', elevation: 2 },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: '#3182CE' },
    tabText: { fontSize: 16, color: '#718096', fontWeight: 'bold' },
    activeTabText: { color: '#3182CE' },

    // Sub Header
    subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#EDF2F7' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },
    subTab: { paddingVertical: 5, paddingHorizontal: 10, marginRight: 5, borderRadius: 15, backgroundColor: '#E2E8F0' },
    activeSubTab: { backgroundColor: '#BEE3F8' },
    addButton: { backgroundColor: '#3182CE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5 },

    // Table
    tableHeader: { flexDirection: 'row', backgroundColor: '#CBD5E0', padding: 10, borderRadius: 5, marginBottom: 5 },
    headerText: { fontWeight: 'bold', fontSize: 13, color: '#2D3748' },
    tableRow: { flexDirection: 'row', backgroundColor: 'white', padding: 12, borderBottomWidth: 1, borderBottomColor: '#EDF2F7', alignItems:'center' },
    cell: { flex: 1, fontSize: 13, color: '#4A5568' },
    emptyText: { textAlign: 'center', marginTop: 30, color: '#A0AEC0' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 5, padding: 10, marginBottom: 10 },
    label: { marginBottom: 8, fontWeight:'bold', color: '#4A5568'},
    modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
    cancelBtn: { padding: 10 },
    saveBtn: { backgroundColor: '#3182CE', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5 },
    
    // Vehicle Selection Badge
    badge: { padding: 8, borderRadius: 5, backgroundColor: '#EDF2F7', marginRight: 8, marginBottom: 8 },
    activeBadge: { backgroundColor: '#3182CE' }
});

export default VehicleLogScreen;