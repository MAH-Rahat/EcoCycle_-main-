/**
 * Offline Service for EcoCycle Collector Mobile Interface
 * Manages offline data caching, sync, and service worker communication
 */

class OfflineService {
    constructor() {
        this.isOnline = navigator.onLine;
        this.serviceWorker = null;
        this.db = null;
        this.syncQueue = [];
        this.listeners = new Set();
        
        this.init();
    }

    async init() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                this.serviceWorker = registration;
                console.log('Service Worker registered successfully');
                
                // Listen for service worker updates
                registration.addEventListener('updatefound', () => {
                    console.log('Service Worker update found');
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }

        // Initialize IndexedDB
        await this.initDB();

        // Set up online/offline listeners
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners('online');
            this.syncPendingUpdates();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners('offline');
        });

        // Register background sync if supported
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.ready.then(registration => {
                // Background sync will be triggered when online
            });
        }
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EcoCycleOffline', 1);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store for pending pickup updates
                if (!db.objectStoreNames.contains('pendingUpdates')) {
                    const store = db.createObjectStore('pendingUpdates', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    store.createIndex('pickupId', 'pickupId', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Store for cached pickup data
                if (!db.objectStoreNames.contains('cachedPickups')) {
                    const store = db.createObjectStore('cachedPickups', { 
                        keyPath: 'id' 
                    });
                    store.createIndex('collectorId', 'collectorId', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                }
                
                // Store for offline actions
                if (!db.objectStoreNames.contains('offlineActions')) {
                    const store = db.createObjectStore('offlineActions', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // Cache pickup data for offline access
    async cachePickupData(collectorId, pickups) {
        try {
            if (!this.db) await this.initDB();
            
            const transaction = this.db.transaction(['cachedPickups'], 'readwrite');
            const store = transaction.objectStore('cachedPickups');
            
            // Clear existing cached data for this collector
            const index = store.index('collectorId');
            const range = IDBKeyRange.only(collectorId);
            const deleteRequest = index.openCursor(range);
            
            deleteRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
            
            // Cache new pickup data
            for (const pickup of pickups) {
                await this.addToStore(store, {
                    id: pickup._id,
                    collectorId: collectorId,
                    data: pickup,
                    cachedAt: new Date(),
                    status: pickup.status
                });
            }
            
            console.log(`Cached ${pickups.length} pickups for offline access`);
            return { success: true, count: pickups.length };
        } catch (error) {
            console.error('Failed to cache pickup data:', error);
            return { success: false, error: error.message };
        }
    }

    // Get cached pickup data
    async getCachedPickupData(collectorId, filters = {}) {
        try {
            if (!this.db) await this.initDB();
            
            const transaction = this.db.transaction(['cachedPickups'], 'readonly');
            const store = transaction.objectStore('cachedPickups');
            const index = store.index('collectorId');
            
            const pickups = await this.getAllFromIndex(index, collectorId);
            
            let filteredPickups = pickups.map(item => item.data);
            
            // Apply filters
            if (filters.status) {
                filteredPickups = filteredPickups.filter(p => p.status === filters.status);
            }
            
            if (filters.limit) {
                filteredPickups = filteredPickups.slice(0, filters.limit);
            }
            
            return {
                success: true,
                pickups: filteredPickups,
                cached: true,
                count: filteredPickups.length
            };
        } catch (error) {
            console.error('Failed to get cached pickup data:', error);
            return { success: false, error: error.message, pickups: [] };
        }
    }

    // Store offline pickup update
    async storeOfflineUpdate(pickupId, updateData, token) {
        try {
            if (!this.db) await this.initDB();
            
            const transaction = this.db.transaction(['pendingUpdates'], 'readwrite');
            const store = transaction.objectStore('pendingUpdates');
            
            const update = {
                pickupId: pickupId,
                status: updateData.status,
                notes: updateData.notes,
                timestamp: new Date(),
                token: token,
                synced: false
            };
            
            await this.addToStore(store, update);
            
            // Trigger background sync if supported
            if (this.serviceWorker && 'sync' in window.ServiceWorkerRegistration.prototype) {
                try {
                    await this.serviceWorker.sync.register('pickup-status-update');
                } catch (error) {
                    console.warn('Background sync registration failed:', error);
                }
            }
            
            console.log('Stored offline pickup update:', pickupId);
            return { success: true };
        } catch (error) {
            console.error('Failed to store offline update:', error);
            return { success: false, error: error.message };
        }
    }

    // Get pending updates
    async getPendingUpdates() {
        try {
            if (!this.db) await this.initDB();
            
            const transaction = this.db.transaction(['pendingUpdates'], 'readonly');
            const store = transaction.objectStore('pendingUpdates');
            
            const updates = await this.getAllFromStore(store);
            return updates.filter(update => !update.synced);
        } catch (error) {
            console.error('Failed to get pending updates:', error);
            return [];
        }
    }

    // Sync pending updates when online
    async syncPendingUpdates() {
        if (!this.isOnline) return;
        
        try {
            const pendingUpdates = await this.getPendingUpdates();
            
            for (const update of pendingUpdates) {
                try {
                    const response = await fetch(`/api/pickups/${update.pickupId}/status`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${update.token}`
                        },
                        body: JSON.stringify({
                            status: update.status,
                            notes: update.notes,
                            timestamp: update.timestamp
                        })
                    });
                    
                    if (response.ok) {
                        await this.markUpdateSynced(update.id);
                        console.log('Synced offline update:', update.pickupId);
                    }
                } catch (error) {
                    console.error('Failed to sync update:', error);
                }
            }
        } catch (error) {
            console.error('Sync process failed:', error);
        }
    }

    // Mark update as synced
    async markUpdateSynced(updateId) {
        try {
            if (!this.db) await this.initDB();
            
            const transaction = this.db.transaction(['pendingUpdates'], 'readwrite');
            const store = transaction.objectStore('pendingUpdates');
            
            const getRequest = store.get(updateId);
            getRequest.onsuccess = () => {
                const update = getRequest.result;
                if (update) {
                    update.synced = true;
                    store.put(update);
                }
            };
        } catch (error) {
            console.error('Failed to mark update as synced:', error);
        }
    }

    // Store offline action
    async storeOfflineAction(type, data) {
        try {
            if (!this.db) await this.initDB();
            
            const transaction = this.db.transaction(['offlineActions'], 'readwrite');
            const store = transaction.objectStore('offlineActions');
            
            const action = {
                type: type,
                data: data,
                timestamp: new Date(),
                synced: false
            };
            
            await this.addToStore(store, action);
            console.log('Stored offline action:', type);
            return { success: true };
        } catch (error) {
            console.error('Failed to store offline action:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if data is stale
    isDataStale(cachedData, maxAgeMs = 300000) { // 5 minutes default
        if (!cachedData || !cachedData.cachedAt) return true;
        return (new Date() - new Date(cachedData.cachedAt)) > maxAgeMs;
    }

    // Get cache status
    async getCacheStatus() {
        try {
            if (!this.db) await this.initDB();
            
            const pickupsTransaction = this.db.transaction(['cachedPickups'], 'readonly');
            const pickupsStore = pickupsTransaction.objectStore('cachedPickups');
            const pickupsCount = await this.getCountFromStore(pickupsStore);
            
            const updatesTransaction = this.db.transaction(['pendingUpdates'], 'readonly');
            const updatesStore = updatesTransaction.objectStore('pendingUpdates');
            const pendingUpdates = await this.getAllFromStore(updatesStore);
            const pendingCount = pendingUpdates.filter(u => !u.synced).length;
            
            return {
                isOnline: this.isOnline,
                cachedPickups: pickupsCount,
                pendingUpdates: pendingCount,
                serviceWorkerActive: !!this.serviceWorker,
                lastSync: new Date().toISOString()
            };
        } catch (error) {
            console.error('Failed to get cache status:', error);
            return {
                isOnline: this.isOnline,
                error: error.message
            };
        }
    }

    // Clear cache
    async clearCache() {
        try {
            if (!this.db) await this.initDB();
            
            const transaction = this.db.transaction(['cachedPickups', 'pendingUpdates', 'offlineActions'], 'readwrite');
            
            await Promise.all([
                this.clearStore(transaction.objectStore('cachedPickups')),
                this.clearStore(transaction.objectStore('pendingUpdates')),
                this.clearStore(transaction.objectStore('offlineActions'))
            ]);
            
            console.log('Cache cleared successfully');
            return { success: true };
        } catch (error) {
            console.error('Failed to clear cache:', error);
            return { success: false, error: error.message };
        }
    }

    // Add listener for online/offline events
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // Notify listeners of status changes
    notifyListeners(event) {
        this.listeners.forEach(callback => {
            try {
                callback(event, this.isOnline);
            } catch (error) {
                console.error('Listener callback error:', error);
            }
        });
    }

    // Helper methods for IndexedDB operations
    addToStore(store, data) {
        return new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    getAllFromStore(store) {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    getAllFromIndex(index, key) {
        return new Promise((resolve, reject) => {
            const request = index.getAll(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    getCountFromStore(store) {
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    clearStore(store) {
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Public getters
    get online() {
        return this.isOnline;
    }

    get offline() {
        return !this.isOnline;
    }
}

// Create singleton instance
const offlineService = new OfflineService();

export default offlineService;