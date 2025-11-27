import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    SafeAreaView,
    Modal,
    TextInput,
    Alert,
    ScrollView,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SERVER_URL } from '../../../apiConfig';

// --- ICONS ---
const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';
const BUS_ICON = 'https://cdn-icons-png.flaticon.com/128/3448/3448339.png';
const STOP_ICON = 'https://cdn-icons-png.flaticon.com/128/684/684908.png'; 
const STUDENT_DEFAULT = 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png';
const TRASH_ICON = 'https://cdn-icons-png.flaticon.com/128/1214/1214428.png';
const PLUS_ICON = 'https://cdn-icons-png.flaticon.com/128/992/992651.png';
const CLOSE_ICON = 'https://cdn-icons-png.flaticon.com/128/1828/1828778.png';

// --- HELPER COMPONENT: SELECTION MODAL (Dropdown Replacement) ---
const SelectionModal = ({ visible, title, data, onSelect, onClose }: any) => (
    <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.selectionBox}>
                <View style={styles.selectionHeader}>
                    <Text style={styles.selectionTitle}>{title}</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={{color: '#E53E3E', fontWeight: 'bold'}}>Close</Text>
                    </TouchableOpacity>
                </View>
                {data.length === 0 ? (
                    <Text style={{padding: 20, textAlign: 'center', color: '#999'}}>No staff available. Add them in Staff Details first.</Text>
                ) : (
                    <FlatList
                        data={data}
                        keyExtractor={(item: any) => item.id.toString()}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.selectionItem} onPress={() => onSelect(item)}>
                                <View>
                                    <Text style={styles.selectionText}>{item.full_name}</Text>
                                    <Text style={styles.selectionSubText}>{item.phone || 'No Phone'}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>
        </View>
    </Modal>
);

// --- COMPONENT 1: CONDUCTOR PANEL ---
const ConductorPanel = () => {
    const [routeData, setRouteData] = useState<any>(null);
    const [stopsData, setStopsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchConductorData = async () => {
        try {
            const res = await apiClient.get('/transport/conductor/students');
            setRouteData(res.data.route);
            setStopsData(res.data.data);
        } catch (error: any) {
             // Handle error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchConductorData(); }, []);

    const updateStatus = async (passengerId: number, status: 'in' | 'out') => {
        try {
            await apiClient.put('/transport/student-status', { passenger_id: passengerId, status });
            const newStops = stopsData.map(stop => ({
                ...stop,
                students: stop.students.map((s: any) => 
                    s.passenger_id === passengerId ? { ...s, boarding_status: status } : s
                )
            }));
            setStopsData(newStops);
        } catch (e) {
            Alert.alert("Error", "Failed to update status");
        }
    };

    if (loading) return <ActivityIndicator size="large" color="#008080" style={{marginTop: 50}} />;
    if (!routeData) return <View style={styles.center}><Text>You are not assigned to any route yet.</Text></View>;

    return (
        <ScrollView style={styles.contentContainer}>
            <Text style={styles.sectionTitle}>Route: {routeData.route_name}</Text>
            {stopsData.map((stop, index) => (
                <View key={index} style={styles.stopCard}>
                    <View style={styles.stopHeader}>
                        <Text style={styles.stopName}>{index+1}. {stop.stop_name}</Text>
                    </View>
                    {stop.students.length === 0 ? (
                        <Text style={styles.noStudentText}>No students boarding here.</Text>
                    ) : (
                        stop.students.map((student: any) => (
                            <View key={student.passenger_id} style={styles.studentRow}>
                                <Image source={{ uri: student.profile_image_url ? `${SERVER_URL}${student.profile_image_url}` : STUDENT_DEFAULT }} style={styles.studentAvatar} />
                                <View style={{flex: 1}}>
                                    <Text style={styles.studentName}>{student.full_name}</Text>
                                    <Text style={styles.studentPhone}>{student.phone}</Text>
                                </View>
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity 
                                        style={[styles.statusBtn, student.boarding_status === 'in' ? styles.btnInActive : styles.btnIn]}
                                        onPress={() => updateStatus(student.passenger_id, 'in')}
                                    >
                                        <Text style={[styles.btnText, student.boarding_status === 'in' && {color:'white'}]}>IN</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.statusBtn, student.boarding_status === 'out' ? styles.btnOutActive : styles.btnOut]}
                                        onPress={() => updateStatus(student.passenger_id, 'out')}
                                    >
                                        <Text style={[styles.btnText, student.boarding_status === 'out' && {color:'white'}]}>OUT</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            ))}
            <View style={{height: 100}} />
        </ScrollView>
    );
};

// --- COMPONENT 2: MAP VIEW (Students & Admin) ---
// Updated to accept onBack for Admin usage
const LiveMapRoute = ({ routeId, onBack, isAdmin }: { routeId?: number, onBack?: () => void, isAdmin?: boolean }) => {
    const [routeData, setRouteData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const mapRef = useRef<MapView>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                let url = routeId ? `/transport/routes/${routeId}` : '/transport/student/my-route';
                const res = await apiClient.get(url);
                setRouteData(res.data);
                setLoading(false);
            } catch (e) {
                // console.error(e);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 10000); 
        return () => clearInterval(interval);
    }, [routeId]);

    // Fit map to coordinates when data loads
    useEffect(() => {
        if (!loading && routeData && routeData.stops && mapRef.current) {
            const coords = routeData.stops.map((s:any) => ({ latitude: parseFloat(s.stop_lat), longitude: parseFloat(s.stop_lng) }));
            // Add bus location
            if(routeData.current_lat) {
                coords.push({ latitude: parseFloat(routeData.current_lat), longitude: parseFloat(routeData.current_lng) });
            }
            if(coords.length > 0) {
                 mapRef.current.fitToCoordinates(coords, {
                    edgePadding: { top: 50, right: 50, bottom: 200, left: 50 },
                    animated: true,
                });
            }
        }
    }, [loading, routeData]);

    if (loading) return <ActivityIndicator size="large" color="#008080" style={{marginTop: 50}} />;
    if (!routeData) return <View style={styles.center}><Text>Route Data Unavailable</Text></View>;

    const busLoc = { 
        latitude: parseFloat(routeData.current_lat) || 17.3850, 
        longitude: parseFloat(routeData.current_lng) || 78.4867 
    };

    return (
        <View style={styles.mapWrapper}>
            {/* Header for Map inside Admin View */}
            {isAdmin && (
                <View style={styles.mapHeaderOverlay}>
                     <TouchableOpacity onPress={onBack} style={styles.mapBackBtn}>
                        <Image source={{ uri: BACK_ICON }} style={styles.icon} />
                    </TouchableOpacity>
                    <Text style={styles.mapTitle}>Live Bus Tracking</Text>
                </View>
            )}

            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                    latitude: busLoc.latitude,
                    longitude: busLoc.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >
                {/* Path Line (Uber Style) */}
                {routeData.stops && routeData.stops.length > 0 && (
                    <Polyline 
                        coordinates={routeData.stops.map((s:any) => ({ latitude: parseFloat(s.stop_lat), longitude: parseFloat(s.stop_lng) }))}
                        strokeColor="#3182CE"
                        strokeWidth={4}
                    />
                )}

                {/* Stops */}
                {routeData.stops && routeData.stops.map((stop: any, index: number) => (
                    <Marker 
                        key={stop.id}
                        coordinate={{ latitude: parseFloat(stop.stop_lat), longitude: parseFloat(stop.stop_lng) }}
                        title={`${index+1}. ${stop.stop_name}`}
                    >
                        <Image source={{ uri: STOP_ICON }} style={{ width: 35, height: 35 }} />
                    </Marker>
                ))}
                
                {/* Bus Location */}
                <Marker coordinate={busLoc} title={routeData.route_name}>
                    <Image source={{ uri: BUS_ICON }} style={{ width: 45, height: 45 }} />
                </Marker>
            </MapView>

            {/* Bottom Details Card */}
            <View style={styles.driverCard}>
                <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                    <Text style={styles.driverTitle}>{routeData.route_name}</Text>
                    <View style={styles.liveBadge}><Text style={{color:'white', fontSize:10, fontWeight:'bold'}}>LIVE</Text></View>
                </View>
                
                <View style={styles.detailRow}>
                    <View style={styles.roleBox}>
                        <Text style={styles.roleLabel}>Driver</Text>
                        <Text style={styles.roleValue}>{routeData.driver_name || 'N/A'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.roleBox}>
                        <Text style={styles.roleLabel}>Conductor</Text>
                        <Text style={styles.roleValue}>{routeData.conductor_name || 'N/A'}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

// --- COMPONENT 3: ADMIN ROUTES PANEL (List & Add Modal) ---
const AdminRoutesPanel = () => {
    const [routes, setRoutes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    // Tracking State
    const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
    
    // Form State
    const [routeName, setRouteName] = useState('');
    
    // Staff Selection
    const [driversList, setDriversList] = useState([]);
    const [conductorsList, setConductorsList] = useState([]);
    const [selectedDriver, setSelectedDriver] = useState<any>(null);
    const [selectedConductor, setSelectedConductor] = useState<any>(null);
    const [showDriverPicker, setShowDriverPicker] = useState(false);
    const [showConductorPicker, setShowConductorPicker] = useState(false);

    // Dynamic Stops State
    const [stops, setStops] = useState([{ name: '', lat: 17.3850, lng: 78.4867 }]); 

    // Fetch Data
    const fetchRoutes = async () => {
        try {
            const res = await apiClient.get('/transport/routes');
            setRoutes(res.data);
        } catch (e) { console.error(e) }
    };

    const fetchStaff = async () => {
        try {
            const res = await apiClient.get('/transport/staff'); 
            const allStaff = res.data;
            setDriversList(allStaff.filter((s:any) => s.staff_type === 'Driver'));
            setConductorsList(allStaff.filter((s:any) => s.staff_type === 'Conductor'));
        } catch (e) {
            console.error("Staff fetch error", e);
        }
    };

    useEffect(() => { 
        fetchRoutes(); 
        fetchStaff();
    }, []);

    // Stop Handlers
    const addStopField = () => {
        setStops([...stops, { name: '', lat: 17.3850, lng: 78.4867 }]);
    };

    const removeStopField = (index: number) => {
        const newStops = stops.filter((_, i) => i !== index);
        setStops(newStops);
    };

    const updateStopName = (text: string, index: number) => {
        const newStops = [...stops];
        newStops[index].name = text;
        setStops(newStops);
    };

    const handleCreateRoute = async () => {
        if (!routeName || !selectedDriver || !selectedConductor) {
            Alert.alert("Error", "Please fill route name and select staff.");
            return;
        }
        
        try {
            await apiClient.post('/transport/routes', {
                route_name: routeName,
                driver_id: selectedDriver.user_id, 
                conductor_id: selectedConductor.user_id,
                stops: stops
            });
            Alert.alert("Success", "Route Created");
            setShowModal(false);
            setRouteName('');
            setSelectedDriver(null);
            setSelectedConductor(null);
            setStops([{ name: '', lat: 17.3850, lng: 78.4867 }]);
            fetchRoutes();
        } catch (e) {
            Alert.alert("Error", "Failed to create route");
        }
    };

    const deleteRoute = (id: number) => {
        Alert.alert("Delete", "Confirm delete?", [{ text: "Yes", onPress: async () => {
            await apiClient.delete(`/transport/routes/${id}`);
            fetchRoutes();
        }}]);
    };

    // --- RENDER CONDITION: IF ROUTE SELECTED, SHOW MAP ---
    if (selectedRouteId) {
        return (
            <LiveMapRoute 
                routeId={selectedRouteId} 
                onBack={() => setSelectedRouteId(null)} 
                isAdmin={true} 
            />
        );
    }

    // --- RENDER: LIST VIEW ---
    return (
        <View style={styles.contentContainer}>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
                <Text style={styles.addButtonText}>+ Create New Route</Text>
            </TouchableOpacity>

            <FlatList 
                data={routes}
                keyExtractor={(item:any) => item.id.toString()}
                renderItem={({item}) => (
                    // On Press opens the Live Map
                    <TouchableOpacity 
                        style={styles.adminCard} 
                        onPress={() => setSelectedRouteId(item.id)}
                        activeOpacity={0.9}
                    >
                        <View style={{flex: 1}}>
                            <Text style={styles.cardTitle}>{item.route_name}</Text>
                            <Text style={styles.cardSub}>Driver: {item.driver_name || 'Unassigned'}</Text>
                            <Text style={styles.cardSub}>Conductor: {item.conductor_name || 'Unassigned'}</Text>
                            <Text style={styles.cardSub}>Stops: {item.stops ? item.stops.length : 0}</Text>
                        </View>
                        {/* Delete Button shouldn't trigger map, so wrap in View */}
                        <TouchableOpacity onPress={() => deleteRoute(item.id)} style={styles.trashBtn}>
                            <Image source={{ uri: TRASH_ICON }} style={{ width: 24, height: 24, tintColor: '#E53E3E' }} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{textAlign:'center', marginTop:20, color:'#888'}}>No routes found.</Text>}
            />

            {/* CREATE ROUTE MODAL */}
            <Modal visible={showModal} animationType="slide">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Create Route</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}>
                            <Image source={{ uri: CLOSE_ICON }} style={{ width: 20, height: 20 }} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                        <Text style={styles.label}>Route Name</Text>
                        <TextInput 
                            placeholder="e.g. Route - 5 (Begumpet)" 
                            style={styles.input} 
                            value={routeName} 
                            onChangeText={setRouteName} 
                        />

                        <Text style={styles.label}>Select Driver</Text>
                        <TouchableOpacity style={styles.selector} onPress={() => setShowDriverPicker(true)}>
                            <Text style={selectedDriver ? styles.selectorText : styles.placeholderText}>
                                {selectedDriver ? selectedDriver.full_name : "Tap to select Driver"}
                            </Text>
                        </TouchableOpacity>

                        <Text style={styles.label}>Select Conductor</Text>
                        <TouchableOpacity style={styles.selector} onPress={() => setShowConductorPicker(true)}>
                            <Text style={selectedConductor ? styles.selectorText : styles.placeholderText}>
                                {selectedConductor ? selectedConductor.full_name : "Tap to select Conductor"}
                            </Text>
                        </TouchableOpacity>

                        <Text style={styles.label}>Stops (Locations)</Text>
                        {stops.map((stop, index) => (
                            <View key={index} style={styles.stopRow}>
                                <TextInput 
                                    placeholder={`Stop ${index + 1} Name`}
                                    style={styles.stopInput}
                                    value={stop.name}
                                    onChangeText={(text) => updateStopName(text, index)}
                                />
                                {stops.length > 1 && (
                                    <TouchableOpacity style={styles.removeStopBtn} onPress={() => removeStopField(index)}>
                                        <Image source={{ uri: CLOSE_ICON }} style={styles.removeIcon} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}

                        <TouchableOpacity style={styles.addStopBtnContainer} onPress={addStopField}>
                            <Image source={{ uri: PLUS_ICON }} style={styles.plusIcon} />
                            <Text style={styles.addStopText}>Add Stop</Text>
                        </TouchableOpacity>

                        <View style={{height: 100}} />
                    </ScrollView>
                    
                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleCreateRoute}>
                            <Text style={styles.saveText}>Save Route</Text>
                        </TouchableOpacity>
                    </View>

                    <SelectionModal 
                        visible={showDriverPicker} 
                        title="Select Driver"
                        data={driversList}
                        onSelect={(item: any) => { setSelectedDriver(item); setShowDriverPicker(false); }}
                        onClose={() => setShowDriverPicker(false)}
                    />
                    <SelectionModal 
                        visible={showConductorPicker} 
                        title="Select Conductor"
                        data={conductorsList}
                        onSelect={(item: any) => { setSelectedConductor(item); setShowConductorPicker(false); }}
                        onClose={() => setShowConductorPicker(false)}
                    />

                </SafeAreaView>
            </Modal>
        </View>
    );
};

// --- MAIN SCREEN CONTAINER ---
const RoutesScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    
    // Header
    const Header = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Image source={{ uri: BACK_ICON }} style={styles.icon} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Transport Routes</Text>
            <View style={{width: 30}} />
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <Header />
            <View style={{ flex: 1 }}>
                {user?.role === 'admin' && <AdminRoutesPanel />}
                {user?.role === 'teacher' && <AdminRoutesPanel />} 
                {user?.role === 'student' && <LiveMapRoute />}
                {user?.role === 'others' && (
                    <ConductorPanel />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F7FAFC' },
    contentContainer: { flex: 1, padding: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', elevation: 2, borderBottomWidth: 1, borderColor: '#E2E8F0' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A202C' },
    backBtn: { padding: 5 },
    icon: { width: 24, height: 24, tintColor: '#2D3748' },

    // Admin List
    addButton: { backgroundColor: '#3182CE', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },
    adminCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
    cardSub: { color: '#718096', fontSize: 14, marginTop: 4 },
    trashBtn: { padding: 10 },

    // Modal Common
    modalContainer: { flex: 1, backgroundColor: '#FFF' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#E2E8F0' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3748' },
    modalBody: { padding: 20 },
    modalFooter: { padding: 20, borderTopWidth: 1, borderColor: '#E2E8F0' },
    
    // Form Elements
    label: { fontSize: 14, fontWeight: '600', color: '#4A5568', marginBottom: 8, marginTop: 5 },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16, color: '#2D3748' },
    selector: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 12, marginBottom: 15, backgroundColor: '#F7FAFC' },
    selectorText: { fontSize: 16, color: '#2D3748', fontWeight: '500' },
    placeholderText: { fontSize: 16, color: '#A0AEC0' },

    // Dynamic Stops
    stopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    stopInput: { flex: 1, borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 12, fontSize: 16 },
    removeStopBtn: { marginLeft: 10, padding: 10 },
    removeIcon: { width: 20, height: 20, tintColor: '#E53E3E' },
    
    addStopBtnContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 10, padding: 10, borderRadius: 5, backgroundColor: '#EBF8FF' },
    plusIcon: { width: 16, height: 16, tintColor: '#3182CE', marginRight: 8 },
    addStopText: { color: '#3182CE', fontWeight: 'bold', fontSize: 16 },

    saveBtn: { backgroundColor: '#38A169', padding: 15, borderRadius: 8, alignItems: 'center' },
    saveText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

    // Selection Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    selectionBox: { backgroundColor: '#FFF', borderRadius: 12, maxHeight: '60%', overflow: 'hidden' },
    selectionHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F7FAFC' },
    selectionTitle: { fontWeight: 'bold', fontSize: 18, color: '#2D3748' },
    selectionItem: { padding: 15, borderBottomWidth: 1, borderColor: '#EDF2F7' },
    selectionText: { fontSize: 16, color: '#2D3748', fontWeight: '600' },
    selectionSubText: { fontSize: 14, color: '#718096' },

    // Map Wrapper & Styling
    mapWrapper: { flex: 1, position: 'relative' },
    mapHeaderOverlay: { position: 'absolute', top: 10, left: 10, right: 10, height: 50, flexDirection:'row', alignItems:'center', zIndex: 99, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8, paddingHorizontal: 10, elevation: 3 },
    mapBackBtn: { padding: 8, marginRight: 10 },
    mapTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },

    driverCard: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    driverTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3748' },
    liveBadge: { backgroundColor: 'red', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    detailRow: { flexDirection: 'row', marginTop: 15 },
    roleBox: { flex: 1, alignItems: 'center' },
    roleLabel: { fontSize: 12, color: '#718096', marginBottom: 2 },
    roleValue: { fontSize: 16, fontWeight: '600', color: '#2D3748' },
    divider: { width: 1, backgroundColor: '#E2E8F0' },

    // Conductor
    sectionTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#2D3748' },
    stopCard: { backgroundColor: '#FFF', borderRadius: 10, marginBottom: 20, padding: 15, elevation: 2 },
    stopHeader: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 10, marginBottom: 10 },
    stopName: { fontSize: 18, fontWeight: 'bold', color: '#3182CE' },
    noStudentText: { fontStyle: 'italic', color: '#A0AEC0' },
    studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    studentAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#EDF2F7' },
    studentName: { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },
    studentPhone: { color: '#718096', fontSize: 12 },
    actionButtons: { flexDirection: 'row' },
    statusBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, marginLeft: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    btnIn: { borderColor: '#38A169', backgroundColor: 'transparent' },
    btnInActive: { backgroundColor: '#38A169', borderColor: '#38A169' },
    btnOut: { borderColor: '#E53E3E', backgroundColor: 'transparent' },
    btnOutActive: { backgroundColor: '#E53E3E', borderColor: '#E53E3E' },
    btnText: { fontSize: 12, fontWeight: 'bold', color: '#2D3748' }
});

export default RoutesScreen;