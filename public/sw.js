const CACHE_NAME_STATIC = "imchat-static-v3";
const CACHE_NAME_MEDIA = "imchat-media-v3";

const ASSETS_TO_PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json"
];

// Install Event
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME_STATIC).then((cache) => {
      console.log("[Service Worker] Pre-caching Core Offline Shell...");
      return cache.addAll(ASSETS_TO_PRECACHE).catch((err) => {
        console.warn("[Service Worker] Pre-cache warning: some files skipped", err);
      });
    })
  );
});

// Activate Event - Clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME_STATIC && key !== CACHE_NAME_MEDIA) {
            console.log("[Service Worker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper for checking if a request is genuinely an image or media thumbnail
function isMediaRequest(request) {
  // CRITICAL: Never treat navigation, document, or script requests as media
  if (request.mode === "navigate" || request.destination === "document" || request.destination === "script" || request.destination === "style") {
    return false;
  }

  const url = request.url;

  // Check destination first (most reliable)
  if (request.destination === "image" || request.destination === "video") return true;

  // Check URL signatures (Firebase Storage, Cloudinary, local uploads, image extensions)
  if (
    url.includes("/uploads/") ||
    url.includes("firebasestorage.googleapis.com") ||
    url.includes("cloudinary.com") ||
    url.includes("placehold.co") ||
    url.includes("via.placeholder.com") ||
    url.includes("blogger.googleusercontent.com") ||
    url.match(/\.(png|jpe?g|gif|svg|webp|ico|mp4|webm|mov)($|\?)/i)
  ) {
    return true;
  }

  return false;
}

// Fetch event intercepts
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // We only intercept GET requests
  if (request.method !== "GET") return;

  // Ignore WebSockets, chrome extensions, hot reloads, firestore database calls directly or internal firebase-auth
  if (
    url.protocol.startsWith("chrome-extension") ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("identitytoolkit.googleapis.com") ||
    url.port === "24678" // Vite HMR WS port
  ) {
    return;
  }

  // 1. Navigation requests ALWAYS handled first with Network-First falling back to cached index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // If valid response, cache index.html for offline use
          if (networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME_STATIC).then((cache) => cache.put("/index.html", clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log("[Service Worker] Application navigation offline, serving cached index.html");
          const cached = await caches.match("/index.html") || await caches.match("/");
          if (cached) return cached;

          // Minimal fallback if cache wasn't populated yet
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IMChat</title><style>body{font-family:sans-serif;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#fff;text-align:center;padding:20px;}</style></head><body><div><h2>IMChat Offline Mode</h2><p>Please check your connection and tap reload.</p><button onclick="window.location.reload()" style="background:#3b82f6;color:white;border:none;padding:12px 24px;border-radius:12px;font-weight:bold;cursor:pointer;margin-top:16px;">Reload Application</button></div></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // 2. Media assets (Images, Avatars, Reels thumbnails) - Cache First with Network Fallback
  if (isMediaRequest(request)) {
    event.respondWith(
      caches.open(CACHE_NAME_MEDIA).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            // Background Revalidation
            fetch(request).then((networkResponse) => {
              if (networkResponse.status === 200 || networkResponse.status === 0) {
                cache.put(request, networkResponse);
              }
            }).catch(() => {/* Ignore background errors */});
            return cachedResponse;
          }

          // Fetch from network, dynamic cache and return
          return fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200 || networkResponse.status === 0) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Safe inline fallback transparent pixel - never screen hijack
            return new Response(
              `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#e2e8f0"/></svg>`,
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          });
        });
      })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, fonts) - Stale-While-Revalidate
  const isStaticAsset = 
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|json|ico)($|\?)/i) || 
    (url.origin === self.location.origin && url.pathname !== "/" && !url.pathname.endsWith("/index.html"));

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME_STATIC).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });

          if (cachedResponse) {
            fetchPromise.catch(() => {});
            return cachedResponse;
          }

          return fetchPromise;
        });
      })
    );
    return;
  }
});
