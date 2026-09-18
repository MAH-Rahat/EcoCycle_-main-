import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const QRScanner = ({ onScanSuccess, onScanError }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    // Cleanup camera stream on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // Use back camera if available
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setIsScanning(true);
            }
        } catch (err) {
            console.error('Camera access error:', err);
            setError('Unable to access camera. Please check permissions or enter code manually.');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsScanning(false);
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        if (!manualCode.trim()) return;

        setLoading(true);
        setError(null);

        try {
            await verifyQRCode(manualCode.trim());
            setManualCode('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const verifyQRCode = async (qrCode) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/qr/verify', 
                { qrCode },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                onScanSuccess && onScanSuccess(response.data.data);
            } else {
                throw new Error(response.data.message || 'Verification failed');
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to verify QR code';
            onScanError && onScanError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    // Simple QR code detection (basic implementation)
    // In a production app, you'd use a proper QR code scanning library
    const captureFrame = () => {
        if (!videoRef.current || !isScanning) return;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const video = videoRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        // This is a simplified approach - in reality you'd use a QR code detection library
        // For now, we'll rely on manual input
        setTimeout(captureFrame, 500);
    };

    useEffect(() => {
        if (isScanning) {
            captureFrame();
        }
    }, [isScanning]);

    return (
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">QR Code Scanner</h2>
            
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Camera Scanner */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Scan QR Code</h3>
                
                {!isScanning ? (
                    <button
                        onClick={startCamera}
                        className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        Start Camera Scanner
                    </button>
                ) : (
                    <div>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-64 bg-gray-200 rounded-lg mb-3"
                        />
                        <button
                            onClick={stopCamera}
                            className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                            Stop Scanner
                        </button>
                        <p className="text-sm text-gray-600 mt-2 text-center">
                            Point your camera at the QR code
                        </p>
                    </div>
                )}
            </div>

            {/* Manual Input */}
            <div>
                <h3 className="text-lg font-semibold mb-2">Or Enter Code Manually</h3>
                <form onSubmit={handleManualSubmit}>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            placeholder="Enter QR code (e.g., PICKUP-xxx-xxx)"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={loading || !manualCode.trim()}
                            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">Instructions:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Use the camera to scan the QR code shown by the citizen</li>
                    <li>• Or manually enter the code if scanning doesn't work</li>
                    <li>• Make sure you're at the pickup location before scanning</li>
                    <li>• The QR code verifies your arrival and starts the collection process</li>
                </ul>
            </div>
        </div>
    );
};

// QR Code Display Component (for citizens)
export const QRCodeDisplay = ({ pickupId }) => {
    const [qrData, setQrData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchQRCode();
    }, [pickupId]);

    const fetchQRCode = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/qr/pickup/${pickupId}/qr`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setQrData(response.data.data);
            } else {
                setError('Failed to load QR code');
            }
        } catch (err) {
            console.error('Fetch QR code error:', err);
            setError(err.response?.data?.message || 'Failed to load QR code');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading QR code...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                    onClick={fetchQRCode}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!qrData) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-600">QR code not available</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <h3 className="text-lg font-semibold mb-4">Pickup Verification QR Code</h3>
            
            <div className="mb-4">
                <img
                    src={qrData.qrCodeImage}
                    alt="Pickup QR Code"
                    className="mx-auto max-w-xs w-full"
                />
            </div>
            
            <div className="text-sm text-gray-600 mb-4">
                <p className="font-medium">Code: {qrData.qrCode}</p>
                <p>Show this QR code to your collector</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 text-left">
                <h4 className="font-semibold mb-2">Pickup Details:</h4>
                <div className="text-sm space-y-1">
                    <p><span className="font-medium">Citizen:</span> {qrData.pickup.citizen}</p>
                    <p><span className="font-medium">Waste Type:</span> {qrData.pickup.wasteType}</p>
                    <p><span className="font-medium">Weight:</span> {qrData.pickup.weight}kg</p>
                    <p><span className="font-medium">Address:</span> {qrData.pickup.address}</p>
                    <p><span className="font-medium">Date:</span> {qrData.pickup.scheduledDate}</p>
                    <p><span className="font-medium">Time:</span> {qrData.pickup.timeSlot}</p>
                </div>
            </div>
        </div>
    );
};

export default QRScanner;