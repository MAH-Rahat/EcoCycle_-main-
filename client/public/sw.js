/**
 * Service Worker for EcoCycle Collector Mobile Interface
 * Provides offline data caching and background sync capabilities
 */

const CACHE_NAME = 'ecocycle-collector-v1';
const OFFLINE_CACHE_NAME = 'ecocycle-offline-v1';

// Essential files to cache for offline functionality
const ESSENTIAL_FILES = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// API endpoints to cache for offline access
const API_CACHE_PATTERNS = [
  '/api/pickups',
  '/api/waste',
  '/api/auth/me'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching essential files');
        return cache.addAll(ESSENTIAL_FILES);
      })
      .then(() => {
        console.log('[SW] Service worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== OFFLINE_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image') {
    event.respondWith(handleStaticAssets(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Default: network first, then cache
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// Handle API requests with cache-first strategy for offline support
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const isPickupRequest = API_CACHE_PATTERNS.some(pattern => 
    url.pathname.startsWith(pattern)
  );

  if (!isPickupRequest) {
    // For non-cacheable API requests, try network only
    return fetch(request);
  }

  try {
    // Try network first for fresh data
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add offline indicator header
      const response = cachedResponse.clone();
      response.headers.set('X-Served-By', 'service-worker-cache');
      return response;
    }
    
    // Return offline fallback for pickup requests
    if (url.pathname.startsWith('/api/pickups')) {
      return new Response(JSON.stringify({
        pickups: [],
        offline: true,
        message: 'No cached data available'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAssets(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Only cache http/https requests (skip chrome-extension, etc.)
      const url = new URL(request.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch static asset:', request.url);
    throw error;
  }
}

// Handle navigation requests
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation offline, serving cached index.html');
    
    const cachedResponse = await caches.match('/index.html');
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback offline page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>EcoCycle - Offline</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f5f5f5; 
            }
            .offline-message {
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 400px;
              margin: 0 auto;
            }
            .icon { font-size: 48px; margin-bottom: 20px; }
            h1 { color: #333; margin-bottom: 10px; }
            p { color: #666; line-height: 1.5; }
            .retry-btn {
              background: #10B981;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              cursor: pointer;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="offline-message">
            <div class="icon">📱</div>
            <h1>You're Offline</h1>
            <p>EcoCycle is currently offline. Some features may be limited, but you can still access cached pickup data.</p>
            <button class="retry-btn" onclick="window.location.reload()">
              Try Again
            </button>
          </div>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'pickup-status-update') {
    event.waitUntil(syncPickupUpdates());
  }
  
  if (event.tag === 'offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

// Sync pickup status updates when back online
async function syncPickupUpdates() {
  try {
    console.log('[SW] Syncing pickup updates...');
    
    // Get pending updates from IndexedDB
    const pendingUpdates = await getPendingUpdates();
    
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
          await removePendingUpdate(update.id);
          console.log('[SW] Synced pickup update:', update.pickupId);
        }
      } catch (error) {
        console.error('[SW] Failed to sync pickup update:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Sync other offline actions
async function syncOfflineActions() {
  try {
    console.log('[SW] Syncing offline actions...');
    
    // Implementation for syncing other offline actions
    // This would include location updates, photo uploads, etc.
    
  } catch (error) {
    console.error('[SW] Offline actions sync failed:', error);
  }
}

// IndexedDB helpers for offline data management
async function getPendingUpdates() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EcoCycleOffline', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingUpdates'], 'readonly');
      const store = transaction.objectStore('pendingUpdates');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingUpdates')) {
        const store = db.createObjectStore('pendingUpdates', { keyPath: 'id', autoIncrement: true });
        store.createIndex('pickupId', 'pickupId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

async function removePendingUpdate(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EcoCycleOffline', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingUpdates'], 'readwrite');
      const store = transaction.objectStore('pendingUpdates');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'CACHE_PICKUP_DATA':
      cachePickupData(data);
      break;
      
    case 'STORE_OFFLINE_UPDATE':
      storeOfflineUpdate(data);
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage({ type: 'CACHE_STATUS', data: status });
      });
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Cache pickup data for offline access
async function cachePickupData(pickupData) {
  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const response = new Response(JSON.stringify(pickupData), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    await cache.put('/api/pickups/cached', response);
    console.log('[SW] Cached pickup data for offline access');
  } catch (error) {
    console.error('[SW] Failed to cache pickup data:', error);
  }
}

// Store offline update in IndexedDB
async function storeOfflineUpdate(updateData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EcoCycleOffline', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingUpdates'], 'readwrite');
      const store = transaction.objectStore('pendingUpdates');
      const addRequest = store.add({
        ...updateData,
        timestamp: new Date(),
        synced: false
      });
      
      addRequest.onsuccess = () => {
        console.log('[SW] Stored offline update');
        resolve();
      };
      addRequest.onerror = () => reject(addRequest.error);
    };
  });
}

// Get cache status information
async function getCacheStatus() {
  try {
    const cacheNames = await caches.keys();
    const status = {
      caches: cacheNames.length,
      essential: await caches.has(CACHE_NAME),
      offline: await caches.has(OFFLINE_CACHE_NAME),
      lastUpdated: new Date().toISOString()
    };
    
    return status;
  } catch (error) {
    console.error('[SW] Failed to get cache status:', error);
    return { error: error.message };
  }
}

console.log('[SW] Service worker script loaded');