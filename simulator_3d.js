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
// 1. GLOBAL SIMULATION STATE & DATA CONTAINERS
// ============================================================================
let routeLine = null;
let totalRouteKm = 0;
let stopsAlongRoute = [];
let busStopsData = {};
let activeStopPopup = null;
let autoStopPopup = null;
let activeAutoStopName = null;

const DEFAULT_BUS_SPEED_KMH = 24;
const MIN_BUS_SPEED_KMH = 0;
const MAX_BUS_SPEED_KMH = 200;
const OVERSPEED_LIMIT_KMH = 90;
const STOP_WAIT_SECONDS = 3;
const STOP_POPUP_RADIUS_METERS = 100;

// Zoom-to-scale stops for the 3D bus (similar to road layer zoom stops)
const BUS_ZOOM_SCALE_STOPS = [
  [11, 4],
  [13, 3.5],
  [15, 2.0],
  [16.2, 1.2],
  [18, 1],
];

const busState = {
  isPlaying: true,
  livery: "SLTB",
  cameraMode: "CHASE",
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

    const popupHtml = `
      <div><strong>${nearestStop.name}</strong></div>
      <div>Main station: ${distFromMainKm.toFixed(2)} km</div>
    `;

    if (!autoStopPopup || activeAutoStopName !== nearestStop.name) {
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
      activeAutoStopName = nearestStop.name;
    } else {
      autoStopPopup.setLngLat(nearestStop.coords).setHTML(popupHtml);
    }
  } else if (autoStopPopup) {
    autoStopPopup.remove();
    autoStopPopup = null;
    activeAutoStopName = null;
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

    // Bright ambient + directional light so Lambert materials never render black on Android WebGL
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
// 3. INITIALIZE MAPLIBRE GL JS
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

// ============================================================================
// 4. ROUTE LOADING & SIMULATOR SETUP FUNCTION
// ============================================================================
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

    const rawStops = busStopsData[routeKey] || [];
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
    if (stopsAlongRoute.length > 0) {
      busState.currentLngLat = stopsAlongRoute[0].coords;
    }

    if (autoStopPopup) {
      autoStopPopup.remove();
      autoStopPopup = null;
      activeAutoStopName = null;
    }

    if (map.getSource("bus-route-src")) {
      map.getSource("bus-route-src").setData(geojson);
    }
    if (map.getSource("bus-stops-src")) {
      const stopsGeoJson = {
        type: "FeatureCollection",
        features: rawStops.map((s) => ({
          type: "Feature",
          properties: { name: s.name },
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

    document.getElementById("routeTitle").textContent =
      `${routeKey} Live 3D Bus`;
  } catch (err) {
    console.error("Failed to load route data:", err);
  }
}

// ============================================================================
// 5. MAP LOAD & EVENT LISTENERS
// ============================================================================
map.on("load", async () => {
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

  // Popup with 10px font when clicking a bus stop circle
  map.on("click", "bus-stops-circles", (e) => {
    const feature = e.features && e.features[0];
    if (!feature) return;

    const coords = feature.geometry.coordinates.slice();
    const stopName =
      feature.properties && feature.properties.name
        ? feature.properties.name
        : "Bus Stop";

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
  const dt = Math.min((now - lastTimestamp) / 1000, 0.1);
  lastTimestamp = now;

  if (busState.isPlaying && routeLine && totalRouteKm > 0) {
    busState.suspensionTime += dt;

    if (busState.stopTimer > 0) {
      busState.stopTimer = Math.max(0, busState.stopTimer - dt);
      busState.targetSpeedKmh = 0;
    } else {
      busState.targetSpeedKmh = busState.cruiseSpeedKmh;
    }

    const accelRate =
      busState.targetSpeedKmh > busState.currentSpeedKmh ? 28 : 42;
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
        document.getElementById("statusDisplay").textContent =
          `At ${stop.name}`;
        document.getElementById("statusDisplay").className =
          "stat-val status-stopped";
        break;
      }
    }

    if (busState.stopTimer <= 0) {
      document.getElementById("statusDisplay").textContent = "On Route";
      document.getElementById("statusDisplay").className =
        "stat-val status-moving";
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
      busState.currentBearing += diff * Math.min(1, dt * 6);
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
  const roundedSpeed = Math.round(busState.currentSpeedKmh);
  const isOverspeed = roundedSpeed > OVERSPEED_LIMIT_KMH;

  const speedEl = document.getElementById("speedDisplay");
  speedEl.textContent = `${roundedSpeed} km/h`;
  speedEl.classList.toggle("overspeed", isOverspeed);

  const overspeedEl = document.getElementById("overspeedIndicator");
  if (overspeedEl) {
    overspeedEl.classList.toggle("active", isOverspeed);
  }

  document.getElementById("progressText").textContent =
    `${busState.distanceKm.toFixed(2)} / ${totalRouteKm.toFixed(2)} km`;

  const pct = Math.min(
    100,
    Math.round((busState.distanceKm / totalRouteKm) * 100),
  );
  document.getElementById("progressPct").textContent = `${pct}%`;
  document.getElementById("progressFill").style.width = `${pct}%`;

  const upcoming = stopsAlongRoute.find(
    (s) => s.distKm > busState.distanceKm + 0.02,
  );
  document.getElementById("nextStopDisplay").textContent = upcoming
    ? upcoming.name
    : "Last stop (End)";
}

// ============================================================================
// 7. SINGLE-ID MENU TOGGLE & POPUP CONTROLS
// ============================================================================
const menuToggleBtn = document.getElementById("menuToggleBtn");
const controlPopup = document.getElementById("controlPopup");
const speedSlider = document.getElementById("speedSlider");
const speedSliderValue = document.getElementById("speedSliderValue");

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

document.getElementById("playPauseBtn").addEventListener("click", (e) => {
  busState.isPlaying = !busState.isPlaying;
  e.target.textContent = busState.isPlaying ? "Pause" : "Resume";
});

document.getElementById("cameraModeBtn").addEventListener("click", (e) => {
  busState.cameraMode = busState.cameraMode === "CHASE" ? "FREE" : "CHASE";
  e.target.textContent = `Camera: ${busState.cameraMode === "CHASE" ? "Chase" : "Free"}`;
});

document.getElementById("busLiveryBtn").addEventListener("click", (e) => {
  busState.livery = busState.livery === "SLTB" ? "PRIVATE" : "SLTB";
  e.target.textContent = `Livery: ${busState.livery}`;
  threeBusLayer.buildBusModel();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  busState.distanceKm = 0;
  busState.currentSpeedKmh = 0;
  busState.cruiseSpeedKmh = DEFAULT_BUS_SPEED_KMH;
  busState.targetSpeedKmh = DEFAULT_BUS_SPEED_KMH;
  busState.stopTimer = 0;
  if (speedSlider && speedSliderValue) {
    speedSlider.value = String(DEFAULT_BUS_SPEED_KMH);
    speedSliderValue.textContent = `${DEFAULT_BUS_SPEED_KMH} km/h`;
  }
  stopsAlongRoute.forEach((s) => (s.visited = false));
  if (autoStopPopup) {
    autoStopPopup.remove();
    autoStopPopup = null;
    activeAutoStopName = null;
  }
  updateHUD();
});
