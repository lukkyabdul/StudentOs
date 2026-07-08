const CACHE_NAME = 'student-os-cache-v1';
const ASSETS_TO_CACHE = [
  '/login.html',
  '/forgot-password.html',
  '/index.html',
  '/css/style.css',
  '/js/lang.js',
  '/js/views.js',
  '/js/app.js',
  'https://cdn-icons-png.flaticon.com/512/2997/2997608.png',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW Caching Shell Assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW Removing Old Cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network First with Cache Fallback
self.addEventListener('fetch', (e) => {
  // Do not intercept API requests
  if (e.request.url.includes('/api/')) {
    return;
  }
  
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache successful requests dynamically
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => caches.match(e.request).then((cachedRes) => {
        if (cachedRes) return cachedRes;
        
        // If file is not cached and offline, serve dashboard shell index.html as fallback
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      }))
  );
});
