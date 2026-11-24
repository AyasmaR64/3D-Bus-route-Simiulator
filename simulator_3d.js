// Register Service Worker safely
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      console.log("Service Worker registered successfully.");
    } catch (err) {
      console.error("Service Worker registration failed:", err);
    }
  });
}

(function () {
  const splash = document.getElementById("pwa-splash");
  const statusText = document.getElementById("splash-status-text");
  const MIN_DISPLAY_MS = 4000;
  const startTime = Date.now();

  window.hidePwaSplash = function () {
    if (!splash) return;

    const elapsed = Date.now() - startTime;
    const remainingDelay = Math.max(0, MIN_DISPLAY_MS - elapsed);

    setTimeout(() => {
      splash.classList.add("splash-hidden");
      setTimeout(() => {
        if (splash.parentNode) {
          splash.parentNode.removeChild(splash);
        }
      }, 450);
    }, remainingDelay);
  };

  window.updateSplashStatus = function (message) {
    if (statusText) statusText.textContent = message;
  };

  window.addEventListener("load", () => {
    window.hidePwaSplash();
  });
})();

let deferredPrompt = null;

function isAppInstalled() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function isIOSSafari() {
  const ua = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);

  return isIOS && isSafari;
}

window.addEventListener("DOMContentLoaded", () => {
  const banner = document.getElementById("pwa-install-banner");
  const bannerText = document.getElementById("pwa-banner-text");
  const installBtn = document.getElementById("pwa-install-btn");
  const closeBtn = document.getElementById("pwa-close-btn");

  if (
    isAppInstalled() ||
    localStorage.getItem("pwaBannerDismissed") === "true"
  ) {
    return;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    bannerText.innerHTML =
      "<strong>Install App:</strong> Add to your device for offline access and persistent storage.";
    installBtn.style.display = "inline-block";
    banner.style.display = "flex";
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User install choice: ${outcome}`);

    deferredPrompt = null;
    banner.style.display = "none";
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    banner.style.display = "none";
    console.log("PWA successfully installed.");
  });

  if (isIOSSafari()) {
    bannerText.innerHTML = `
      <strong>Install App:</strong> Tap the 
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
        <polyline points="16 6 12 2 8 6"></polyline>
        <line x1="12" y1="2" x2="12" y2="15"></line>
      </svg> 
      Share button, then select <strong>"Add to Home Screen"</strong>.
    `;
    installBtn.style.display = "none";
    banner.style.display = "flex";
  }

  closeBtn.addEventListener("click", () => {
    banner.style.display = "none";
    localStorage.setItem("pwaBannerDismissed", "true");
  });
});

// ============================================================================
// 1. ROUTE NAMES, GLOBAL SIMULATION STATE & DATA CONTAINERS
// ============================================================================
const LANGUAGES = ["en", "si", "ta"];

const ROUTE_NAMES = {
  "BL-01": {
    si: "බලංගොඩ නගරය",
    en: "Balangoda Town",
    ta: "பலாங்கொடை நகரம்",
  },
  "BL-02": {
    si: "බලංගොඩ රත්නපුර",
    en: "Balangoda Ratnapura",
    ta: "பலாங்கொடை இரத்தினபுரி",
  },
  "BL-03": {
    si: "බලංගොඩ-වේලිඔය-හම්බෙගමුව",
    en: "Balangoda–Welioya–Hambegamuwa",
    ta: "பலாங்கொடை–வேலியோயா–ஹம்பேகமுவ",
  },
  "BL-04": {
    si: "බලංගොඩ-වැලිපතයාය-කල්තොට",
    en: "Balangoda–Welipatayaya–Kaltota",
    ta: "பலாங்கொடை–வெலிப்பொதயாய–கல்தோட்டை",
  },

  "BL-05": {
    si: "බලංගොඩ-වටවල-මුල්ගම",
    en: "Balangoda–Watawala–Mulgama",
    ta: "பலாங்கொடை–வட்டவல–முல்கம",
  },
  "BL-06": {
    si: "බලංගොඩ-රජවක-මුල්ගම",
    en: "Balangoda–Rajavaka–Mulgama",
    ta: "பலாங்கொடை–ரஜவக்க–முல்கம",
  },

  "BL-07": {
    si: "බලංගොඩ-සමනලවත්ත",
    en: "Balangoda–Samanalawatta",
    ta: "பலாங்கொடை–சமனலவத்தை",
  },
  "RT-01": {
    si: "රත්නපුර නගරය",
    en: "Ratnapura Town",
    ta: "இரத்தினபுரி நகரம்",
  },
};

function getLocalizedStopName(nameObj, lang = busState.language) {
  if (!nameObj) {
    if (lang === "si") return "බස් නැවතුම";
    if (lang === "ta") return "பஸ் நிலையம்";
    return "Bus Stop";
  }
  if (typeof nameObj === "string") {
    return nameObj;
  }
  return nameObj[lang] || nameObj.en || nameObj.si || nameObj.ta || "Bus Stop";
}

function getLocalizedRouteName(routeKey, lang = busState.language) {
  const entry = ROUTE_NAMES[routeKey];
  if (entry) return entry[lang] || entry.en || entry.si || entry.ta || routeKey;
  return routeKey;
}

let routeLine = null;
let totalRouteKm = 0;
let stopsAlongRoute = [];
let busStopsData = {};
let activeStopPopup = null;
let autoStopPopup = null;
let activeAutoStopKey = null;
let activeStoppedStopNameObj = null;

const DEFAULT_BUS_SPEED_KMH = 24;
const MIN_BUS_SPEED_KMH = 0;
const MAX_BUS_SPEED_KMH = 200;
const OVERSPEED_LIMIT_KMH = 90;
const STOP_WAIT_SECONDS = 3;
const STOP_POPUP_RADIUS_METERS = 100;

const BUS_ZOOM_SCALE_STOPS = [
  [11, 3.5],
  [13, 3.0],
  [15, 2.0],
  [16.2, 1.2],
  [18, 1],
];

const busState = {
  isPlaying: true,
  livery: "SLTB",
  cameraMode: "CHASE",
  language: "en",
  theme: "dark",
  distanceKm: 0,
  currentSpeedKmh: 0,
  cruiseSpeedKmh: DEFAULT_BUS_SPEED_KMH,
  targetSpeedKmh: DEFAULT_BUS_SPEED_KMH,
  wheelRotation: 0,
  suspensionTime: 0,
  stopTimer: 0,
  currentLngLat: [80.701785, 6.6503023],
  currentBearing: 115,
};

function interpolateZoom(zoom, stops) {
  if (zoom <= stops[0][0]) return stops[0][1];
  if (zoom >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];

  for (let i = 0; i < stops.length - 1; i++) {
    const [z0, v0] = stops[i];
    const [z1, v1] = stops[i + 1];
    if (zoom >= z0 && zoom <= z1) {
      const t = (zoom - z0) / (z1 - z0);
      return v0 + t * (v1 - v0);
    }
  }
  return 1;
}

function updateProximityStopPopup() {
  if (!stopsAlongRoute.length) return;

  const busPt = turf.point(busState.currentLngLat);
  const mainStop = stopsAlongRoute[0];
  const mainStopPt = turf.point(mainStop.coords);

  let nearestStop = null;
  let nearestDistanceMeters = Infinity;

  for (const stop of stopsAlongRoute) {
    const distMeters = turf.distance(busPt, turf.point(stop.coords), {
      units: "meters",
    });
    if (distMeters < nearestDistanceMeters) {
      nearestDistanceMeters = distMeters;
      nearestStop = stop;
    }
  }

  if (nearestStop && nearestDistanceMeters <= STOP_POPUP_RADIUS_METERS) {
    const distFromMainKm = turf.distance(
      mainStopPt,
      turf.point(nearestStop.coords),
      { units: "kilometers" },
    );
    const displayStopName = getLocalizedStopName(nearestStop.name);
    const stationLabel =
      busState.language === "si"
        ? "ප්‍රධාන නැවතුම"
        : busState.language === "ta"
          ? "பிரதான நிலையம்"
          : "Main station";
    const stopKey =
      typeof nearestStop.name === "object"
        ? `${nearestStop.name.en || ""}|${nearestStop.name.si || ""}|${nearestStop.name.ta || ""}`
        : String(nearestStop.name);

    const popupHtml = `
      <div><strong>${displayStopName}</strong></div>
      <div>${stationLabel}: ${distFromMainKm.toFixed(2)} km</div>
    `;

    if (!autoStopPopup || activeAutoStopKey !== stopKey) {
      if (autoStopPopup) {
        autoStopPopup.remove();
      }
      autoStopPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "bus-stop-popup",
      })
        .setLngLat(nearestStop.coords)
        .setHTML(popupHtml)
        .addTo(map);
      activeAutoStopKey = stopKey;
    } else {
      autoStopPopup.setLngLat(nearestStop.coords).setHTML(popupHtml);
    }
  } else if (autoStopPopup) {
    autoStopPopup.remove();
    autoStopPopup = null;
    activeAutoStopKey = null;
  }
}

// ============================================================================
// 2. THREE.JS CUSTOM LAYER FOR REALISTIC ANIMATED 3D BUS
// ============================================================================
class ThreeBusLayer {
  constructor() {
    this.id = "three-bus-layer";
    this.type = "custom";
    this.renderingMode = "3d";
  }

  onAdd(map, gl) {
    this.map = map;
    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.0);
    dirLight.position.set(40, -60, 120);
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.5);
    fillLight.position.set(-40, 60, 80);
    this.scene.add(fillLight);

    this.busRoot = new THREE.Group();
    this.scene.add(this.busRoot);

    this.chassisGroup = new THREE.Group();
    this.busRoot.add(this.chassisGroup);

    this.buildBusModel();

    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
      alpha: true,
    });
    this.renderer.autoClear = false;
    if (THREE.SRGBColorSpace && this.renderer.outputColorSpace !== undefined) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
  }

  buildBusModel() {
    while (this.chassisGroup.children.length > 0) {
      this.chassisGroup.remove(this.chassisGroup.children[0]);
    }
    this.wheels = [];

    const isSLTB = busState.livery === "SLTB";
    const primaryColor = isSLTB ? 0xdc2626 : 0x16a34a;
    const stripeColor = isSLTB ? 0xfacc15 : 0xf8fafc;
    const roofColor = isSLTB ? 0xdc2626 : 0x16a34a;

    const width = 5;
    const length = 20.4;
    const height = 5.7;

    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(width, length, height * 0.55),
      new THREE.MeshLambertMaterial({ color: primaryColor }),
    );
    lowerBody.position.set(0, 0, height * 0.275 + 0.45);
    this.chassisGroup.add(lowerBody);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.04, length + 0.04, 0.24),
      new THREE.MeshLambertMaterial({ color: stripeColor }),
    );
    stripe.position.set(0, 0, height * 0.52 + 0.45);
    this.chassisGroup.add(stripe);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.06, length - 0.12, height * 0.36),
      new THREE.MeshLambertMaterial({ color: 0x1e293b }),
    );
    cabin.position.set(0, 0, height * 0.75 + 0.45);
    this.chassisGroup.add(cabin);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.04, length - 0.08, 0.18),
      new THREE.MeshLambertMaterial({ color: roofColor }),
    );
    roof.position.set(0, 0, height + 0.45);
    this.chassisGroup.add(roof);

    const destBoard = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.65, 0.08, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    );
    destBoard.position.set(0, length / 2 + 0.01, height * 0.86 + 0.45);
    this.chassisGroup.add(destBoard);

    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1e1e });

    [-0.85, 0.85].forEach((xOffset) => {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.08, 0.2),
        headMat,
      );
      hl.position.set(xOffset, length / 2 + 0.02, 0.85);
      this.chassisGroup.add(hl);

      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.08, 0.24),
        tailMat,
      );
      tl.position.set(xOffset, -length / 2 - 0.02, 0.9);
      this.chassisGroup.add(tl);
    });

    const mirrorMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    [-1, 1].forEach((side) => {
      const mirror = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.16, 0.36),
        mirrorMat,
      );
      mirror.position.set(
        side * (width / 2 + 0.16),
        length / 2 - 0.35,
        height * 0.72 + 0.45,
      );
      this.chassisGroup.add(mirror);
    });

    const wheelRadius = 0.52;
    const wheelWidth = 0.32;
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
    const rimMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });

    const wheelPositions = [
      [-width / 2 + 0.05, length * 0.31, wheelRadius],
      [width / 2 - 0.05, length * 0.31, wheelRadius],
      [-width / 2 + 0.05, -length * 0.3, wheelRadius],
      [width / 2 - 0.05, -length * 0.3, wheelRadius],
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wx, wy, wz);

      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20),
        tireMat,
      );
      tire.rotation.z = Math.PI / 2;
      wheelGroup.add(tire);

      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(wheelWidth + 0.03, wheelRadius * 1.4, 0.12),
        rimMat,
      );
      wheelGroup.add(spoke);

      this.busRoot.add(wheelGroup);
      this.wheels.push(wheelGroup);
    });

    if (this.map) this.map.triggerRepaint();
  }

  render(gl, matrix) {
    const currentZoom = this.map ? this.map.getZoom() : 16.2;
    if (currentZoom < 11) return;

    const mercator = maplibregl.MercatorCoordinate.fromLngLat(
      busState.currentLngLat,
      0,
    );
    const meterScale = mercator.meterInMercatorCoordinateUnits();
    const zoomMultiplier = interpolateZoom(currentZoom, BUS_ZOOM_SCALE_STOPS);
    const effectiveScale = meterScale * zoomMultiplier;

    const m = new THREE.Matrix4().fromArray(matrix);
    const l = new THREE.Matrix4()
      .makeTranslation(mercator.x, mercator.y, mercator.z)
      .scale(
        new THREE.Vector3(effectiveScale, -effectiveScale, effectiveScale),
      );

    const headingRad = (-busState.currentBearing * Math.PI) / 180;
    this.busRoot.rotation.z = headingRad;

    const bounce =
      Math.sin(busState.suspensionTime * 14) *
      (busState.currentSpeedKmh > 2 ? 0.035 : 0.008);
    this.chassisGroup.position.z = bounce;

    if (this.wheels) {
      this.wheels.forEach((w) => {
        w.rotation.x = busState.wheelRotation;
      });
    }

    this.renderer.resetState();
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );

    this.camera.projectionMatrix = m.multiply(l);
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (this.map) this.map.triggerRepaint();
  }
}

const threeBusLayer = new ThreeBusLayer();

// ============================================================================
// 3. INITIALIZE MAPLIBRE GL JS & HIGH-ACCURACY GEOLOCATION
// ============================================================================
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  container: "map",
  style: "./style.json",
  center: [80.701785, 6.6503023],
  zoom: 16.2,
  maxPitch: 85,
  hash: true,
  pitch: 70,
  bearing: 115,
  antialias: true,
});

map.addControl(
  new maplibregl.NavigationControl({
    visualizePitch: true,
  }),
  "bottom-right",
);
map.addControl(new maplibregl.FullscreenControl(), "top-right");
map.addControl(
  new maplibregl.ScaleControl({
    maxWidth: 50,
    unit: "metric",
  }),
  "bottom-left",
);

let userLocationMarker = null;
let geoWatchId = null;
let isGeoTracking = false;

function createAccuracyCircleGeoJSON(lng, lat, accuracyMeters) {
  const radiusKm = Math.max(0.005, (accuracyMeters || 15) / 1000);
  return turf.circle([lng, lat], radiusKm, {
    steps: 64,
    units: "kilometers",
  });
}

function updateUserLocationOnMap(pos, shouldCenter = false) {
  const { longitude, latitude, accuracy } = pos.coords;
  const coords = [longitude, latitude];

  if (!userLocationMarker) {
    const el = document.createElement("div");
    el.className = "geo-marker-dot";
    userLocationMarker = new maplibregl.Marker({ element: el })
      .setLngLat(coords)
      .addTo(map);
  } else {
    userLocationMarker.setLngLat(coords);
  }

  const circleData = createAccuracyCircleGeoJSON(longitude, latitude, accuracy);
  if (map.getSource("user-accuracy-src")) {
    map.getSource("user-accuracy-src").setData(circleData);
  }

  if (shouldCenter) {
    busState.cameraMode = "FREE";
    updateHUD();
    map.flyTo({
      center: coords,
      zoom: Math.max(map.getZoom(), 16.5),
      essential: true,
    });
  }
}

function toggleHighAccuracyGeolocation() {
  const geoBtn = document.getElementById("geoLocationBtn");
  if (!navigator.geolocation) {
    alert(
      busState.language === "si"
        ? "මෙම උපාංගයේ GPS සහාය නොමැත."
        : busState.language === "ta"
          ? "இந்த சாதனத்தில் GPS வசதி இல்லை."
          : "Geolocation is not supported on this device.",
    );
    return;
  }

  if (isGeoTracking) {
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
    isGeoTracking = false;
    geoBtn.classList.remove("active", "locating");
    return;
  }

  isGeoTracking = true;
  geoBtn.classList.add("locating");

  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
  };

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      geoBtn.classList.remove("locating");
      geoBtn.classList.add("active");
      updateUserLocationOnMap(pos, true);
    },
    (err) => {
      console.warn("High-accuracy getCurrentPosition error:", err);
      geoBtn.classList.remove("locating");
    },
    geoOptions,
  );

  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      geoBtn.classList.remove("locating");
      geoBtn.classList.add("active");
      updateUserLocationOnMap(pos, false);
    },
    (err) => {
      console.warn("High-accuracy watchPosition error:", err);
    },
    geoOptions,
  );
}

// ============================================================================
// 4. ROUTE LOADING & SIMULATOR SETUP FUNCTION
// ============================================================================
function refreshRouteOptionLabels() {
  const routeSelect = document.getElementById("routeSubtitle");
  if (!routeSelect) return;

  Array.from(routeSelect.options).forEach((opt) => {
    const key = opt.value;
    const num = opt.getAttribute("data-num") || key;
    const localized = getLocalizedRouteName(key, busState.language);
    opt.textContent = `${num} — ${localized}`;
  });

  const selectedOpt = routeSelect.options[routeSelect.selectedIndex];
  if (selectedOpt) {
    const key = selectedOpt.value;
    const num = selectedOpt.getAttribute("data-num") || key;
    const localized = getLocalizedRouteName(key, busState.language);
    if (busState.language === "si") {
      document.getElementById("routeTitle").textContent =
        `${num} සජීවී බස් (${localized})`;
    } else if (busState.language === "ta") {
      document.getElementById("routeTitle").textContent =
        `${num} நேரலை 3D பஸ் (${localized})`;
    } else {
      document.getElementById("routeTitle").textContent = `${num} Live 3D Bus`;
    }
  }
}

async function loadSelectedRoute(routeKey, geojsonFile) {
  try {
    const [geoRes, stopsRes] = await Promise.all([
      fetch(geojsonFile),
      Object.keys(busStopsData).length === 0
        ? fetch("busStops.json")
        : Promise.resolve(null),
    ]);

    const geojson = await geoRes.json();
    if (stopsRes) {
      busStopsData = await stopsRes.json();
    }

    const routeFeature =
      geojson.type === "FeatureCollection" ? geojson.features[0] : geojson;
    routeLine = routeFeature;
    totalRouteKm = turf.length(routeLine, { units: "kilometers" });

    const dataKey = routeKey.startsWith("BL-08") ? "BL-08" : routeKey;
    const rawStops = busStopsData[dataKey] || [];
    stopsAlongRoute = rawStops.map((stop) => {
      const pt = turf.point(stop.coords);
      const snapped = turf.nearestPointOnLine(routeLine, pt, {
        units: "kilometers",
      });
      return {
        name: stop.name,
        coords: stop.coords,
        distKm: snapped.properties.location,
        visited: false,
      };
    });

    busState.distanceKm = 0;
    busState.currentSpeedKmh = 0;
    busState.stopTimer = 0;
    activeStoppedStopNameObj = null;
    if (stopsAlongRoute.length > 0) {
      busState.currentLngLat = stopsAlongRoute[0].coords;
    }

    if (autoStopPopup) {
      autoStopPopup.remove();
      autoStopPopup = null;
      activeAutoStopKey = null;
    }

    if (map.getSource("bus-route-src")) {
      map.getSource("bus-route-src").setData(geojson);
    }
    if (map.getSource("bus-stops-src")) {
      const stopsGeoJson = {
        type: "FeatureCollection",
        features: rawStops.map((s) => ({
          type: "Feature",
          properties: {
            nameSi: s.name && s.name.si ? s.name.si : "",
            nameEn: s.name && s.name.en ? s.name.en : "",
            nameTa: s.name && s.name.ta ? s.name.ta : "",
          },
          geometry: { type: "Point", coordinates: s.coords },
        })),
      };
      map.getSource("bus-stops-src").setData(stopsGeoJson);
    }

    if (stopsAlongRoute.length > 0) {
      map.jumpTo({
        center: stopsAlongRoute[0].coords,
        zoom: 16.2,
        bearing: -60,
      });
    }

    refreshRouteOptionLabels();
    updateHUD();
  } catch (err) {
    console.error("Failed to load route data:", err);
  }
}

// ============================================================================
// 5. MAP LOAD & EVENT LISTENERS
// ============================================================================
map.on("load", async () => {
  map.addSource("user-accuracy-src", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "user-accuracy-fill",
    type: "fill",
    source: "user-accuracy-src",
    paint: {
      "fill-color": "#3b82f6",
      "fill-opacity": 0.16,
    },
  });

  map.addLayer({
    id: "user-accuracy-outline",
    type: "line",
    source: "user-accuracy-src",
    paint: {
      "line-color": "#2563eb",
      "line-width": 2,
    },
  });

  map.addSource("bus-route-src", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "bus-route-casing",
    type: "line",
    source: "bus-route-src",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#1e293b00", "line-width": 10 },
  });

  map.addLayer({
    id: "bus-route-line",
    type: "line",
    source: "bus-route-src",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#00000000", "line-width": 5 },
  });

  map.addSource("bus-stops-src", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "bus-stops-circles",
    type: "circle",
    source: "bus-stops-src",
    paint: {
      "circle-radius": 6,
      "circle-color": "#ef4444",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  map.on("click", "bus-stops-circles", (e) => {
    const feature = e.features && e.features[0];
    if (!feature) return;

    const coords = feature.geometry.coordinates.slice();
    const props = feature.properties || {};
    const stopName = getLocalizedStopName({
      si: props.nameSi,
      en: props.nameEn,
      ta: props.nameTa,
    });

    if (activeStopPopup) {
      activeStopPopup.remove();
    }

    activeStopPopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      className: "bus-stop-popup",
    })
      .setLngLat(coords)
      .setText(stopName)
      .addTo(map);
  });

  map.on("mouseenter", "bus-stops-circles", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "bus-stops-circles", () => {
    map.getCanvas().style.cursor = "";
  });

  map.addLayer(threeBusLayer);

  const routeSelect = document.getElementById("routeSubtitle");
  const initialOption = routeSelect.options[routeSelect.selectedIndex];
  await loadSelectedRoute(
    initialOption.value,
    initialOption.getAttribute("data-file"),
  );

  routeSelect.addEventListener("change", async (e) => {
    const selectedOpt = e.target.options[e.target.selectedIndex];
    await loadSelectedRoute(
      selectedOpt.value,
      selectedOpt.getAttribute("data-file"),
    );
  });

  requestAnimationFrame(animateBus);
});

// ============================================================================
// 6. REALISTIC DRIVING PHYSICS & ANIMATION LOOP
// ============================================================================
let lastTimestamp = performance.now();

function animateBus(now) {
  const rawDt = Math.max(0, (now - lastTimestamp) / 1000);
  lastTimestamp = now;
  const dt = Math.min(rawDt, 1.0);

  if (busState.isPlaying && routeLine && totalRouteKm > 0) {
    busState.suspensionTime += dt;

    if (busState.stopTimer > 0) {
      busState.stopTimer = Math.max(0, busState.stopTimer - dt);
      busState.targetSpeedKmh = 0;
    } else {
      activeStoppedStopNameObj = null;
      busState.targetSpeedKmh = busState.cruiseSpeedKmh;
    }

    const accelRate =
      busState.targetSpeedKmh > busState.currentSpeedKmh ? 85 : 110;
    if (busState.currentSpeedKmh < busState.targetSpeedKmh) {
      busState.currentSpeedKmh = Math.min(
        busState.targetSpeedKmh,
        busState.currentSpeedKmh + accelRate * dt,
      );
    } else if (busState.currentSpeedKmh > busState.targetSpeedKmh) {
      busState.currentSpeedKmh = Math.max(
        busState.targetSpeedKmh,
        busState.currentSpeedKmh - accelRate * dt,
      );
    }

    const speedKmPerSec = busState.currentSpeedKmh / 3600;
    const simMultiplier = 1;
    busState.distanceKm += speedKmPerSec * dt * simMultiplier;

    const metersMoved = speedKmPerSec * 1000 * dt * simMultiplier;
    busState.wheelRotation += metersMoved / 0.52;

    if (busState.distanceKm >= totalRouteKm) {
      busState.distanceKm = 0;
      stopsAlongRoute.forEach((s) => (s.visited = false));
    }

    for (let i = 1; i < stopsAlongRoute.length; i++) {
      const stop = stopsAlongRoute[i];
      if (!stop.visited && Math.abs(busState.distanceKm - stop.distKm) < 0.02) {
        stop.visited = true;
        busState.stopTimer = STOP_WAIT_SECONDS;
        busState.currentSpeedKmh = 0;
        activeStoppedStopNameObj = stop.name;
        break;
      }
    }

    const currentPt = turf.along(routeLine, busState.distanceKm, {
      units: "kilometers",
    });
    const lookAheadKm = Math.min(totalRouteKm, busState.distanceKm + 0.025);
    const nextPt = turf.along(routeLine, lookAheadKm, { units: "kilometers" });

    busState.currentLngLat = currentPt.geometry.coordinates;

    if (lookAheadKm > busState.distanceKm) {
      const rawBearing = turf.bearing(currentPt, nextPt);
      let diff = ((rawBearing - busState.currentBearing + 540) % 360) - 180;
      busState.currentBearing += diff * Math.min(1, dt * 8);
    }

    updateProximityStopPopup();

    if (busState.cameraMode === "CHASE") {
      map.jumpTo({
        center: busState.currentLngLat,
        bearing: busState.currentBearing,
      });
    }

    updateHUD();
  }

  requestAnimationFrame(animateBus);
}

function updateHUD() {
  const lang = busState.language;
  const isSi = lang === "si";
  const isTa = lang === "ta";
  const roundedSpeed = Math.round(busState.currentSpeedKmh);
  const isOverspeed = roundedSpeed > OVERSPEED_LIMIT_KMH;

  document.getElementById("speedLabel").textContent = isSi
    ? "වේගය"
    : isTa
      ? "வேகம்"
      : "SPEED";
  document.getElementById("nextStopLabel").textContent = isSi
    ? "ඊළඟ නැවතුම"
    : isTa
      ? "அடுத்த நிறுத்தம்"
      : "NEXT STOP";
  document.getElementById("statusLabel").textContent = isSi
    ? "තත්ත්වය"
    : isTa
      ? "நிலை"
      : "STATUS";
  document.getElementById("targetSpeedLabel").textContent = isSi
    ? "ඉලක්ක වේගය"
    : isTa
      ? "இலக்கு வேகம்"
      : "Target Speed";

  const speedEl = document.getElementById("speedDisplay");
  speedEl.textContent = `${roundedSpeed} km/h`;
  speedEl.classList.toggle("overspeed", isOverspeed);

  if (speedSliderValue) {
    speedSliderValue.textContent = `${busState.cruiseSpeedKmh} km/h`;
  }

  const overspeedEl = document.getElementById("overspeedIndicator");
  if (overspeedEl) {
    overspeedEl.classList.toggle("active", isOverspeed);
  }

  const statusEl = document.getElementById("statusDisplay");
  if (busState.stopTimer > 0 && activeStoppedStopNameObj) {
    const localizedStop = getLocalizedStopName(activeStoppedStopNameObj);
    statusEl.textContent = isSi
      ? `${localizedStop} හිදී`
      : isTa
        ? `${localizedStop} இல்`
        : `At ${localizedStop}`;
    statusEl.className = "stat-val status-stopped";
  } else {
    statusEl.textContent = isSi ? "මාර්ගයේ" : isTa ? "பாதையில்" : "On Route";
    statusEl.className = "stat-val status-moving";
  }

  document.getElementById("progressText").textContent =
    `${busState.distanceKm.toFixed(2)} / ${totalRouteKm.toFixed(2)} km`;

  const pct =
    totalRouteKm > 0
      ? Math.min(100, Math.round((busState.distanceKm / totalRouteKm) * 100))
      : 0;
  document.getElementById("progressPct").textContent = `${pct}%`;
  document.getElementById("progressFill").style.width = `${pct}%`;

  const upcoming = stopsAlongRoute.find(
    (s) => s.distKm > busState.distanceKm + 0.02,
  );
  document.getElementById("nextStopDisplay").textContent = upcoming
    ? getLocalizedStopName(upcoming.name)
    : isSi
      ? "අවසන් නැවතුම"
      : isTa
        ? "இறுதி நிறுத்தம்"
        : "Last stop (End)";

  const playPauseBtn = document.getElementById("playPauseBtn");
  if (playPauseBtn) {
    playPauseBtn.textContent = busState.isPlaying
      ? isSi
        ? "නවත්වන්න"
        : isTa
          ? "நிறுத்து"
          : "Pause"
      : isSi
        ? "ආරම්භ කරන්න"
        : isTa
          ? "தொடரவும்"
          : "Resume";
  }

  const cameraModeBtn = document.getElementById("cameraModeBtn");
  if (cameraModeBtn) {
    const modeText =
      busState.cameraMode === "CHASE"
        ? isSi
          ? "ලුහුබැඳීම"
          : isTa
            ? "பின்தொடர்"
            : "Chase"
        : isSi
          ? "නිදහස්"
          : isTa
            ? "சுதந்திரம்"
            : "Free";
    cameraModeBtn.textContent = isSi
      ? `කැමරාව: ${modeText}`
      : isTa
        ? `கமரா: ${modeText}`
        : `Camera: ${modeText}`;
  }

  const liveryBtn = document.getElementById("busLiveryBtn");
  if (liveryBtn) {
    const liveryText =
      busState.livery === "SLTB"
        ? isSi
          ? "ලංගම (SLTB)"
          : isTa
            ? "இ.போ.ச (SLTB)"
            : "SLTB"
        : isSi
          ? "පෞද්ගලික (PRIVATE)"
          : isTa
            ? "தனியார் (PRIVATE)"
            : "PRIVATE";
    liveryBtn.textContent = isSi
      ? `බස් රථය: ${liveryText}`
      : isTa
        ? `பஸ் வகை: ${liveryText}`
        : `Livery: ${liveryText}`;
  }

  const langBtn = document.getElementById("languageToggleBtn");
  if (langBtn) {
    const langLabel = isSi ? "සිංහල" : isTa ? "தமிழ்" : "English";
    langBtn.textContent = `Language: ${langLabel}`;
  }

  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    const themeText =
      busState.theme === "dark"
        ? isSi
          ? "අඳුරු (Dark)"
          : isTa
            ? "இருள் (Dark)"
            : "Dark"
        : isSi
          ? "ආලෝක (Light)"
          : isTa
            ? "ஒளி (Light)"
            : "Light";
    themeBtn.textContent = isSi
      ? `තේමාව: ${themeText}`
      : isTa
        ? `தீம்: ${themeText}`
        : `Theme: ${themeText}`;
  }

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.textContent = isSi ? "යළි සකසන්න" : isTa ? "மீட்டமை" : "Reset";
  }

  if (autoStopPopup && activeAutoStopKey) {
    updateProximityStopPopup();
  }
}

// ============================================================================
// 7. SINGLE-ID MENU TOGGLE & POPUP CONTROLS
// ============================================================================
const menuToggleBtn = document.getElementById("menuToggleBtn");
const controlPopup = document.getElementById("controlPopup");
const speedSlider = document.getElementById("speedSlider");
const speedSliderValue = document.getElementById("speedSliderValue");
const geoLocationBtn = document.getElementById("geoLocationBtn");

if (geoLocationBtn) {
  geoLocationBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleHighAccuracyGeolocation();
  });
}

if (speedSlider && speedSliderValue) {
  speedSlider.min = String(MIN_BUS_SPEED_KMH);
  speedSlider.max = String(MAX_BUS_SPEED_KMH);
  speedSlider.value = String(DEFAULT_BUS_SPEED_KMH);
  speedSliderValue.textContent = `${DEFAULT_BUS_SPEED_KMH} km/h`;

  speedSlider.addEventListener("input", (e) => {
    const nextSpeed = Math.min(
      MAX_BUS_SPEED_KMH,
      Math.max(MIN_BUS_SPEED_KMH, Number(e.target.value) || 0),
    );
    busState.cruiseSpeedKmh = nextSpeed;
    speedSliderValue.textContent = `${nextSpeed} km/h`;
    if (busState.stopTimer <= 0) {
      busState.targetSpeedKmh = nextSpeed;
    }
  });
}

function setPopupOpen(isOpen) {
  controlPopup.classList.toggle("hidden", !isOpen);
  menuToggleBtn.classList.toggle("active", isOpen);
}

menuToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = controlPopup.classList.contains("hidden");
  setPopupOpen(willOpen);
});

controlPopup.addEventListener("click", (e) => {
  e.stopPropagation();
});

document.addEventListener("click", () => {
  if (!controlPopup.classList.contains("hidden")) {
    setPopupOpen(false);
  }
});

document.getElementById("playPauseBtn").addEventListener("click", () => {
  busState.isPlaying = !busState.isPlaying;
  updateHUD();
});

document.getElementById("cameraModeBtn").addEventListener("click", () => {
  busState.cameraMode = busState.cameraMode === "CHASE" ? "FREE" : "CHASE";
  updateHUD();
});

document.getElementById("busLiveryBtn").addEventListener("click", () => {
  busState.livery = busState.livery === "SLTB" ? "PRIVATE" : "SLTB";
  threeBusLayer.buildBusModel();
  updateHUD();
});

document.getElementById("languageToggleBtn").addEventListener("click", () => {
  const nextIdx = (LANGUAGES.indexOf(busState.language) + 1) % LANGUAGES.length;
  busState.language = LANGUAGES[nextIdx];
  refreshRouteOptionLabels();
  updateHUD();
});

document.getElementById("themeToggleBtn").addEventListener("click", () => {
  busState.theme = busState.theme === "dark" ? "light" : "dark";
  document.body.classList.toggle("theme-light", busState.theme === "light");
  updateHUD();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  busState.distanceKm = 0;
  busState.currentSpeedKmh = 0;
  busState.cruiseSpeedKmh = DEFAULT_BUS_SPEED_KMH;
  busState.targetSpeedKmh = DEFAULT_BUS_SPEED_KMH;
  busState.stopTimer = 0;
  activeStoppedStopNameObj = null;
  if (speedSlider && speedSliderValue) {
    speedSlider.value = String(DEFAULT_BUS_SPEED_KMH);
    speedSliderValue.textContent = `${DEFAULT_BUS_SPEED_KMH} km/h`;
  }
  stopsAlongRoute.forEach((s) => (s.visited = false));
  if (autoStopPopup) {
    autoStopPopup.remove();
    autoStopPopup = null;
    activeAutoStopKey = null;
  }
  updateHUD();
});

updateHUD();
