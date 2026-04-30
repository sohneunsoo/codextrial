import './styles.css';

declare global {
  interface Window {
    L: any;
  }
}

type LatLng = { lat: number; lng: number };
type TravelMode = 'walk' | 'run' | 'bike' | 'drive' | 'tour';
type Priority = 'shape' | 'scenic' | 'parks' | 'waterfront' | 'cafes' | 'lowElevation' | 'safe';

const L = window.L;

const cityPresets: Record<string, { label: string; center: LatLng; zoom: number }> = {
  seoul: { label: 'Seoul', center: { lat: 37.5665, lng: 126.978 }, zoom: 13 },
  nyc: { label: 'New York', center: { lat: 40.7306, lng: -73.9866 }, zoom: 13 },
  paris: { label: 'Paris', center: { lat: 48.8566, lng: 2.3522 }, zoom: 13 },
  london: { label: 'London', center: { lat: 51.5072, lng: -0.1276 }, zoom: 13 },
  tokyo: { label: 'Tokyo', center: { lat: 35.6762, lng: 139.6503 }, zoom: 13 }
};

const state = {
  mode: 'walk' as TravelMode,
  priority: 'shape' as Priority,
  rawPoints: [] as LatLng[],
  sampledPoints: [] as LatLng[],
  routePoints: [] as LatLng[],
  drawing: false,
  currentCity: 'seoul'
};

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <aside class="panel">
    <div class="brand">
      <div class="mark">SR</div>
      <div><h1>ShapeRoute</h1><p>Sketch a route. Turn it into roads.</p></div>
    </div>
    <label>City<select id="citySelect">${Object.entries(cityPresets).map(([key, city]) => `<option value="${key}">${city.label}</option>`).join('')}</select></label>
    <div class="group"><span>Mode</span><div class="segmented" id="modeGroup">
      <button data-mode="walk" class="active">Walk</button><button data-mode="run">Run</button><button data-mode="bike">Bike</button><button data-mode="drive">Drive</button><button data-mode="tour">Tour</button>
    </div></div>
    <label>Priority<select id="prioritySelect">
      <option value="shape">Shape accuracy</option><option value="scenic">Scenic quality</option><option value="parks">Parks</option><option value="waterfront">Waterfront</option><option value="cafes">Cafes</option><option value="lowElevation">Low elevation</option><option value="safe">Safety</option>
    </select></label>
    <div class="actions"><button id="drawBtn" class="primary">Draw route</button><button id="generateBtn">Generate</button><button id="clearBtn">Clear</button></div>
    <div class="stats"><div><strong id="distance">0.0 km</strong><span>Distance</span></div><div><strong id="duration">0 min</strong><span>ETA</span></div><div><strong id="score">0%</strong><span>Similarity</span></div></div>
    <section class="notes"><h2>Route Notes</h2><ul id="routeNotes"><li>Choose a city, draw a loose path, then generate.</li></ul></section>
    <section class="waypoints"><h2>Waypoints</h2><ol id="waypointList"></ol></section>
    <div class="exports"><button id="gpxBtn">Export GPX</button><button id="shareBtn">Share image</button><button id="saveBtn">Save</button></div>
  </aside>
  <main><div id="map"></div><div class="mapHint" id="mapHint">Click "Draw route", then drag on the map.</div></main>
`;

const map = L.map('map', { zoomControl: false }).setView(cityPresets.seoul.center, cityPresets.seoul.zoom);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);

const sketchLayer = L.polyline([], { color: '#ef5b5b', weight: 4, opacity: 0.85, dashArray: '6 8' }).addTo(map);
const sampledLayer = L.layerGroup().addTo(map);
const routeLayer = L.polyline([], { color: '#1f7a6d', weight: 6, opacity: 0.9 }).addTo(map);

const citySelect = document.querySelector<HTMLSelectElement>('#citySelect')!;
const prioritySelect = document.querySelector<HTMLSelectElement>('#prioritySelect')!;
const drawBtn = document.querySelector<HTMLButtonElement>('#drawBtn')!;
const generateBtn = document.querySelector<HTMLButtonElement>('#generateBtn')!;
const clearBtn = document.querySelector<HTMLButtonElement>('#clearBtn')!;
const mapHint = document.querySelector<HTMLDivElement>('#mapHint')!;
const notes = document.querySelector<HTMLUListElement>('#routeNotes')!;
const waypointList = document.querySelector<HTMLOListElement>('#waypointList')!;

citySelect.addEventListener('change', () => {
  state.currentCity = citySelect.value;
  const city = cityPresets[state.currentCity];
  map.setView(city.center, city.zoom);
});

prioritySelect.addEventListener('change', () => {
  state.priority = prioritySelect.value as Priority;
});

document.querySelectorAll<HTMLButtonElement>('#modeGroup button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('#modeGroup button').forEach((node) => node.classList.remove('active'));
    button.classList.add('active');
    state.mode = button.dataset.mode as TravelMode;
  });
});

drawBtn.addEventListener('click', () => {
  state.drawing = !state.drawing;
  drawBtn.textContent = state.drawing ? 'Stop drawing' : 'Draw route';
  drawBtn.classList.toggle('recording', state.drawing);
  map.dragging[state.drawing ? 'disable' : 'enable']();
  mapHint.textContent = state.drawing ? 'Drag across the map to sketch your route.' : 'Sketch captured. Generate when ready.';
});

clearBtn.addEventListener('click', clearRoute);
generateBtn.addEventListener('click', generateRoute);
document.querySelector<HTMLButtonElement>('#gpxBtn')!.addEventListener('click', exportGpx);
document.querySelector<HTMLButtonElement>('#shareBtn')!.addEventListener('click', () => setNotes(['Share image placeholder: v1 will render a branded route card with city, distance, ETA, and shape score.']));
document.querySelector<HTMLButtonElement>('#saveBtn')!.addEventListener('click', () => {
  localStorage.setItem('shapeRouteDraft', JSON.stringify({ ...state, drawing: false }));
  setNotes(['Draft saved locally in this browser.']);
});

map.on('mousedown', (event: any) => {
  if (!state.drawing) return;
  state.rawPoints = [{ lat: event.latlng.lat, lng: event.latlng.lng }];
  sketchLayer.setLatLngs(state.rawPoints);
});

map.on('mousemove', (event: any) => {
  if (!state.drawing || state.rawPoints.length === 0) return;
  const next = { lat: event.latlng.lat, lng: event.latlng.lng };
  const previous = state.rawPoints[state.rawPoints.length - 1];
  if (haversine(previous, next) > 8) {
    state.rawPoints.push(next);
    sketchLayer.setLatLngs(state.rawPoints);
  }
});

map.on('mouseup', () => {
  if (!state.drawing || state.rawPoints.length < 2) return;
  state.sampledPoints = selectWaypoints(state.rawPoints, waypointBudgetForMode(state.mode));
  renderWaypoints();
});

async function generateRoute() {
  if (state.rawPoints.length < 2) {
    setNotes(['Draw at least a short path before generating.']);
    return;
  }
  state.sampledPoints = selectWaypoints(state.rawPoints, waypointBudgetForMode(state.mode));
  renderWaypoints();
  setNotes(['Generating route through sampled waypoints using OSRM demo routing...']);
  try {
    const route = await fetchOsrmRoute(state.sampledPoints, state.mode);
    state.routePoints = route.points;
    routeLayer.setLatLngs(state.routePoints);
    map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
    const score = similarityScore(state.rawPoints, state.routePoints);
    updateStats(route.distanceMeters, route.durationSeconds, score);
    setNotes(buildRouteNotes(route.distanceMeters, score));
  } catch (error) {
    console.error(error);
    routeLayer.setLatLngs(state.sampledPoints);
    const fallbackDistance = pathLength(state.sampledPoints);
    updateStats(fallbackDistance, fallbackDistance / 1.3, 45);
    setNotes(['Routing API failed or rejected the sketch. Showing simplified waypoint path as a fallback.', 'Try fewer turns, a smaller area, or a route closer to roads.']);
  }
}

function selectWaypoints(points: LatLng[], budget: number): LatLng[] {
  const tolerance = Math.max(5, pathLength(points) / 100);
  const simplified = douglasPeucker(points, tolerance);
  if (simplified.length <= budget) return simplified;
  const selected: LatLng[] = [];
  const lastIndex = simplified.length - 1;
  for (let i = 0; i < budget; i += 1) selected.push(simplified[Math.round((i / (budget - 1)) * lastIndex)]);
  return dedupePoints(selected);
}

function waypointBudgetForMode(mode: TravelMode) {
  if (mode === 'drive') return 18;
  if (mode === 'tour') return 22;
  return 24;
}

async function fetchOsrmRoute(points: LatLng[], mode: TravelMode) {
  const routing = mode === 'bike' ? { service: 'routed-bike', profile: 'bike' } : mode === 'drive' ? { service: 'routed-car', profile: 'driving' } : { service: 'routed-foot', profile: 'foot' };
  const coords = points.map((point) => `${point.lng},${point.lat}`).join(';');
  const url = `https://routing.openstreetmap.de/${routing.service}/route/v1/${routing.profile}/${coords}?overview=full&geometries=geojson&steps=true`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Routing failed: ${response.status}`);
  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) throw new Error('No route returned');
  return { distanceMeters: route.distance as number, durationSeconds: route.duration as number, points: route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })) };
}

function douglasPeucker(points: LatLng[], epsilonMeters: number): LatLng[] {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }
  if (maxDistance > epsilonMeters) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilonMeters);
    const right = douglasPeucker(points.slice(index), epsilonMeters);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function perpendicularDistance(point: LatLng, start: LatLng, end: LatLng) {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = Math.cos((point.lat * Math.PI) / 180) * 111_320;
  const px = point.lng * metersPerDegreeLng;
  const py = point.lat * metersPerDegreeLat;
  const sx = start.lng * metersPerDegreeLng;
  const sy = start.lat * metersPerDegreeLat;
  const ex = end.lng * metersPerDegreeLng;
  const ey = end.lat * metersPerDegreeLat;
  const dx = ex - sx;
  const dy = ey - sy;
  if (dx === 0 && dy === 0) return Math.hypot(px - sx, py - sy);
  const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (sx + t * dx), py - (sy + t * dy));
}

function similarityScore(raw: LatLng[], routed: LatLng[]) {
  if (raw.length < 2 || routed.length < 2) return 0;
  const samples = selectWaypoints(raw, 40);
  const average = samples.map((sample) => minDistanceToPath(sample, routed)).reduce((sum, distance) => sum + distance, 0) / samples.length;
  const sketchLength = Math.max(pathLength(raw), 1);
  const penalty = Math.min(90, (average / Math.max(sketchLength / 30, 20)) * 100);
  return Math.max(0, Math.round(100 - penalty));
}

function minDistanceToPath(point: LatLng, path: LatLng[]) {
  let minimum = Infinity;
  for (let i = 1; i < path.length; i += 1) minimum = Math.min(minimum, perpendicularDistance(point, path[i - 1], path[i]));
  return minimum;
}

function pathLength(points: LatLng[]) {
  return points.slice(1).reduce((sum, point, index) => sum + haversine(points[index], point), 0);
}

function haversine(a: LatLng, b: LatLng) {
  const radius = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function dedupePoints(points: LatLng[]) {
  return points.filter((point, index) => index === 0 || haversine(points[index - 1], point) > 3);
}

function renderWaypoints() {
  sampledLayer.clearLayers();
  waypointList.innerHTML = '';
  state.sampledPoints.forEach((point, index) => {
    L.circleMarker(point, { radius: index === 0 || index === state.sampledPoints.length - 1 ? 7 : 5, color: '#f8fafc', fillColor: index === 0 ? '#2d9cdb' : index === state.sampledPoints.length - 1 ? '#ef5b5b' : '#22333b', fillOpacity: 1, weight: 2 }).addTo(sampledLayer);
    const item = document.createElement('li');
    item.textContent = `${index + 1}. ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
    waypointList.appendChild(item);
  });
}

function updateStats(distanceMeters: number, durationSeconds: number, score: number) {
  document.querySelector('#distance')!.textContent = `${(distanceMeters / 1000).toFixed(1)} km`;
  document.querySelector('#duration')!.textContent = `${Math.max(1, Math.round(durationSeconds / 60))} min`;
  document.querySelector('#score')!.textContent = `${score}%`;
}

function buildRouteNotes(distanceMeters: number, score: number) {
  const result = [`${state.sampledPoints.length} waypoints used from the original sketch.`];
  if (score < 55) result.push('Shape match is weak. Try simplifying the drawing or dragging it toward a denser street grid.');
  if (distanceMeters > 20_000 && ['walk', 'run', 'tour'].includes(state.mode)) result.push('Long route for this mode; v1 should warn before navigation/export.');
  result.push(priorityAdvice(state.priority));
  return result;
}

function priorityAdvice(priority: Priority) {
  const copy: Record<Priority, string> = {
    shape: 'Optimized for shape first. Production routing should trade off exactness against safety and path legality.',
    scenic: 'Scenic priority would add parks, rivers, overlooks, and landmark scoring after the base route.',
    parks: 'Parks priority would bias sampled waypoints toward green-space edges and trail networks.',
    waterfront: 'Waterfront priority would search nearby river/coastline segments and rerank alternatives.',
    cafes: 'Cafe priority would add optional POI stops near the route, not force every waypoint through shops.',
    lowElevation: 'Low elevation priority needs elevation tiles or provider elevation annotations.',
    safe: 'Safety priority should avoid highways, poor lighting, private roads, and high-crash corridors where data exists.'
  };
  return copy[priority];
}

function setNotes(items: string[]) {
  notes.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
}

function clearRoute() {
  state.rawPoints = [];
  state.sampledPoints = [];
  state.routePoints = [];
  sketchLayer.setLatLngs([]);
  routeLayer.setLatLngs([]);
  sampledLayer.clearLayers();
  waypointList.innerHTML = '';
  updateStats(0, 0, 0);
  setNotes(['Choose a city, draw a loose path, then generate.']);
}

function exportGpx() {
  const points = state.routePoints.length ? state.routePoints : state.sampledPoints;
  if (points.length < 2) {
    setNotes(['Generate a route before exporting GPX.']);
    return;
  }
  const trkpts = points.map((point) => `      <trkpt lat="${point.lat}" lon="${point.lng}"></trkpt>`).join('\n');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="ShapeRoute MVP">\n  <trk><name>ShapeRoute Draft</name><trkseg>\n${trkpts}\n  </trkseg></trk>\n</gpx>`;
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'shape-route-draft.gpx';
  anchor.click();
  URL.revokeObjectURL(url);
}
