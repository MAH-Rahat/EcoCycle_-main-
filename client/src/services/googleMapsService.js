/**
 * Google Maps Service for EcoCycle Platform
 * Provides navigation, route optimization, and location services
 */

class GoogleMapsService {
    constructor() {
        this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
        this.isLoaded = false;
        this.loadPromise = null;
    }

    /**
     * Load Google Maps JavaScript API
     */
    async loadGoogleMaps() {
        if (this.isLoaded) {
            return window.google;
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = new Promise((resolve, reject) => {
            // Check if already loaded
            if (window.google && window.google.maps) {
                this.isLoaded = true;
                resolve(window.google);
                return;
            }

            // Create script element
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=geometry,places`;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                this.isLoaded = true;
                resolve(window.google);
            };

            script.onerror = () => {
                reject(new Error('Failed to load Google Maps API'));
            };

            document.head.appendChild(script);
        });

        return this.loadPromise;
    }

    /**
     * Get navigation URL for a destination with mobile optimization
     */
    getNavigationUrl(destination, origin = null, options = {}) {
        const encodedDestination = encodeURIComponent(destination);
        let url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;
        
        if (origin) {
            const encodedOrigin = encodeURIComponent(origin);
            url += `&origin=${encodedOrigin}`;
        }
        
        // Add mobile-specific parameters
        if (options.travelMode) {
            url += `&travelmode=${options.travelMode.toLowerCase()}`;
        }
        
        // Add waypoints for multi-stop routes
        if (options.waypoints && options.waypoints.length > 0) {
            const waypointStr = options.waypoints
                .map(wp => encodeURIComponent(wp))
                .join('|');
            url += `&waypoints=${waypointStr}`;
        }
        
        return url;
    }

    /**
     * Open navigation in new tab/window with mobile detection
     */
    openNavigation(destination, origin = null, options = {}) {
        const url = this.getNavigationUrl(destination, origin, options);
        
        // On mobile devices, try to open in the native app
        if (this.isMobileDevice()) {
            // Try to open in Google Maps app first
            const appUrl = url.replace('https://www.google.com/maps/', 'googlemaps://');
            
            // Create a temporary link to test if the app opens
            const tempLink = document.createElement('a');
            tempLink.href = appUrl;
            tempLink.style.display = 'none';
            document.body.appendChild(tempLink);
            
            // Try to open the app
            tempLink.click();
            
            // Fallback to web version after a short delay
            setTimeout(() => {
                window.open(url, '_blank');
                document.body.removeChild(tempLink);
            }, 1000);
        } else {
            window.open(url, '_blank');
        }
    }

    /**
     * Detect if running on mobile device
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Get fallback navigation options when Google Maps API is not available
     */
    getFallbackNavigation(destination) {
        const encodedDestination = encodeURIComponent(destination);
        const isMobile = this.isMobileDevice();
        
        const options = [
            {
                name: 'Google Maps (Web)',
                url: `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`,
                icon: '🗺️',
                primary: !isMobile
            }
        ];

        if (isMobile) {
            // Add mobile-specific options
            options.unshift(
                {
                    name: 'Google Maps App',
                    url: `googlemaps://?q=${encodedDestination}`,
                    icon: '📱',
                    primary: true
                },
                {
                    name: 'Apple Maps',
                    url: `https://maps.apple.com/?q=${encodedDestination}`,
                    icon: '🍎',
                    primary: false
                },
                {
                    name: 'Waze',
                    url: `https://waze.com/ul?q=${encodedDestination}`,
                    icon: '🚗',
                    primary: false
                }
            );
        }
        
        return options;
    }

    /**
     * Get current location with enhanced error handling for mobile
     */
    async getCurrentLocation(options = {}) {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            const defaultOptions = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000, // 5 minutes
                ...options
            };

            // On mobile, try to get high accuracy location
            if (this.isMobileDevice()) {
                defaultOptions.enableHighAccuracy = true;
                defaultOptions.timeout = 15000; // Longer timeout for mobile
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    });
                },
                (error) => {
                    let message = 'Unable to get location';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Location access denied by user';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Location information unavailable';
                            break;
                        case error.TIMEOUT:
                            message = 'Location request timed out';
                            break;
                    }
                    reject(new Error(message));
                },
                defaultOptions
            );
        });
    }

    /**
     * Watch position for real-time tracking (mobile optimized)
     */
    watchPosition(callback, errorCallback, options = {}) {
        if (!navigator.geolocation) {
            errorCallback(new Error('Geolocation is not supported'));
            return null;
        }

        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000, // 30 seconds for real-time tracking
            ...options
        };

        return navigator.geolocation.watchPosition(
            (position) => {
                callback({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: position.timestamp
                });
            },
            (error) => {
                let message = 'Location tracking failed';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location access denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location unavailable';
                        break;
                    case error.TIMEOUT:
                        message = 'Location timeout';
                        break;
                }
                errorCallback(new Error(message));
            },
            defaultOptions
        );
    }

    /**
     * Stop watching position
     */
    clearWatch(watchId) {
        if (watchId && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchId);
        }
    }

    /**
     * Calculate distance between two points using Haversine formula
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in kilometers
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Optimize route for multiple pickup locations with mobile considerations
     * Uses a simple nearest neighbor algorithm for demonstration
     * In production, you'd use Google's Directions API with waypoint optimization
     */
    async optimizeRoute(pickups, startLocation = null, options = {}) {
        try {
            if (!startLocation) {
                startLocation = await this.getCurrentLocation();
            }

            // Simple nearest neighbor optimization
            const optimizedRoute = [];
            const remaining = [...pickups];
            let currentLocation = startLocation;

            while (remaining.length > 0) {
                let nearestIndex = 0;
                let nearestDistance = Infinity;

                // Find nearest pickup
                remaining.forEach((pickup, index) => {
                    const distance = this.calculateDistance(
                        currentLocation.lat,
                        currentLocation.lng,
                        pickup.coordinates?.lat || 0,
                        pickup.coordinates?.lng || 0
                    );

                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestIndex = index;
                    }
                });

                // Add nearest pickup to route
                const nearestPickup = remaining.splice(nearestIndex, 1)[0];
                optimizedRoute.push({
                    ...nearestPickup,
                    distance: nearestDistance,
                    estimatedTime: this.estimateTravelTime(nearestDistance, options.travelMode)
                });

                // Update current location
                currentLocation = nearestPickup.coordinates || currentLocation;
            }

            const totalDistance = optimizedRoute.reduce((sum, pickup) => sum + pickup.distance, 0);
            const totalTime = optimizedRoute.reduce((sum, pickup) => sum + pickup.estimatedTime, 0);

            return {
                route: optimizedRoute,
                totalDistance: totalDistance,
                totalTime: totalTime,
                startLocation: startLocation,
                optimizationMethod: 'nearest_neighbor'
            };
        } catch (error) {
            console.error('Route optimization failed:', error);
            throw new Error('Failed to optimize route');
        }
    }

    /**
     * Estimate travel time based on distance and travel mode
     */
    estimateTravelTime(distanceKm, travelMode = 'driving') {
        let averageSpeed;
        
        switch (travelMode.toLowerCase()) {
            case 'walking':
                averageSpeed = 5; // km/h
                break;
            case 'bicycling':
                averageSpeed = 15; // km/h
                break;
            case 'transit':
                averageSpeed = 25; // km/h (including stops)
                break;
            case 'driving':
            default:
                averageSpeed = 30; // km/h in urban areas
                break;
        }
        
        return (distanceKm / averageSpeed) * 60; // Return time in minutes
    }

    /**
     * Get directions between two points
     */
    async getDirections(origin, destination) {
        try {
            await this.loadGoogleMaps();
            
            const directionsService = new window.google.maps.DirectionsService();
            
            return new Promise((resolve, reject) => {
                directionsService.route({
                    origin: origin,
                    destination: destination,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                    unitSystem: window.google.maps.UnitSystem.METRIC,
                    avoidHighways: false,
                    avoidTolls: false
                }, (result, status) => {
                    if (status === 'OK') {
                        resolve(result);
                    } else {
                        reject(new Error(`Directions request failed: ${status}`));
                    }
                });
            });
        } catch (error) {
            console.error('Get directions failed:', error);
            throw error;
        }
    }

    /**
     * Geocode an address to get coordinates
     */
    async geocodeAddress(address) {
        try {
            await this.loadGoogleMaps();
            
            const geocoder = new window.google.maps.Geocoder();
            
            return new Promise((resolve, reject) => {
                geocoder.geocode({ address: address }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        const location = results[0].geometry.location;
                        resolve({
                            lat: location.lat(),
                            lng: location.lng(),
                            formatted_address: results[0].formatted_address
                        });
                    } else {
                        reject(new Error(`Geocoding failed: ${status}`));
                    }
                });
            });
        } catch (error) {
            console.error('Geocoding failed:', error);
            throw error;
        }
    }

    /**
     * Check if Google Maps API is available
     */
    isApiAvailable() {
        return !!this.apiKey && this.apiKey !== '';
    }

    /**
     * Get fallback navigation options when Google Maps API is not available
     */
    getFallbackNavigation(destination) {
        const encodedDestination = encodeURIComponent(destination);
        const isMobile = this.isMobileDevice();
        
        const options = [
            {
                name: 'Google Maps (Web)',
                url: `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`,
                icon: '🗺️',
                primary: !isMobile
            }
        ];

        if (isMobile) {
            // Add mobile-specific options
            options.unshift(
                {
                    name: 'Google Maps App',
                    url: `googlemaps://?q=${encodedDestination}`,
                    icon: '📱',
                    primary: true
                },
                {
                    name: 'Apple Maps',
                    url: `https://maps.apple.com/?q=${encodedDestination}`,
                    icon: '🍎',
                    primary: false
                },
                {
                    name: 'Waze',
                    url: `https://waze.com/ul?q=${encodedDestination}`,
                    icon: '🚗',
                    primary: false
                }
            );
        }
        
        return options;
    }
}

// Create singleton instance
const googleMapsService = new GoogleMapsService();

export default googleMapsService;