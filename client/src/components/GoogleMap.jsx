import React, { useEffect, useRef, useState } from 'react';
import googleMapsService from '../services/googleMapsService';

const GoogleMap = ({ 
    pickups = [], 
    currentLocation = null, 
    onPickupSelect = null,
    height = '400px',
    showRoute = false,
    className = ''
}) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const directionsRendererRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        initializeMap();
        return () => {
            cleanup();
        };
    }, []);

    useEffect(() => {
        if (mapInstanceRef.current) {
            updateMapMarkers();
        }
    }, [pickups, currentLocation]);

    useEffect(() => {
        if (mapInstanceRef.current && showRoute && pickups.length > 0) {
            showRouteOnMap();
        }
    }, [showRoute, pickups]);

    const initializeMap = async () => {
        try {
            setLoading(true);
            setError(null);

            if (!googleMapsService.isApiAvailable()) {
                throw new Error('Google Maps API key not configured');
            }

            await googleMapsService.loadGoogleMaps();

            // Default center (can be overridden by current location or pickups)
            let center = { lat: 40.7128, lng: -74.0060 }; // New York City default

            if (currentLocation) {
                center = currentLocation;
            } else if (pickups.length > 0 && pickups[0].coordinates) {
                center = pickups[0].coordinates;
            }

            // Initialize map
            mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                zoom: 12,
                center: center,
                mapTypeId: window.google.maps.MapTypeId.ROADMAP,
                styles: [
                    {
                        featureType: 'poi',
                        elementType: 'labels',
                        stylers: [{ visibility: 'off' }]
                    }
                ]
            });

            updateMapMarkers();
            setLoading(false);
        } catch (err) {
            console.error('Map initialization failed:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    const updateMapMarkers = () => {
        if (!mapInstanceRef.current) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();

        // Add current location marker
        if (currentLocation) {
            const currentLocationMarker = new window.google.maps.Marker({
                position: currentLocation,
                map: mapInstanceRef.current,
                title: 'Your Location',
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="8" fill="#4F46E5" stroke="#FFFFFF" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" fill="#FFFFFF"/>
                        </svg>
                    `),
                    scaledSize: new window.google.maps.Size(24, 24),
                    anchor: new window.google.maps.Point(12, 12)
                }
            });
            markersRef.current.push(currentLocationMarker);
            bounds.extend(currentLocation);
        }

        // Add pickup markers
        pickups.forEach((pickup, index) => {
            if (!pickup.coordinates) return;

            const marker = new window.google.maps.Marker({
                position: pickup.coordinates,
                map: mapInstanceRef.current,
                title: `Pickup ${index + 1}: ${pickup.address?.street || 'Unknown Address'}`,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16 2C10.48 2 6 6.48 6 12C6 20 16 30 16 30C16 30 26 20 26 12C26 6.48 21.52 2 16 2Z" fill="#10B981" stroke="#FFFFFF" stroke-width="2"/>
                            <circle cx="16" cy="12" r="4" fill="#FFFFFF"/>
                            <text x="16" y="16" text-anchor="middle" fill="#10B981" font-size="10" font-weight="bold">${index + 1}</text>
                        </svg>
                    `),
                    scaledSize: new window.google.maps.Size(32, 32),
                    anchor: new window.google.maps.Point(16, 32)
                }
            });

            // Add click listener for pickup selection
            if (onPickupSelect) {
                marker.addListener('click', () => {
                    onPickupSelect(pickup);
                });
            }

            // Add info window
            const infoWindow = new window.google.maps.InfoWindow({
                content: `
                    <div class="p-2">
                        <h3 class="font-semibold text-sm">Pickup #${index + 1}</h3>
                        <p class="text-xs text-gray-600">${pickup.address?.street || 'Unknown Address'}</p>
                        <p class="text-xs text-gray-600">${pickup.address?.city || ''}</p>
                        <p class="text-xs mt-1">Status: <span class="font-medium">${pickup.status || 'pending'}</span></p>
                        <p class="text-xs">Weight: ${pickup.estimatedWeight || 0} kg</p>
                    </div>
                `
            });

            marker.addListener('click', () => {
                infoWindow.open(mapInstanceRef.current, marker);
            });

            markersRef.current.push(marker);
            bounds.extend(pickup.coordinates);
        });

        // Fit map to show all markers
        if (markersRef.current.length > 0) {
            mapInstanceRef.current.fitBounds(bounds);
            
            // Ensure minimum zoom level
            const listener = window.google.maps.event.addListener(mapInstanceRef.current, 'idle', () => {
                if (mapInstanceRef.current.getZoom() > 15) {
                    mapInstanceRef.current.setZoom(15);
                }
                window.google.maps.event.removeListener(listener);
            });
        }
    };

    const showRouteOnMap = async () => {
        if (!mapInstanceRef.current || pickups.length === 0) return;

        try {
            // Clear existing route
            if (directionsRendererRef.current) {
                directionsRendererRef.current.setMap(null);
            }

            // Create directions renderer
            directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
                suppressMarkers: true, // We'll use our custom markers
                polylineOptions: {
                    strokeColor: '#10B981',
                    strokeWeight: 4,
                    strokeOpacity: 0.8
                }
            });

            directionsRendererRef.current.setMap(mapInstanceRef.current);

            // Get optimized route
            const routeData = await googleMapsService.optimizeRoute(pickups, currentLocation);
            
            if (routeData.route.length > 0) {
                // Create waypoints for directions
                const waypoints = routeData.route.slice(1, -1).map(pickup => ({
                    location: pickup.coordinates,
                    stopover: true
                }));

                // Get directions
                const origin = currentLocation || routeData.route[0].coordinates;
                const destination = routeData.route[routeData.route.length - 1].coordinates;

                const directions = await googleMapsService.getDirections(origin, destination);
                directionsRendererRef.current.setDirections(directions);
            }
        } catch (error) {
            console.error('Failed to show route:', error);
        }
    };

    const cleanup = () => {
        // Clear markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        // Clear directions
        if (directionsRendererRef.current) {
            directionsRendererRef.current.setMap(null);
            directionsRendererRef.current = null;
        }

        // Clear map instance
        mapInstanceRef.current = null;
    };

    if (loading) {
        return (
            <div 
                className={`flex items-center justify-center bg-gray-100 ${className}`}
                style={{ height }}
            >
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading map...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div 
                className={`flex items-center justify-center bg-gray-100 ${className}`}
                style={{ height }}
            >
                <div className="text-center p-4">
                    <div className="text-red-500 mb-2">
                        <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{error}</p>
                    <button
                        onClick={initializeMap}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`} style={{ height }}>
            <div ref={mapRef} className="w-full h-full rounded-lg" />
            
            {/* Map controls */}
            <div className="absolute top-4 right-4 space-y-2">
                {currentLocation && (
                    <button
                        onClick={() => {
                            if (mapInstanceRef.current) {
                                mapInstanceRef.current.setCenter(currentLocation);
                                mapInstanceRef.current.setZoom(15);
                            }
                        }}
                        className="bg-white p-2 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                        title="Center on my location"
                    >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                )}
                
                {pickups.length > 1 && (
                    <button
                        onClick={() => showRouteOnMap()}
                        className="bg-white p-2 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                        title="Show optimized route"
                    >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default GoogleMap;