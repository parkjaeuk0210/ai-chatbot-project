// Service Worker for FERA AI PWA - Enhanced Version
const CACHE_VERSION = 'v2';
const CACHE_NAME = `fera-ai-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Core assets to cache immediately
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/main.css',
  '/js/app.js',
  '/js/app.ts',
  '/js/chat.js',
  '/js/chat.ts',
  '/js/utils.js',
  '/js/utils.ts',
  '/js/security.js',
  '/js/security.ts',
  '/js/performance.js',
  '/js/i18n/i18n.js',
  '/js/i18n/ko.js',
  '/js/i18n/en.js',
  '/js/i18n/ja.js',
  '/js/i18n/zh.js',
  '/js/i18n/id.js',
  '/manifest.json',
  '/sw.js'
];

// External resources
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap'
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  CACHE_ONLY: 'cache-only',
  NETWORK_ONLY: 'network-only',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    Promise.all([
      // Cache core assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS);
      }),
      // Cache external assets with error handling
      caches.open(STATIC_CACHE).then(cache => {
        return Promise.all(
          EXTERNAL_ASSETS.map(url => {
            return cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache external asset: ${url}`, err);
            });
          })
        );
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheName.includes(CACHE_VERSION)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Helper function to determine cache strategy
function getCacheStrategy(request) {
  const url = new URL(request.url);
  
  // API calls - network only
  if (url.pathname.includes('/api/')) {
    return CACHE_STRATEGIES.NETWORK_ONLY;
  }
  
  // Static assets - cache first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?)$/)) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  
  // HTML pages - network first with cache fallback
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  // External resources - stale while revalidate
  if (!url.origin.includes(self.location.origin)) {
    return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
  }
  
  // Default - network first
  return CACHE_STRATEGIES.NETWORK_FIRST;
}

// Fetch event - smart caching strategies
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const strategy = getCacheStrategy(event.request);
  
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      event.respondWith(cacheFirst(event.request));
      break;
    case CACHE_STRATEGIES.NETWORK_FIRST:
      event.respondWith(networkFirst(event.request));
      break;
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      event.respondWith(staleWhileRevalidate(event.request));
      break;
    case CACHE_STRATEGIES.NETWORK_ONLY:
      event.respondWith(fetch(event.request));
      break;
    default:
      event.respondWith(networkFirst(event.request));
  }
});

// Cache strategies implementation
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache first fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  
  return cached || fetchPromise;
}

// Background sync for offline messages
self.addEventListener('sync', event => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'send-message') {
    event.waitUntil(sendPendingMessages());
  } else if (event.tag === 'sync-chat-history') {
    event.waitUntil(syncChatHistory());
  }
});

// Send pending messages when back online
async function sendPendingMessages() {
  try {
    // Open IndexedDB to get pending messages
    const db = await openDB();
    const tx = db.transaction('pending-messages', 'readwrite');
    const store = tx.objectStore('pending-messages');
    const messages = await store.getAll();
    
    console.log(`[SW] Found ${messages.length} pending messages`);
    
    // Send each message
    for (const message of messages) {
      try {
        const response = await fetch('/api/chat-simple', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.data)
        });
        
        if (response.ok) {
          // Remove from pending if successful
          await store.delete(message.id);
          console.log(`[SW] Successfully sent message ${message.id}`);
        }
      } catch (error) {
        console.error(`[SW] Failed to send message ${message.id}:`, error);
      }
    }
    
    await tx.complete;
  } catch (error) {
    console.error('[SW] Error sending pending messages:', error);
  }
}

// Sync chat history when back online
async function syncChatHistory() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const response = await fetch('/api/chat/history');
    
    if (response.ok) {
      await cache.put('/api/chat/history', response.clone());
      console.log('[SW] Chat history synced');
    }
  } catch (error) {
    console.error('[SW] Error syncing chat history:', error);
  }
}

// Helper function to open IndexedDB
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fera-ai-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('pending-messages')) {
        db.createObjectStore('pending-messages', { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains('chat-history')) {
        db.createObjectStore('chat-history', { keyPath: 'sessionId' });
      }
    };
  });
}

// Push notifications
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'FERA AI',
    body: '새로운 알림이 있습니다',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png'
  };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'open', title: '열기' },
      { action: 'close', title: '닫기' }
    ],
    requireInteraction: false,
    timestamp: Date.now()
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    // Open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Clean up old caches periodically
self.addEventListener('message', event => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});