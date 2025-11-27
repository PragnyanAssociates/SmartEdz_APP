import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    ActivityIndicator,
    PermissionsAndroid,
    Platform
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import io from 'socket.io-client';
import { getRoadPath } from '../../utils/routeHelper';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SERVER_URL } from '../../../apiConfig';

// --- SOCKET CONNECTION ---
const socket = io(SERVER_URL);

// --- ASSETS ---
const BUS_ICON = 'https://cdn-icons-png.flaticon.com/128/3448/3448339.png';
const STOP_ICON = 'https://cdn-icons-png.flaticon.com/128/684/684908.png';
const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';

// ==========================================================
// 1. LIVE MAP COMPONENT (Receiver: Student/Admin)
// ==========================================================
const LiveMapRoute = ({ routeId, onBack, isAdmin }) => {
    const [routeData, setRouteData] = useState(null);
    const [roadCoords, setRoadCoords] = useState([]);
    const [busLocation, setBusLocation] = useState(null);
    const [busBearing, setBusBearing] = useState(0);
    const mapRef = useRef(null);

    // 1. Fetch Route Data
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Determine API endpoint
                let url = routeId ? `/transport/routes/${routeId}` : '/transport/student/my-route';
                const res = await apiClient.get(url);
                setRouteData(res.data);

                // Set initial bus location from DB (if exists)
                if (res.data.current_lat && res.data.current_lng) {
                    setBusLocation({
                        latitude: parseFloat(res.data.current_lat),
                        longitude: parseFloat(res.data.current_lng),
                    });
                }

                // Calculate Blue Road Path (Polyline)
                if (res.data.stops && res.data.stops.length > 0) {
                    const path = await getRoadPath(res.data.stops);
                    setRoadCoords(path);
                }
            } catch (e) {
                console.log("Error loading route data", e);
                Alert.alert("Error", "Could not load route details.");
            }
        };
        fetchInitialData();
    }, [routeId]);

    // 2. Socket Listener (Listen for Driver Updates)
    useEffect(() => {
        if (!routeData) return;
        
        const rId = routeData.id;
        
        // Join the specific route room
        socket.emit('join_route', rId);

        const handleReceiveLocation = (data) => {
            const newLat = parseFloat(data.lat);
            const newLng = parseFloat(data.lng);
            const newBearing = parseFloat(data.bearing || 0);

            // Animate map camera smoothly to new location
            if (mapRef.current && !isNaN(newLat) && !isNaN(newLng)) {
                mapRef.current.animateCamera({
                    center: { latitude: newLat, longitude: newLng },
                    heading: newBearing,
                    pitch: 0,
                    zoom: 17
                }, { duration: 1000 });
            }

            setBusLocation({ latitude: newLat, longitude: newLng });
            setBusBearing(newBearing);
        };

        socket.on('receive_location', handleReceiveLocation);

        // Cleanup on unmount
        return () => {
            socket.off('receive_location', handleReceiveLocation);
        };
    }, [routeData]);

    if (!routeData) return <ActivityIndicator size="large" color="#008080" style={{marginTop: 50}} />;

    const initialRegion = {
        latitude: parseFloat(routeData.stops?.[0]?.stop_lat || 17.385),
        longitude: parseFloat(routeData.stops?.[0]?.stop_lng || 78.486),
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    };

    return (
        <View style={{ flex: 1 }}>
            {isAdmin && (
                <TouchableOpacity onPress={onBack} style={styles.backOverlay}>
                     <Image source={{ uri: BACK_ICON }} style={{ width: 24, height: 24 }} />
                </TouchableOpacity>
            )}

            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_DEFAULT}
                initialRegion={initialRegion}
            >
                {/* Draw Route Path */}
                {roadCoords.length > 0 && (
                    <Polyline coordinates={roadCoords} strokeColor="#3182CE" strokeWidth={4} />
                )}

                {/* Draw Bus Stops */}
                {routeData.stops && routeData.stops.map((stop, i) => (
                    <Marker
                        key={i}
                        coordinate={{ latitude: parseFloat(stop.stop_lat), longitude: parseFloat(stop.stop_lng) }}
                        title={stop.stop_name}
                    >
                        <Image source={{ uri: STOP_ICON }} style={{ width: 30, height: 30 }} />
                    </Marker>
                ))}

                {/* Draw Live Bus */}
                {busLocation && (
                    <Marker
                        coordinate={busLocation}
                        rotation={busBearing}
                        anchor={{ x: 0.5, y: 0.5 }} // Centers the icon
                        title="Live Bus"
                        flat={true} // Ensures icon rotates flat with the map (Android)
                    >
                        <Image source={{ uri: BUS_ICON }} style={{ width: 45, height: 45 }} />
                    </Marker>
                )}
            </MapView>

            <View style={styles.infoCard}>
                <Text style={styles.title}>{routeData.route_name}</Text>
                <Text style={{color: 'green', fontWeight:'bold'}}>● Live Tracking Active</Text>
            </View>
        </View>
    );
};

// ==========================================================
// 2. DRIVER TRACKER COMPONENT (Sender: Role 'others')
// ==========================================================
const DriverTracker = () => {
    const [isTracking, setIsTracking] = useState(false);
    const [routeInfo, setRouteInfo] = useState(null);
    const watchId = useRef(null);

    // Fetch assigned route on load
    useEffect(() => {
        const fetchRoute = async () => {
            try {
                const res = await apiClient.get('/transport/conductor/students');
                setRouteInfo(res.data.route);
            } catch (e) {
                Alert.alert("Error", "No route assigned to you.");
            }
        };
        fetchRoute();
    }, []);

    const requestPermission = async () => {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } else {
            const res = await Geolocation.requestAuthorization('whenInUse');
            return res === 'granted';
        }
    };

    const startTrip = async () => {
        const hasPermission = await requestPermission();
        if (!hasPermission) return Alert.alert("Permission denied");
        if (!routeInfo) return;

        setIsTracking(true);

        watchId.current = Geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, heading } = position.coords;
                console.log("📤 Sending Location:", latitude, longitude);

                // Emit location to Socket Server
                socket.emit('driver_location_update', {
                    routeId: routeInfo.id,
                    lat: latitude,
                    lng: longitude,
                    bearing: heading || 0
                });
            },
            (error) => {
                console.log(error);
                Alert.alert("Location Error", error.message);
            },
            { 
                enableHighAccuracy: true, 
                distanceFilter: 10,  // Update every 10 meters
                interval: 3000,      // Or every 3 seconds
                fastestInterval: 2000,
                showLocationDialog: true,
                forceRequestLocation: true
            }
        );
    };

    const stopTrip = () => {
        if (watchId.current !== null) {
            Geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
        setIsTracking(false);
    };

    if (!routeInfo) return <View style={styles.center}><ActivityIndicator color="#008080" /></View>;

    return (
        <View style={styles.center}>
            <Image source={{ uri: BUS_ICON }} style={{ width: 100, height: 100, marginBottom: 20 }} />
            <Text style={styles.title}>{routeInfo.route_name}</Text>
            <Text style={{color: '#666', marginBottom: 30}}>Driver / Conductor Console</Text>

            {!isTracking ? (
                <TouchableOpacity style={styles.btnStart} onPress={startTrip}>
                    <Text style={styles.btnText}>START TRIP</Text>
                </TouchableOpacity>
            ) : (
                <View style={{alignItems:'center'}}>
                    <Text style={{color:'green', fontSize:16, marginBottom:10, fontWeight:'bold'}}>Sharing Location...</Text>
                    <TouchableOpacity style={styles.btnStop} onPress={stopTrip}>
                        <Text style={styles.btnText}>END TRIP</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

// ==========================================================
// 3. MAIN SCREEN (Logic Switcher)
// ==========================================================
const RoutesScreen = () => {
    const { user } = useAuth();
    const [adminRoutes, setAdminRoutes] = useState([]);
    const [selectedAdminRouteId, setSelectedAdminRouteId] = useState(null);

    // ✅ CASE 1: Driver/Conductor (Role: 'others')
    // 'others' usually implies staff like drivers/conductors
    if (user?.role === 'others') {
        return <DriverTracker />;
    }

    // ✅ CASE 2: Student
    if (user?.role === 'student') {
        return <LiveMapRoute />;
    }

    // ✅ CASE 3: Admin / Teacher
    // Fetch routes list for selection
    useEffect(() => {
        if (user?.role === 'admin' || user?.role === 'teacher') {
            apiClient.get('/transport/routes')
                .then(res => setAdminRoutes(res.data))
                .catch(e => console.log(e));
        }
    }, [user]);

    // If Admin clicks a route, show the Live Map for that route
    if (selectedAdminRouteId) {
        return <LiveMapRoute routeId={selectedAdminRouteId} onBack={() => setSelectedAdminRouteId(null)} isAdmin={true} />;
    }

    // Default: Admin/Teacher List View
    return (
        <SafeAreaView style={{flex: 1, padding: 16}}>
            <Text style={styles.header}>Transport Routes</Text>
            <FlatList 
                data={adminRoutes}
                keyExtractor={item => item.id.toString()}
                renderItem={({item}) => (
                    <TouchableOpacity style={styles.card} onPress={() => setSelectedAdminRouteId(item.id)}>
                        <View>
                            <Text style={styles.cardTitle}>{item.route_name}</Text>
                            <Text style={{color:'#666'}}>Driver: {item.driver_name || 'Unassigned'}</Text>
                        </View>
                        <Text style={{color: '#3182CE', fontWeight:'bold'}}>Track 📍</Text>
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    header: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#2D3748' },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, color: '#2D3748' },
    card: { padding: 15, backgroundColor: 'white', marginBottom: 10, borderRadius: 8, elevation: 3, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
    btnStart: { backgroundColor: '#38A169', padding: 15, borderRadius: 30, width: 200, alignItems:'center' },
    btnStop: { backgroundColor: '#E53E3E', padding: 15, borderRadius: 30, width: 200, alignItems:'center' },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    backOverlay: { position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: 'white', padding: 8, borderRadius: 20, elevation: 5 },
    infoCard: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'white', padding: 15, borderRadius: 10, elevation: 5 }
});

export default RoutesScreen;