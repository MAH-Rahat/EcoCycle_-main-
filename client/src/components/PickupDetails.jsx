import React, { useState } from 'react';
import { 
    ArrowLeft, 
    MapPin, 
    Clock, 
    User, 
    Package, 
    Calendar,
    Phone,
    QrCode,
    Navigation,
    CheckCircle,
    AlertCircle,
    WifiOff,
    Upload
} from 'lucide-react';
// import googleMapsService from '../services/googleMapsService'; // Temporarily disabled

const PickupDetails = ({ pickup, onStatusUpdate, onBack, isOnline }) => {
    const [updating, setUpdating] = useState(false);
    const [showQRCode, setShowQRCode] = useState(false);

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

    const getNextStatus = (currentStatus) => {
        const statusFlow = {
            'Pending': 'Assigned',
            'Assigned': 'En Route',
            'En Route': 'Arrived',
            'Arrived': 'In Progress',
            'In Progress': 'Completed'
        };
        return statusFlow[currentStatus];
    };

    const getStatusAction = (currentStatus) => {
        const actionMap = {
            'Pending': 'Accept Pickup',
            'Assigned': 'Start Route',
            'En Route': 'Mark Arrived',
            'Arrived': 'Start Collection',
            'In Progress': 'Complete Pickup'
        };
        return actionMap[currentStatus];
    };

    const handleStatusUpdate = async (newStatus) => {
        if (!isOnline && newStatus !== 'Assigned') {
            // Show offline message but allow the update to be cached
            setUpdating(true);
            try {
                await onStatusUpdate(pickup._id, newStatus);
                // Show success message for offline update
                alert('Status update saved offline. It will sync when you\'re back online.');
            } catch (error) {
                alert('Failed to save status update offline. Please try again.');
            } finally {
                setUpdating(false);
            }
            return;
        }

        setUpdating(true);
        try {
            await onStatusUpdate(pickup._id, newStatus);
        } catch (error) {
            alert('Failed to update status. Please try again.');
        } finally {
            setUpdating(false);
        }
    };

    const openNavigation = () => {
        if (pickup.address) {
            // Use enhanced Google Maps service with mobile optimization
            try {
                const options = {
                    travelMode: 'driving'
                };
                
                // Try to get current location for better navigation
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const origin = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            };
                            
                            // Open navigation with current location as origin
                            const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${encodeURIComponent(pickup.address)}&travelmode=driving`;
                            
                            // On mobile, try to open in Google Maps app
                            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                                const appUrl = url.replace('https://www.google.com/maps/', 'googlemaps://');
                                window.location.href = appUrl;
                                
                                // Fallback to web version
                                setTimeout(() => {
                                    window.open(url, '_blank');
                                }, 1000);
                            } else {
                                window.open(url, '_blank');
                            }
                        },
                        (error) => {
                            // Fallback without current location
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup.address)}`;
                            window.open(url, '_blank');
                        },
                        { timeout: 5000 }
                    );
                } else {
                    // Fallback for browsers without geolocation
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup.address)}`;
                    window.open(url, '_blank');
                }
            } catch (error) {
                console.error('Navigation failed:', error);
                // Final fallback
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup.address)}`;
                window.open(url, '_blank');
            }
        }
    };

    const showNavigationOptions = () => {
        if (!pickup.address) return;

        // Google Maps service temporarily disabled
        alert('Navigation options temporarily disabled. Use the Navigate button instead.');
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
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

    const nextStatus = getNextStatus(pickup.status);
    const canUpdateStatus = nextStatus && (isOnline || pickup.status === 'Pending');

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center text-gray-600 hover:text-gray-900 touch-manipulation"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Queue
                </button>
                <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(pickup.status)}`}>
                        {pickup.status}
                    </span>
                    {!isOnline && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                            <WifiOff className="h-3 w-3" />
                            <span>Offline</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Citizen Information */}
                <div className="p-4 sm:p-6 border-b border-gray-200">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Citizen Information</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Name</label>
                            <div className="mt-1 flex items-center">
                                <User className="h-4 w-4 text-gray-400 mr-2" />
                                <p className="text-sm text-gray-900">
                                    {pickup.citizen?.name || pickup.citizenName || 'Unknown'}
                                </p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Email</label>
                            <p className="mt-1 text-sm text-gray-900 break-all">
                                {pickup.citizen?.email || 'Not provided'}
                            </p>
                        </div>
                        {pickup.citizen?.mobile && (
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-500">Phone</label>
                                <div className="mt-1 flex items-center">
                                    <Phone className="h-4 w-4 text-gray-400 mr-2" />
                                    <a
                                        href={`tel:${pickup.citizen.mobile}`}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        {pickup.citizen.mobile}
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Waste Information */}
                {(pickup.wasteItem || pickup.wasteType) && (
                    <div className="p-4 sm:p-6 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Waste Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-500">Material Type</label>
                                <div className="mt-1 flex items-center">
                                    <Package className="h-4 w-4 text-gray-400 mr-2" />
                                    <p className="text-sm text-gray-900">
                                        {pickup.wasteItem?.material || pickup.wasteType || 'Unknown'}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-500">Estimated Weight</label>
                                <p className="mt-1 text-sm text-gray-900">
                                    {pickup.wasteItem?.weight || pickup.estimatedWeight || 0} kg
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Location & Schedule */}
                <div className="p-4 sm:p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Pickup Details</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Address</label>
                            <div className="mt-1 flex items-start">
                                <MapPin className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-gray-900">{pickup.address}</p>
                            </div>
                            <button
                                onClick={openNavigation}
                                className="mt-2 inline-flex items-center px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-full hover:bg-blue-100 touch-manipulation"
                            >
                                <Navigation className="w-3 h-3 mr-1" />
                                Open in Maps
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-500">Scheduled Date</label>
                                <div className="mt-1 flex items-center">
                                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                                    <p className="text-sm text-gray-900">
                                        {pickup.scheduledDate ? formatDate(pickup.scheduledDate) : 'TBD'}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-500">Time Slot</label>
                                <div className="mt-1 flex items-center">
                                    <Clock className="h-4 w-4 text-gray-400 mr-2" />
                                    <p className="text-sm text-gray-900">
                                        {pickup.timeSlot ? formatTime(pickup.timeSlot) : 'TBD'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* QR Code Section */}
                {pickup.qrCode && (
                    <div className="p-4 sm:p-6 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Code Verification</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-2">
                                    Use this QR code to verify pickup completion
                                </p>
                                <p className="text-xs text-gray-500 font-mono">
                                    QR Code: {pickup.qrCode}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowQRCode(!showQRCode)}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 touch-manipulation"
                            >
                                <QrCode className="h-4 w-4" />
                                <span>{showQRCode ? 'Hide QR' : 'Show QR'}</span>
                            </button>
                        </div>
                        {showQRCode && pickup.qrCodeImage && (
                            <div className="mt-4 text-center">
                                <img
                                    src={pickup.qrCodeImage}
                                    alt="Pickup QR Code"
                                    className="mx-auto w-32 h-32 sm:w-48 sm:h-48 border border-gray-200 rounded-lg"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="p-4 sm:p-6">
                    <div className="flex flex-col gap-3">
                        {canUpdateStatus && (
                            <button
                                onClick={() => handleStatusUpdate(nextStatus)}
                                disabled={updating}
                                className={`flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
                                    updating
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                            >
                                {updating ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        <span>Updating...</span>
                                    </>
                                ) : (
                                    <>
                                        {!isOnline && <Upload className="h-4 w-4" />}
                                        <span>{getStatusAction(pickup.status)}</span>
                                    </>
                                )}
                            </button>
                        )}
                        
                        {pickup.status === 'Completed' && (
                            <div className="flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-green-700 bg-green-50 rounded-lg">
                                <CheckCircle className="h-4 w-4" />
                                <span>Pickup Completed</span>
                            </div>
                        )}

                        {pickup.address && (
                            <button
                                onClick={openNavigation}
                                className="flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors touch-manipulation"
                            >
                                <Navigation className="h-4 w-4" />
                                <span>Navigate</span>
                            </button>
                        )}
                    </div>

                    {!isOnline && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-start space-x-2">
                                <WifiOff className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-yellow-800 font-medium">Offline Mode</p>
                                    <p className="text-xs text-yellow-700 mt-1">
                                        Status updates will be saved locally and synced when you're back online.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Additional Information */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Pickup Instructions</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Verify citizen identity before collection</li>
                    <li>• Scan QR code to confirm pickup completion</li>
                    <li>• Weigh waste and update actual weight</li>
                    <li>• Take photos if required for verification</li>
                    <li>• Update status to completed after collection</li>
                </ul>
            </div>
        </div>
    );
};

export default PickupDetails;