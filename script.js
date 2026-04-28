const API_KEY = "PASTE_YOUR_OPENWEATHER_KEY";
let map = L.map("map").setView([30.9010, 75.8573], 12); // Ludhiana default
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "OSM" }).addTo(map);
let marker, routeLayer, startMarker, endMarker, placesLayer;
let currentRoute = null;

const tooltipConfig = {
  backgroundColor: 'rgba(7,30,39,0.98)',
  titleColor: '#ffffff',
  bodyColor: '#c6f6ff',
  borderColor: '#00eaff',
  borderWidth: 1,
  cornerRadius: 12,
  displayColors: false,
  titleFont: { size: 13, weight: '600' },
  bodyFont: { size: 12 },
  padding: 12,
  caretPadding: 8
};

// Sample places data for each city
const cityPlaces = {
  "Ludhiana": {
    hospitals: [[30.9124, 75.8533, "Civil Hospital"], [30.8967, 75.8225, "Christian Medical College"]],
    police: [[30.9010, 75.8573, "City Police Station"], [30.9150, 75.8400, "Division Police"]],
    markets: [[30.9075, 75.8431, "Model Town Market"], [30.8950, 75.8499, "Chaura Bazar"]],
    schools: [[30.9050, 75.8520, "DAV School"], [30.9100, 75.8600, "St. Anne's School"]]
  },
  "Delhi": {
    hospitals: [[28.6139, 77.2090, "AIIMS"], [28.5274, 77.2221, "Safdarjung Hospital"]],
    police: [[28.6139, 77.2090, "Connaught Place PS"], [28.7041, 77.1025, "Karol Bagh PS"]],
    markets: [[28.6315, 77.2193, "Connaught Place"], [28.6481, 77.2008, "Sarojini Nagar"]],
    schools: [[28.6139, 77.2090, "Delhi Public School"], [28.5355, 77.1697, "Modern School"]]
  }
  // Add more cities as needed
};

// Charts (unchanged)
let trafficChart = new Chart(document.getElementById("trafficChart"), {
  type: "line",
  data: { labels: ["00","04","08","12","16","20","23"], datasets: [{ data: [120,280,650,820,950,720,180], borderColor: "#00eaff", borderWidth: 3, tension: 0.4, fill: { target: 'origin', above: 'rgba(0,234,255,0.1)' } }] },
  options: { interaction: { mode: 'index' }, plugins: { legend: { display: false }, tooltip: { ...tooltipConfig, callbacks: { label: ctx => `${ctx.parsed.y.toLocaleString()} vehicles/hr` } } }, scales: { x: { ticks: { color: "#7fd8ff" } }, y: { ticks: { color: "#7fd8ff" } } } }
});

let energyChart = new Chart(document.getElementById("energyChart"), {
  type: "bar",
  data: { labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], datasets: [{ data: [3.2,4.1,5.3,4.8,3.9,2.8,2.1], backgroundColor: "rgba(0,255,166,0.8)" }] },
  options: { plugins: { legend: { display: false }, tooltip: { ...tooltipConfig, callbacks: { label: ctx => `${ctx.parsed.y} MW` } } }, scales: { x: { grid: { display: false } }, y: { ticks: { color: "#7fd8ff" } } } }
});

let airChart = new Chart(document.getElementById("airChart"), {
  type: "line",
  data: { labels: ["06","09","12","15","18","21"], datasets: [{ data: [42,58,72,68,55,48], borderColor: "#ffaa00", borderWidth: 3, tension: 0.4, fill: { target: 'origin', above: 'rgba(255,170,0,0.1)' } }] },
  options: { interaction: { mode: 'index' }, plugins: { legend: { display: false }, tooltip: { ...tooltipConfig, callbacks: { label: ctx => `AQI: ${ctx.parsed.y}` } } }, scales: { x: { ticks: { color: "#ffd38b" } }, y: { ticks: { color: "#ffd38b" } } } }
});

let floodChart = new Chart(document.getElementById("floodChart"), {
  type: "line",
  data: {
    labels: ["12AM", "3AM", "6AM", "9AM", "12PM", "3PM", "6PM", "9PM"],
    datasets: [{
      label: 'River Level',
      data: [0.2, 0.4, 0.8, 1.2, 1.8, 2.1, 1.9, 1.5],
      borderColor: "#ff6b8b",
      backgroundColor: "rgba(255,107,139,0.2)",
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      pointHoverRadius: 8,
      pointHoverBackgroundColor: '#ff4444'
    }]
  },
  options: {
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipConfig,
        callbacks: {
          title: (ctx) => ctx[0].label,
          label: (ctx) => `${ctx.parsed.y}m above normal`
        }
      }
    },
    scales: {
      x: { ticks: { color: "#ffb3b3" }, grid: { color: "rgba(255,107,139,0.2)" } },
      y: { 
        ticks: { color: "#ffb3b3", callback: v => v + 'm' },
        grid: { color: "rgba(255,107,139,0.2)" },
        suggestedMax: 3
      }
    }
  }
});

// NEW: Directions Functions
function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tabContent').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tabBtn').forEach(btn => btn.classList.remove('active'));
  
  // Show selected tab
  document.getElementById(tabName + 'Tab').classList.add('active');
  event.target.classList.add('active');
}

async function calculateRoute() {
  const start = document.getElementById('startPoint').value;
  const end = document.getElementById('endPoint').value;
  
  if (!start || !end) {
    alert('Please enter both start and destination!');
    return;
  }
  
  // Clear existing markers and routes
  map.eachLayer(layer => {
    if (layer !== map._layers[L.tileLayer._leaflet_id]) {
      map.removeLayer(layer);
    }
  });
  
  // Geocode start point
  const startCoords = await geocodeAddress(start);
  const endCoords = await geocodeAddress(end);
  
  if (!startCoords || !endCoords) {
    alert('Could not find one or both locations!');
    return;
  }
  
  // Add start and end markers
  startMarker = L.marker(startCoords, {
    icon: L.divIcon({
      className: 'custom-start-icon',
      html: '<div style="background: #00ff9c; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 10px #00ff9c;"></div>',
      iconSize: [26, 26]
    })
  }).addTo(map).bindPopup(`Start: ${start}`);
  
  endMarker = L.marker(endCoords, {
    icon: L.divIcon({
      className: 'custom-end-icon',
      html: '<div style="background: #ff6b8b; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 10px #ff6b8b;"></div>',
      iconSize: [26, 26]
    })
  }).addTo(map).bindPopup(`Destination: ${end}`);
  
  // Calculate and draw route
  drawRoute(startCoords, endCoords, start, end);
}

async function geocodeAddress(address) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', India')}&limit=1&addressdetails=1`);
    const data = await response.json();
    if (data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (e) {
    console.error('Geocoding failed:', e);
  }
  return null;
}

function drawRoute(start, end, startName, endName) {
  // Simulate route calculation (straight line with waypoints for realistic path)
  const distance = getDistance(start, end);
  const bearing = getBearing(start, end);
  const waypoints = generateRouteWaypoints(start, end, distance);
  
  // Draw polyline route
  const routeCoords = [start, ...waypoints, end];
  routeLayer = L.polyline(routeCoords, {
    color: '#00ff9c',
    weight: 6,
    opacity: 0.9,
    dashArray: '10, 5'
  }).addTo(map);
  
  // Fit bounds
  map.fitBounds(routeLayer.getBounds().pad(0.1));
  
  // Show route info popup
  const routeInfo = `
    <div style="min-width: 200px;">
      <h4 style="margin: 0 0 10px 0; color: #00ff9c;">🚗 Route Summary</h4>
      <p><strong>Distance:</strong> ${distance.toFixed(1)} km</p>
      <p><strong>Est. Time:</strong> ${Math.round(distance * 2)} min</p>
      <p><strong>Status:</strong> <span style="color: #21e0a6;">Optimal</span></p>
    </div>
  `;
  
  L.popup({closeButton: false, autoClose: false, className: 'route-popup'})
    .setLatLng(map.getBounds().getCenter())
    .setContent(routeInfo)
    .openOn(map);
  
  currentRoute = { coords: routeCoords, distance, waypoints };
}

function generateRouteWaypoints(start, end, distance) {
  const waypoints = [];
  const steps = Math.max(3, Math.floor(distance / 2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const lat = start[0] + t * (end[0] - start[0]) + (Math.random() - 0.5) * 0.005;
    const lng = start[1] + t * (end[1] - start[1]) + (Math.random() - 0.5) * 0.005;
    waypoints.push([lat, lng]);
  }
  return waypoints;
}

function getDistance(p1, p2) {
  const R = 6371; // Earth's radius in km
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLng = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getBearing(start, end) {
  const lat1 = start[0] * Math.PI / 180;
  const lat2 = end[0] * Math.PI / 180;
  const dLng = (end[1] - start[1]) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function selectPlace() {
  const placeType = document.getElementById('placesSelect').value.toLowerCase();
  const currentCity = document.getElementById('citySelect').value;
  
  // Clear existing places
  if (placesLayer) map.removeLayer(placesLayer);
  
  const places = cityPlaces[currentCity]?.[placeType] || [];
  if (places.length === 0) return;
  
  placesLayer = L.layerGroup();
  places.forEach(([lat, lng, name]) => {
    L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'place-icon',
        html: '🏥',
        iconSize: [30, 30]
      })
    })
    .addTo(placesLayer)
    .bindPopup(`<b>${name}</b><br>${placeType}`);
  });
  
  placesLayer.addTo(map);
  map.fitBounds(placesLayer.getBounds());
}

// Existing functions (updated to work with new map layers)
async function selectCity() {
  const city = document.getElementById("citySelect").value;
  document.getElementById("citySearch").value = city;
  document.getElementById("currentCity").textContent = `Real-time urban intelligence with Flood Management — ${city}, India`;
  
  // Clear directions and places
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
  if (routeLayer) map.removeLayer(routeLayer);
  if (placesLayer) map.removeLayer(placesLayer);
  
  await searchCity();
}

async function searchCity() {
  const city = document.getElementById("citySearch").value.trim();
  if (!city) return;

  let geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`);
  let geoData = await geo.json();
  if (geoData.length === 0) { alert("City not found"); return; }

  let lat = parseFloat(geoData[0].lat), lon = parseFloat(geoData[0].lon);
  map.setView([lat, lon], 12);
  
  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lon]).addTo(map);

  // Weather data
  let tempC = 25, desc = "Clear";
  try {
    let weather = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
    if (weather.ok) {
      let weatherData = await weather.json();
      tempC = Math.round(weatherData.main.temp);
      desc = weatherData.weather[0].main || "Clear";
    }
  } catch (e) { }

  let aqi = Math.floor(30 + Math.random() * 100);
  let traffic = (Math.random() * 15000 + 5000).toLocaleString();
  let energy = (Math.random() * 8 + 3).toFixed(1);

  // Flood data
  const floodRisks = {
    "Mumbai": { level: 2.1 + Math.random()*0.8, risk: "Critical" },
    "Kolkata": { level: 1.8 + Math.random()*0.6, risk: "Warning" },
    "Chennai": { level: 1.4 + Math.random()*0.7, risk: "Warning" },
    "Delhi": { level: 0.8 + Math.random()*0.4, risk: "Safe" },
    "default": { level: 0.3 + Math.random()*0.8, risk: "Safe" }
  };
  const floodData = floodRisks[city] || floodRisks.default;
  const floodLevel = floodData.level.toFixed(1);
  const floodStatus = floodData.risk;

  // Update UI
  document.getElementById("trafficValue").innerText = traffic;
  document.getElementById("energyValue").innerText = energy;
  document.getElementById("aqiValue").innerText = aqi;
  document.getElementById("weatherTemp").innerText = tempC;
  document.getElementById("weatherDesc").innerText = desc;
  document.getElementById("floodLevel").innerText = floodLevel;
  document.getElementById("floodStatus").textContent = floodStatus;
  document.querySelector('.flood-card').className = `card flood-card ${floodStatus.toLowerCase()}`;
  document.getElementById('floodStatus').className = `cardStatus ${floodStatus.toLowerCase()}`;

  // Update charts
  trafficChart.data.datasets[0].data = Array(7).fill().map(() => Math.random()*1100 + 100);
  energyChart.data.datasets[0].data = Array(7).fill().map(() => Math.random()*7 + 1);
  airChart.data.datasets[0].data = Array(6).fill().map(() => aqi + (Math.random()-0.5)*40);
  floodChart.data.datasets[0].data = [0.1, 0.3, 0.6, 1.0, 1.4, 1.8, parseFloat(floodLevel)-0.2, parseFloat(floodLevel)];
  
  trafficChart.update('none'); energyChart.update('none'); airChart.update('none'); floodChart.update('none');

  // Status bars
  setStatusBar("trafficBar", "trafficBarVal", 60 + Math.random()*30);
  setStatusBar("powerBar", "powerBarVal", 80 + Math.random()*15);
  setStatusBar("waterBar", "waterBarVal", 40 + Math.random()*20);
  setStatusBar("floodBar", "floodBarVal", Math.min(100, floodData.level * 25));
  setStatusBar("airBar", "airBarVal", 25 + Math.random()*20);
  setStatusBar("emergencyBar", "emergencyBarVal", floodData.level > 1.5 ? 60 + Math.random()*30 : 5 + Math.random()*20);
}

function setStatusBar(barId, textId, value) {
  const bar = document.getElementById(barId);
  const txt = document.getElementById(textId);
  const v = Math.min(100, Math.round(value));
  bar.style.width = v + "%";
  txt.innerText = v + "%";
}

// Initial load
selectCity();