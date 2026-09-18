import React, { useState, useEffect } from 'react';
import axios from 'axios';
import socketService from '../services/socketService.js';

const PickupTracker = ({ pickupId, userRole }) => {
    const [trackingData, setTrackingData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        fetchTrackingData();
        setupRealtimeTracking();
        
        return () => {
            // Cleanup
            socketService.off('pickup_status_updated', handleStatusUpdate);
            socketService.off('collector_location_updated', handleLocationUpdate);
            socketService.unsubscribeFromPickup(pickupId);
        };
    }, [pickupId]);

    const fetchTrackingData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/tracking/${pickupId}/tracking`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setTrackingData(response.data.data);
            } else {
                setError('Failed to load tracking data');
            }
        } catch (err) {
            console.error('Fetch tracking data error:', err);
            setError(err.response?.data?.message || 'Failed to load tracking data');
        } finally {
            setLoading(false);
        }
    };

    const setupRealtimeTracking = () => {
        const token = localStorage.getItem('token');
        
        if (token && !socketService.isSocketConnected()) {
            socketService.connect(token);
        }

        // Subscribe to pickup updates
        socketService.subscribeToPickup(pickupId);
        
        // Set up event listeners
        socketService.on('pickup_status_updated', handleStatusUpdate);
        socketService.on('collector_location_updated', handleLocationUpdate);
        
        setIsConnected(socketService.isSocketConnected());
    };

    const handleStatusUpdate = (data) => {
        if (data.pickupId === pickupId) {
            setTrackingData(prevData => ({
                ...prevData,
                pickup: {
                    ...prevData.pickup,
                    status: data.status,
                    estimatedArrival: data.estimatedArrival,
                    completedAt: data.completedAt
                },
                recentUpdates: [
                    {
                        status: data.status,
                        timestamp: data.timestamp || new Date(),
                        changedBy: data.updatedBy || 'System',
                        reason: data.message
                    },
                    ...prevData.recentUpdates.slice(0, 9)
                ]
            }));
        }
    };

    const handleLocationUpdate = (data) => {
        if (data.pickupId === pickupId) {
            setTrackingData(prevData => ({
                ...prevData,
                pickup: {
                    ...prevData.pickup,
                    collectorLocation: {
                        lat: data.lat,
                        lng: data.lng,
                        updatedAt: data.timestamp
                    }
                }
            }));
        }
    };

    const getStatusIcon = (status) => {
        const icons = {
            'Pending': '⏳',
            'Assigned': '👤',
            'En Route': '🚗',
            'Arrived': '📍',
            'In Progress': '🔄',
            'Completed': '✅',
            'Cancelled': '❌'
        };
        return icons[status] || '📦';
    };

    const getStatusColor = (status) => {
        const colors = {
            'Pending': 'text-yellow-600 bg-yellow-50',
            'Assigned': 'text-blue-600 bg-blue-50',
            'En Route': 'text-purple-600 bg-purple-50',
            'Arrived': 'text-orange-600 bg-orange-50',
            'In Progress': 'text-indigo-600 bg-indigo-50',
            'Completed': 'text-green-600 bg-green-50',
            'Cancelled': 'text-red-600 bg-red-50'
        };
        return colors[status] || 'text-gray-600 bg-gray-50';
    };

    const formatTime = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    const formatTimeAgo = (dateString) => {
        if (!dateString) return '';
        const now = new Date();
        const time = new Date(dateString);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-center text-red-600">
                    <p className="text-lg font-semibold">Error Loading Tracking</p>
                    <p className="text-sm mt-2">{error}</p>
                    <button 
                        onClick={fetchTrackingData}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!trackingData) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-center text-gray-600">No tracking data available</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Pickup Tracking</h2>
                <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-gray-600">
                        {isConnected ? 'Live' : 'Offline'}
                    </span>
                </div>
            </div>

            {/* Current Status */}
            <div className="mb-6">
                <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${getStatusColor(trackingData.pickup.status)}`}>
                    <span className="mr-2">{getStatusIcon(trackingData.pickup.status)}</span>
                    {trackingData.pickup.status}
                </div>
                
                {trackingData.pickup.estimatedArrival && trackingData.pickup.status === 'En Route' && (
                    <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Estimated Arrival:</span> {formatTime(trackingData.pickup.estimatedArrival)}
                    </div>
                )}
                
                {trackingData.pickup.completedAt && (
                    <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Completed:</span> {formatTime(trackingData.pickup.completedAt)}
                    </div>
                )}
            </div>

            {/* Collector Info */}
            {trackingData.collector && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-2">Assigned Collector</h3>
                    <div className="text-sm text-gray-600">
                        <p><span className="font-medium">Name:</span> {trackingData.collector.name}</p>
                        <p><span className="font-medium">Email:</span> {trackingData.collector.email}</p>
                    </div>
                </div>
            )}

            {/* Location Info */}
            {trackingData.pickup.collectorLocation && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-2">Collector Location</h3>
                    <div className="text-sm text-gray-600">
                        <p><span className="font-medium">Coordinates:</span> {trackingData.pickup.collectorLocation.lat.toFixed(6)}, {trackingData.pickup.collectorLocation.lng.toFixed(6)}</p>
                        <p><span className="font-medium">Last Updated:</span> {formatTime(trackingData.pickup.collectorLocation.updatedAt)}</p>
                    </div>
                    {/* You could integrate a map component here */}
                </div>
            )}

            {/* QR Verification Status */}
            {trackingData.pickup.qrVerified && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                        <span className="text-green-600 mr-2">✅</span>
                        <span className="font-semibold text-green-800">QR Code Verified</span>
                    </div>
                    <p className="text-sm text-green-600 mt-1">Collector has verified their arrival</p>
                </div>
            )}

            {/* Recent Updates */}
            <div>
                <h3 className="font-semibold text-gray-800 mb-4">Recent Updates</h3>
                {trackingData.recentUpdates && trackingData.recentUpdates.length > 0 ? (
                    <div className="space-y-3">
                        {trackingData.recentUpdates.map((update, index) => (
                            <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                                <span className="text-lg">{getStatusIcon(update.status)}</span>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-800">{update.status}</span>
                                        <span className="text-sm text-gray-500">{formatTimeAgo(update.timestamp)}</span>
                                    </div>
                                    {update.reason && (
                                        <p className="text-sm text-gray-600 mt-1">{update.reason}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">Updated by {update.changedBy}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-600 text-center py-4">No recent updates</p>
                )}
            </div>

            {/* Refresh Button */}
            <div className="mt-6 text-center">
                <button 
                    onClick={fetchTrackingData}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                    Refresh Tracking
                </button>
            </div>
        </div>
    );
};

export default PickupTracker;