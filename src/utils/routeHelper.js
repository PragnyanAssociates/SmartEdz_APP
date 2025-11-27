import polyline from '@mapbox/polyline';

// ✅ CHANGED to HTTPS to prevent "Network Error" on Android/iOS
const OSRM_API_URL = 'https://router.project-osrm.org/route/v1/driving/';

export const getRoadPath = async (stops) => {
    // Need at least 2 stops to make a path
    if (!stops || stops.length < 2) return [];

    try {
        // Format: "Lng,Lat;Lng,Lat" (OSRM requires Longitude first)
        const coordinatesString = stops
            .map(stop => {
                // Ensure we are passing numbers, not strings
                const lat = parseFloat(stop.stop_lat);
                const lng = parseFloat(stop.stop_lng);
                return `${lng},${lat}`;
            })
            .join(';');

        // Fetch route from OSRM (Open Source Routing Machine)
        const response = await fetch(
            `${OSRM_API_URL}${coordinatesString}?overview=full&geometries=polyline`
        );
        
        if (!response.ok) {
            console.warn("OSRM Request Failed:", response.status);
            return [];
        }

        const json = await response.json();

        if (json.routes && json.routes.length > 0) {
            // Decode the polyline string into coordinates
            const points = polyline.decode(json.routes[0].geometry);
            
            // Mapbox decode returns [lat, lng], React Native Maps needs { latitude, longitude }
            return points.map(point => ({ 
                latitude: point[0], 
                longitude: point[1] 
            }));
        }
        return [];
    } catch (error) {
        console.error("OSRM Route Error:", error);
        return [];
    }
};