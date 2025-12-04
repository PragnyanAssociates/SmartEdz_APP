import polyline from '@mapbox/polyline';

const OSRM_API_URL = 'https://router.project-osrm.org/route/v1/driving/';

export const getRoadPath = async (stops) => {
    if (!stops || stops.length < 2) return [];

    try {
        // OSRM expects: "Lng,Lat;Lng,Lat"
        const coordinatesString = stops
            .map(stop => `${parseFloat(stop.stop_lng)},${parseFloat(stop.stop_lat)}`)
            .join(';');

        const response = await fetch(
            `${OSRM_API_URL}${coordinatesString}?overview=full&geometries=polyline`
        );
        
        const json = await response.json();

        if (json.routes && json.routes.length > 0) {
            // Decode polyline (returns [lat, lng])
            const points = polyline.decode(json.routes[0].geometry);
            
            // MapLibre requires [lng, lat] format
            return points.map(point => [point[1], point[0]]); 
        }
        return [];
    } catch (error) {
        console.error("OSRM Route Error:", error);
        return [];
    }
};