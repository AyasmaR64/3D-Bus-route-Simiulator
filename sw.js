const CACHE_NAME = "3Dbus-sim-v2.6";
const ASSETS = [
  "./",
  "./index.html",
  "./simulator_3d.css",
  "./simulator_3d.js",
  "./manifest.json",
  "./busStops.json",
  "./routes/BL-01-balangoda-town.geojson",
  "./routes/BL-02-balangoda-ratnapura.geojson",
  "./routes/BL-03-balangoda-welioya-hambegamuwa.geojson",
  "./routes/BL-04-balangoda-welipatayaya-kaltota.geojson",
  "./routes/BL-05-balangoda-depalamulla-mulgama.geojson",
  "./routes/BL-06-balangoda-rajavaka-mulgama.geojson",
  "./routes/BL-07-balangoda-samanalawatta.geojson",
  "./routes/RT-01-ratnapuraTown.geojson",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./style.json",
  "./balangoda.pmtiles",
  "./lib/maplibre-gl.css",
  "./lib/maplibre-gl.js",
  "./lib/pmtiles.js",
  "./lib/turf.min.js",
  "./lib/three.min.js",
  "./assets/font/noto_sans_bold/0-255.pbf",
  "./assets/font/noto_sans_regular/0-255.pbf",
  "./assets/font/noto_sans_regular/256-511.pbf",
  "./assets/font/noto_sans_regular/512-767.pbf",
  "./assets/font/noto_sans_regular/768-1023.pbf",
  "./assets/font/noto_sans_regular/1024-1279.pbf",
  "./assets/font/noto_sans_regular/1280-1535.pbf",
  "./assets/font/noto_sans_regular/1536-1791.pbf",
  "./assets/font/noto_sans_regular/1792-2047.pbf",
  "./assets/font/noto_sans_regular/2048-2303.pbf",
  "./assets/font/noto_sans_regular/2304-2559.pbf",
  "./assets/font/noto_sans_regular/2560-2815.pbf",
  "./assets/font/noto_sans_regular/2816-3071.pbf",
  "./assets/font/noto_sans_regular/3072-3327.pbf",
  "./assets/font/noto_sans_regular/3328-3583.pbf",
  "./assets/font/noto_sans_regular/3584-3839.pbf",
  "./assets/font/noto_sans_regular/3840-4095.pbf",
  "./assets/font/noto_sans_regular/7680-7935.pbf",
  "./assets/font/noto_sans_regular/8192-8447.pbf",
  "./assets/font/Open Sans Regular,Arial Unicode MS Regular/0-255.pbf",
  "./assets/font/Open Sans Regular,Arial Unicode MS Regular/8192-8447.pbf",
  "./assets/sprites/basics/sprites.json",
  "./assets/sprites/basics/sprites.png",
  "./assets/sprites/basics/sprites@2x.json",
  "./assets/sprites/basics/sprites@2x.png",
];

// Install: Cache assets individually so a single missing/large file does not block SW install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS) {
        try {
          const response = await fetch(asset, { cache: "no-cache" });
          if (response.ok) {
            await cache.put(asset, response);
          } else {
            console.warn(
              "Skipped non-OK asset during install:",
              asset,
              response.status,
            );
          }
        } catch (err) {
          console.warn("Failed to cache asset during install:", asset, err);
        }
      }
    }),
  );
  self.skipWaiting();
});

// Activate: Clean up old cache versions and take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      ),
    ),
  );
  self.clients.claim();
});

// Fetch: Serve HTTP 206 byte-range chunks for PMTiles and Cache-First for everything else
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.headers.has("range") || url.pathname.endsWith(".pmtiles")) {
    event.respondWith(handleRangeRequest(event.request));
    return;
  }

  event.respondWith(
    caches
      .match(event.request, {
        ignoreSearch: true,
      })
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type !== "basic"
            ) {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => {
            if (event.request.mode === "navigate") {
              return caches.match("./index.html");
            }
          });
      }),
  );
});

// Serve partial content (206) from cached ArrayBuffer so PMTiles works 100% offline
async function handleRangeRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request, {
    ignoreSearch: true,
  });

  if (!cachedResponse) {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (err) {
      return new Response("Offline and PMTiles not cached", {
        status: 404,
      });
    }
  }

  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    return cachedResponse;
  }

  const arrayBuffer = await cachedResponse.arrayBuffer();
  const bytesRange = rangeHeader.replace(/bytes=/, "").split("-");
  const start = parseInt(bytesRange[0], 10);
  const end = bytesRange[1]
    ? parseInt(bytesRange[1], 10)
    : arrayBuffer.byteLength - 1;
  const chunk = arrayBuffer.slice(start, end + 1);

  const headers = new Headers(cachedResponse.headers);
  headers.set(
    "Content-Range",
    `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
  );
  headers.set("Content-Length", chunk.byteLength);

  return new Response(chunk, {
    status: 206,
    statusText: "Partial Content",
    headers,
  });
}
