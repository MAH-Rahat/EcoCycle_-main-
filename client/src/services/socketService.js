import { io } from 'socket.io-client';

class SocketService {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.listeners = new Map();
    }

    connect(token) {
        if (this.socket) {
            this.disconnect();
        }

        const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        this.socket = io(serverUrl, {
            auth: {
                token: token
            },
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
            this.isConnected = true;
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            this.isConnected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.isConnected = false;
        });

        // Set up event listeners
        this.setupEventListeners();
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.listeners.clear();
        }
    }

    setupEventListeners() {
        // Wallet updates
        this.socket.on('wallet_updated', (data) => {
            this.emit('walletUpdated', data);
        });

        this.socket.on('new_transaction', (transaction) => {
            this.emit('newTransaction', transaction);
        });

        // Pickup updates
        this.socket.on('pickup_status_updated', (data) => {
            this.emit('pickupStatusUpdated', data);
        });

        this.socket.on('collector_location_updated', (data) => {
            this.emit('collectorLocationUpdated', data);
        });

        // Notifications
        this.socket.on('notification', (notification) => {
            this.emit('notification', notification);
        });

        this.socket.on('system_notification', (notification) => {
            this.emit('systemNotification', notification);
        });
    }

    // Subscribe to wallet updates
    subscribeToWallet() {
        if (this.socket) {
            this.socket.emit('subscribe_wallet');
        }
    }

    // Unsubscribe from wallet updates
    unsubscribeFromWallet() {
        if (this.socket) {
            this.socket.emit('unsubscribe_wallet');
        }
    }

    // Subscribe to pickup updates
    subscribeToPickup(pickupId) {
        if (this.socket) {
            this.socket.emit('subscribe_pickup', pickupId);
        }
    }

    // Unsubscribe from pickup updates
    unsubscribeFromPickup(pickupId) {
        if (this.socket) {
            this.socket.emit('unsubscribe_pickup', pickupId);
        }
    }

    // Update collector location (for collectors)
    updateLocation(pickupId, lat, lng) {
        if (this.socket) {
            this.socket.emit('update_location', { pickupId, lat, lng });
        }
    }

    // Event listener management
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in socket event listener for ${event}:`, error);
                }
            });
        }
    }

    // Check connection status
    isSocketConnected() {
        return this.isConnected && this.socket?.connected;
    }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService;