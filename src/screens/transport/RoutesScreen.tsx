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
    ActivityIndicator,
    Platform,
    ScrollView,
    Switch
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Geolocation from 'react-native-geolocation-service';
import { io } from 'socket.io-client';
import { getRoadPath } from '../../utils/routeHelper'; 
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SERVER_URL } from '../../../apiConfig';

// --- CONFIG ---
const MAPTILER_KEY = 'X6chcXQ64ffLsmvUuEMz'; 
const STYLE_URL = `https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
MapLibreGL.setAccessToken(null);
const socket = io(SERVER_URL);

// --- ASSETS ---
const BUS_ICON = 'https://cdn-icons-png.flaticon.com/128/3448/3448339.png';
const STOP_ICON = 'https://cdn-icons-png.flaticon.com/128/3180/3180149.png'; // Pin
const CHECK_ICON = 'https://cdn-icons-png.flaticon.com/128/190/190411.png'; // Tick

const RoutesScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation();

    // Roles
    const isAdmin = user?.role === 'admin';
    const isDriver = user?.role === 'others'; // Assuming Driver/Conductor is 'others'
    const isStudent = user?.role === 'student' || user?.role === 'teacher';

    // State
    const [routes, setRoutes] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState<any>(null);
    const [routeShape, setRouteShape] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Admin Specific State
    const [modalVisible, setModalVisible] = useState(false);
    const [stopModalVisible, setStopModalVisible] = useState(false);
    const [newRouteName, setNewRouteName] = useState('');
    const [newStopName, setNewStopName] = useState('');
    const [tempCoordinate, setTempCoordinate] = useState<number[] | null>(null);

    // Driver Specific State
    const [attendanceModal, setAttendanceModal] = useState(false);
    const [currentStopPassengers, setCurrentStopPassengers] = useState([]);
    const [currentStopId, setCurrentStopId] = useState(null);

    // Live Tracking
    const [busLocation, setBusLocation] = useState<number[] | null>(null);
    const cameraRef = useRef<MapLibreGL.Camera>(null);

    // --- 1. INITIAL FETCH ---
    useEffect(() => {
        if (isAdmin) fetchRoutes();
        if (isDriver) fetchDriverData();
        if (isStudent) fetchStudentRoute();
    }, []);

    // --- API CALLS ---

    const fetchRoutes = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/transport/routes');
            setRoutes(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchRouteDetails = async (routeId: number) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/transport/routes/${routeId}/stops`);
            const stops = res.data;
            
            // Draw path
            if (stops.length > 1) {
                const coordinates = await getRoadPath(stops);
                if (coordinates.length > 0) {
                    setRouteShape({
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: coordinates }
                    });
                }
            }
            setSelectedRoute({ ...selectedRoute, id: routeId, stops });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchDriverData = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/transport/driver/data');
            const { route, stops } = res.data;
            setSelectedRoute({ ...route, stops });
            
            // Draw path
            if (stops.length > 1) {
                const coordinates = await getRoadPath(stops);
                setRouteShape({
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: coordinates }
                });
            }
            
            // Start Tracking
            startLocationUpdates(route.id);
        } catch (e) { Alert.alert("Notice", "No route assigned yet."); }
        finally { setLoading(false); }
    };

    const fetchStudentRoute = async () => {
        try {
            const res = await apiClient.get('/transport/student/my-route');
            setSelectedRoute(res.data);
            
            // Listen for bus
            socket.emit('join_route', res.data.id);
            socket.on('receive_location', (data) => {
                setBusLocation([parseFloat(data.lng), parseFloat(data.lat)]);
            });

            // Draw path
            if (res.data.stops) {
                const coordinates = await getRoadPath(res.data.stops);
                setRouteShape({
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: coordinates }
                });
            }
        } catch (e) { console.log("Student route error", e); }
    };

    // --- ADMIN ACTIONS ---

    const handleAddRoute = async () => {
        if(!newRouteName) return;
        try {
            await apiClient.post('/transport/routes', { route_name: newRouteName });
            setModalVisible(false);
            setNewRouteName('');
            fetchRoutes();
        } catch(e) { Alert.alert("Error"); }
    };

    const handleMapPress = (e: any) => {
        if (!isAdmin || !selectedRoute) return;
        setTempCoordinate(e.geometry.coordinates);
        setStopModalVisible(true);
    };

    const handleAddStop = async () => {
        if (!newStopName || !tempCoordinate) return;
        try {
            await apiClient.post('/transport/stops', {
                route_id: selectedRoute.id,
                stop_name: newStopName,
                stop_lng: tempCoordinate[0],
                stop_lat: tempCoordinate[1],
                stop_order: (selectedRoute.stops?.length || 0) + 1
            });
            setStopModalVisible(false);
            setNewStopName('');
            fetchRouteDetails(selectedRoute.id);
        } catch(e) { Alert.alert("Error adding stop"); }
    };

    // --- DRIVER ACTIONS ---

    const startLocationUpdates = (routeId: number) => {
        Geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, heading } = position.coords;
                setBusLocation([longitude, latitude]);
                socket.emit('driver_location_update', { routeId, lat: latitude, lng: longitude, bearing: heading });
            },
            (error) => console.log(error),
            { enableHighAccuracy: true, distanceFilter: 10, interval: 5000 }
        );
    };

    const handleStopPress = (stop: any) => {
        if (isDriver) {
            setCurrentStopId(stop.id);
            setCurrentStopPassengers(stop.passengers || []);
            setAttendanceModal(true);
        }
    };

    const markAttendance = async (passengerId: number, status: string) => {
        try {
            await apiClient.post('/transport/attendance', {
                passenger_id: passengerId,
                status: status, // 'present' or 'absent'
                stop_id: currentStopId,
                route_id: selectedRoute.id
            });
            // Update local UI
            setCurrentStopPassengers(prev => prev.map(p => 
                p.id === passengerId ? { ...p, status_marked: status } : p
            ));
        } catch(e) { Alert.alert("Error marking"); }
    };

    // --- RENDERS ---

    // 1. ADMIN LIST VIEW
    if (isAdmin && !selectedRoute) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Manage Routes</Text>
                    <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
                        <Text style={{color:'white', fontWeight:'bold'}}>+ Route</Text>
                    </TouchableOpacity>
                </View>
                <FlatList 
                    data={routes}
                    keyExtractor={(item:any) => item.id.toString()}
                    renderItem={({item}) => (
                        <TouchableOpacity style={styles.card} onPress={() => { setSelectedRoute(item); fetchRouteDetails(item.id); }}>
                            <Text style={styles.cardTitle}>{item.route_name}</Text>
                            <Text style={{color:'#718096'}}>Driver: {item.driver_name || 'N/A'}</Text>
                        </TouchableOpacity>
                    )}
                />
                {/* Add Route Modal */}
                <Modal visible={modalVisible} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>New Route</Text>
                            <TextInput placeholder="Route Name" style={styles.input} value={newRouteName} onChangeText={setNewRouteName} />
                            <View style={styles.row}>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}><Text>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity onPress={handleAddRoute} style={styles.saveBtn}><Text style={{color:'white'}}>Create</Text></TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        );
    }

    // 2. MAP VIEW (Shared by Admin, Driver, Student)
    return (
        <View style={styles.container}>
            {isAdmin && (
                <TouchableOpacity style={styles.backOverlay} onPress={() => setSelectedRoute(null)}>
                    <Text style={{fontWeight:'bold'}}>← Back</Text>
                </TouchableOpacity>
            )}

            <MapLibreGL.MapView 
                style={StyleSheet.absoluteFill} 
                styleURL={STYLE_URL}
                onPress={handleMapPress}
            >
                <MapLibreGL.Camera 
                    defaultSettings={{ centerCoordinate: [78.4867, 17.3850], zoomLevel: 10 }}
                    followUserLocation={isDriver}
                />

                {/* Route Line */}
                {routeShape && (
                    <MapLibreGL.ShapeSource id="routeSource" shape={routeShape}>
                        <MapLibreGL.LineLayer id="routeFill" style={{ lineColor: '#3182CE', lineWidth: 5 }} />
                    </MapLibreGL.ShapeSource>
                )}

                {/* Stops */}
                {selectedRoute?.stops?.map((stop: any, index: number) => (
                    <MapLibreGL.PointAnnotation 
                        key={stop.id} 
                        id={`stop-${stop.id}`} 
                        coordinate={[parseFloat(stop.stop_lng), parseFloat(stop.stop_lat)]}
                        onSelected={() => handleStopPress(stop)}
                    >
                        <View style={styles.stopMarker}>
                            <Text style={styles.stopText}>{index + 1}</Text>
                        </View>
                    </MapLibreGL.PointAnnotation>
                ))}

                {/* Live Bus Icon */}
                {busLocation && (
                    <MapLibreGL.PointAnnotation id="bus" coordinate={busLocation}>
                        <Image source={{ uri: BUS_ICON }} style={{ width: 40, height: 40 }} />
                    </MapLibreGL.PointAnnotation>
                )}
            </MapLibreGL.MapView>

            {/* Admin: Info Panel to add stops */}
            {isAdmin && (
                <View style={styles.adminHint}>
                    <Text>Tap map to add a stop. Drag markers to move (Feature WIP).</Text>
                </View>
            )}

            {/* Admin: Add Stop Modal */}
            <Modal visible={stopModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Stop</Text>
                        <TextInput placeholder="Stop Name" style={styles.input} value={newStopName} onChangeText={setNewStopName} />
                        <View style={styles.row}>
                            <TouchableOpacity onPress={() => setStopModalVisible(false)} style={styles.cancelBtn}><Text>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleAddStop} style={styles.saveBtn}><Text style={{color:'white'}}>Add</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Driver: Attendance Modal */}
            <Modal visible={attendanceModal} animationType="slide" onRequestClose={() => setAttendanceModal(false)}>
                <SafeAreaView style={{flex: 1, backgroundColor:'white'}}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Passenger List</Text>
                        <TouchableOpacity onPress={() => setAttendanceModal(false)}><Text style={{fontSize:18}}>✕</Text></TouchableOpacity>
                    </View>
                    <FlatList 
                        data={currentStopPassengers}
                        keyExtractor={(item:any) => item.id.toString()}
                        renderItem={({item}) => (
                            <View style={styles.passengerRow}>
                                <Text style={styles.passengerName}>{item.full_name}</Text>
                                <View style={{flexDirection:'row'}}>
                                    <TouchableOpacity 
                                        onPress={() => markAttendance(item.id, 'present')}
                                        style={[styles.attBtn, {backgroundColor: item.status_marked === 'present' ? '#48BB78' : '#E2E8F0'}]}
                                    >
                                        <Text>Present</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => markAttendance(item.id, 'absent')}
                                        style={[styles.attBtn, {backgroundColor: item.status_marked === 'absent' ? '#F56565' : '#E2E8F0', marginLeft: 10}]}
                                    >
                                        <Text>Absent</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                        ListEmptyComponent={<Text style={{textAlign:'center', marginTop:20}}>No passengers at this stop.</Text>}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    
    // Header
    header: { padding: 20, flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'white', borderBottomWidth:1, borderColor:'#E2E8F0' },
    headerTitle: { fontSize: 20, fontWeight:'bold', color:'#2D3748' },
    addBtn: { backgroundColor: '#3182CE', padding: 10, borderRadius: 5 },

    // Card
    card: { backgroundColor:'white', margin: 10, padding: 15, borderRadius: 10, elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight:'bold', color:'#2D3748' },

    // Map Overlays
    backOverlay: { position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: 'white', padding: 10, borderRadius: 5, elevation: 5 },
    adminHint: { position: 'absolute', bottom: 20, alignSelf:'center', backgroundColor:'rgba(255,255,255,0.9)', padding: 10, borderRadius: 20 },

    // Markers
    stopMarker: { backgroundColor:'white', borderRadius: 15, width: 30, height: 30, alignItems:'center', justifyContent:'center', borderWidth: 2, borderColor:'#3182CE' },
    stopText: { fontWeight:'bold', color:'#3182CE' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding: 20 },
    modalContent: { backgroundColor:'white', padding: 20, borderRadius: 10 },
    modalTitle: { fontSize: 18, fontWeight:'bold', marginBottom: 15 },
    input: { borderWidth: 1, borderColor: '#CBD5E0', padding: 10, borderRadius: 5, marginBottom: 15 },
    row: { flexDirection:'row', justifyContent:'space-between' },
    cancelBtn: { padding: 10 },
    saveBtn: { backgroundColor:'#3182CE', padding: 10, borderRadius: 5 },

    // Passenger Row
    passengerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding: 15, borderBottomWidth: 1, borderColor:'#EDF2F7' },
    passengerName: { fontSize: 16, color:'#2D3748' },
    attBtn: { padding: 8, borderRadius: 5 }
});

export default RoutesScreen;