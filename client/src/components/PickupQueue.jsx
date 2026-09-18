import React, { useState } from 'react';
import { 
    MapPin, 
    Clock, 
    Package, 
    RefreshCw, 
    Calendar, 
    WifiOff,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
// import GoogleMap from './GoogleMap'; // Temporarily disabled
// import googleMapsService from '../services/googleMapsService'; // Temporarily disabled

const PickupQueue = ({ pickups, loading, error, onPickupSelect, onRefresh, isOnline }) => {
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
    const [currentLocation, setCurrentLocation] = useState(null);

    // Get current location for map view - TEMPORARILY DISABLED
    // React.useEffect(() => {
    //     if (viewMode === 'map' && !currentLocation) {
    //         googleMapsService.getCurrentLocation()
    //             .then(location => setCurrentLocation(location))
    //             .catch(error => console.warn('Could not get current location:', error));
    //     }
    // }, [viewMode, currentLocation]);
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'high':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low':
                return 'bg-green-100 text-green-800 border-green-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Pending':
                return 'bg-blue-100 text-blue-800';
            case 'Assigned':
                return 'bg-purple-100 text-purple-800';
            case 'En Route':
                return 'bg-indigo-100 text-indigo-800';
            case 'Arrived':
                return 'bg-yellow-100 text-yellow-800';
            case 'In Progress':
                return 'bg-orange-100 text-orange-800';
            case 'Completed':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (timeSlot) => {
        const timeMap = {
            'Morning': '8:00 AM - 12:00 PM',
            'Afternoon': '12:00 PM - 5:00 PM',
            'Evening': '5:00 PM - 8:00 PM'
        };
        return timeMap[timeSlot] || timeSlot;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="text-center">
                    <RefreshCw className="animate-spin rounded-full h-8 w-8 text-green-600 mx-auto mb-3" />
                    <span className="text-gray-600">Loading pickups...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4 max-w-md mx-auto">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
                    <p className="text-red-800 font-medium mb-2">
                        {isOnline ? 'Connection Error' : 'Offline Mode'}
                    </p>
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
                <button
                    onClick={onRefresh}
                    disabled={!isOnline}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                        isOnline
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {isOnline ? 'Retry' : 'Offline - Cannot Retry'}
                </button>
            </div>
        );
    }

    if (pickups.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="bg-gray-50 rounded-lg p-8 max-w-md mx-auto">
                    <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No pickups available</h3>
                    <p className="text-gray-500 mb-4">
                        {isOnline 
                            ? 'All pickups have been assigned or completed. Check back later for new requests.'
                            : 'No cached pickup data available. Connect to internet to load pickups.'
                        }
                    </p>
                    <button
                        onClick={onRefresh}
                        disabled={!isOnline}
                        className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                            isOnline
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        {isOnline ? 'Refresh' : 'Offline'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with status indicators and refresh button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Available Pickups ({pickups.length})
                    </h2>
                    
                    {/* Status indicators */}
                    <div className="flex items-center space-x-2">
                        {!isOnline && (
                            <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                                <WifiOff className="h-3 w-3" />
                                <span>Offline</span>
                            </div>
                        )}
                        {isOnline && (
                            <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                <CheckCircle className="h-3 w-3" />
                                <span>Online</span>
                            </div>
                        )}
                    </div>
                </div>
                
                <button
                    onClick={onRefresh}
                    disabled={!isOnline}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        isOnline
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    <RefreshCw className="h-4 w-4" />
                    <span>{isOnline ? 'Refresh' : 'Offline'}</span>
                </button>
            </div>

            {/* Content based on view mode - MAP VIEW TEMPORARILY DISABLED */}
            {false && viewMode === 'map' && pickups.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {/* GoogleMap component temporarily disabled */}
                    <div className="p-8 text-center text-gray-500">
                        <p>Map view temporarily disabled</p>
                    </div>
                    
                    {/* Map legend */}
                    <div className="p-4 bg-gray-50 border-t">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                                    <span className="text-gray-600">Your Location</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                                    <span className="text-gray-600">Pickup Locations</span>
                                </div>
                            </div>
                            <span className="text-gray-500">Click markers for details</span>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Pickup cards - mobile optimized */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {pickups.map((pickup) => (
                            <div
                                key={pickup._id}
                                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer touch-manipulation"
                                onClick={() => onPickupSelect(pickup)}
                            >
                                {/* Header with status and priority */}
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(pickup.status)}`}>
                                        {pickup.status}
                                    </span>
                                    {pickup.priority && (
                                        <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(pickup.priority)}`}>
                                            {pickup.priority}
                                        </span>
                                    )}
                                </div>

                                {/* Citizen info */}
                                <div className="mb-3">
                                    <h3 className="font-medium text-gray-900 truncate">
                                        {pickup.citizen?.name || pickup.citizenName || 'Unknown Citizen'}
                                    </h3>
                                    <p className="text-sm text-gray-500 truncate">
                                        {pickup.citizen?.email}
                                    </p>
                                </div>

                                {/* Waste info */}
                                <div className="mb-3">
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Package className="w-4 h-4 mr-2 flex-shrink-0" />
                                        <span className="font-medium truncate">
                                            {pickup.wasteItem?.material || pickup.wasteType || 'Unknown'}
                                        </span>
                                        <span className="ml-2 flex-shrink-0">
                                            ({pickup.wasteItem?.weight || pickup.estimatedWeight || 0} kg)
                                        </span>
                                    </div>
                                </div>

                                {/* Address */}
                                <div className="mb-3">
                                    <div className="flex items-start text-sm text-gray-600">
                                        <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                                        <span className="line-clamp-2">{pickup.address}</span>
                                    </div>
                                </div>

                                {/* Schedule info */}
                                <div className="flex items-center justify-between text-sm text-gray-500">
                                    <div className="flex items-center">
                                        <Calendar className="w-4 h-4 mr-1" />
                                        <span className="truncate">
                                            {pickup.scheduledDate ? formatDate(pickup.scheduledDate) : 'TBD'}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-1" />
                                        <span className="text-xs truncate">
                                            {pickup.timeSlot ? formatTime(pickup.timeSlot) : 'TBD'}
                                        </span>
                                    </div>
                                </div>

                                {/* Action button */}
                                <div className="mt-4 pt-3 border-t border-gray-100">
                                    <button
                                        className="w-full px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors touch-manipulation"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPickupSelect(pickup);
                                        }}
                                    >
                                        View Details
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Mobile-friendly load more button if needed */}
                    {pickups.length > 0 && (
                        <div className="text-center pt-4">
                            <p className="text-sm text-gray-500">
                                Showing {pickups.length} pickup{pickups.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PickupQueue;