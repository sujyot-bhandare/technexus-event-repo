/* =========================================================================
   CONFIG: Paste your OpenWeatherMap API key directly here
   Get a free key at: https://openweathermap.org/api
   ========================================================================= */
const OPENWEATHER_API_KEY = "YOUR_API_KEY_HERE";
/* ========================================================================= */

let unit = "metric"; // 'metric' = °C, 'imperial' = °F
let lastWeatherData = null;
let lastForecastData = null;

/* --------------------------- DOM References --------------------------- */
const el = {
  statusLine: document.getElementById('status-line'),
  placeName: document.getElementById('place-name'),
  placeDate: document.getElementById('place-date'),
  conditionDesc: document.getElementById('condition-desc'),
  tempBig: document.getElementById('temp-big'),
  weatherIcon: document.getElementById('weather-icon'),
  feelsLike: document.getElementById('feels-like'),
  tempHigh: document.getElementById('temp-high'),
  tempLow: document.getElementById('temp-low'),
  statHumidity: document.getElementById('stat-humidity'),
  statWind: document.getElementById('stat-wind'),
  statPressure: document.getElementById('stat-pressure'),
  statSunset: document.getElementById('stat-sunset'),
  hourlyScroll: document.getElementById('hourly-scroll'),
  dailyList: document.getElementById('daily-list'),
  panel: document.getElementById('panel'),
  cityInput: document.getElementById('city-input'),
  unitC: document.getElementById('unit-c'),
  unitF: document.getElementById('unit-f'),
  locateBtn: document.getElementById('locate-btn'),
  lightningFlash: document.getElementById('lightning-flash')
};

/* ============================ 3D SKY SCENE ============================= */

const canvas = document.getElementById('sky-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 60);

function makeRadialTexture(inner, outer, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

const glowTex = makeRadialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
const cloudTex = makeRadialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
const softDotTex = makeRadialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 32);

const skyGeo = new THREE.SphereGeometry(900, 32, 32);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    colorTop: { value: new THREE.Color('#0A1230') },
    colorBottom: { value: new THREE.Color('#2B4E7A') }
  },
  vertexShader: `
    varying vec3 vPos;
    void main(){
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vPos;
    uniform vec3 colorTop;
    uniform vec3 colorBottom;
    void main(){
      float h = normalize(vPos).y * 0.5 + 0.5;
      vec3 col = mix(colorBottom, colorTop, smoothstep(0.0, 1.0, h));
      gl_FragColor = vec4(col, 1.0);
    }
  `
});
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyMesh);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
sunLight.position.set(30, 40, 20);
scene.add(sunLight);

function makeGlowSprite(color, scale) {
  const mat = new THREE.SpriteMaterial({
    map: glowTex,
    color,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

const sunGroup = new THREE.Group();
const sunCore = new THREE.Mesh(
  new THREE.SphereGeometry(4.2, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xFFE3A6 })
);
sunGroup.add(sunCore);
sunGroup.add(makeGlowSprite(0xFFCB74, 34));
sunGroup.position.set(46, 34, -120);
scene.add(sunGroup);

const moonGroup = new THREE.Group();
const moonCore = new THREE.Mesh(
  new THREE.SphereGeometry(3.4, 24, 24),
  new THREE.MeshStandardMaterial({ color: 0xE9EDF5, emissive: 0x555a70, roughness: 1 })
);
moonGroup.add(moonCore);
moonGroup.add(makeGlowSprite(0xC9D6F0, 18));
moonGroup.position.set(-40, 32, -120);
scene.add(moonGroup);

const starCount = 900;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const r = 400 + Math.random() * 300;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(Math.random() * 0.85);
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.6 + 20;
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 100;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({
  size: 1.6,
  map: softDotTex,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  color: 0xffffff
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

const cloudCount = 16;
const clouds = [];
const cloudGroup = new THREE.Group();
for (let i = 0; i < cloudCount; i++) {
  const mat = new THREE.SpriteMaterial({
    map: cloudTex,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  const scale = 18 + Math.random() * 28;
  sprite.scale.set(scale * 1.8, scale, 1);
  sprite.position.set(
    (Math.random() - 0.5) * 260,
    10 + Math.random() * 35,
    -40 - Math.random() * 140
  );
  sprite.userData.speed = 0.4 + Math.random() * 0.6;
  sprite.userData.baseOpacity = 0.35 + Math.random() * 0.4;
  cloudGroup.add(sprite);
  clouds.push(sprite);
}
scene.add(cloudGroup);

const precipCount = 3000;
const precipGeo = new THREE.BufferGeometry();
const precipPos = new Float32Array(precipCount * 3);
const precipVel = new Float32Array(precipCount);
const precipDrift = new Float32Array(precipCount);
for (let i = 0; i < precipCount; i++) {
  precipPos[i * 3] = (Math.random() - 0.5) * 180;
  precipPos[i * 3 + 1] = Math.random() * 120 - 20;
  precipPos[i * 3 + 2] = (Math.random() - 0.5) * 160 - 20;
  precipVel[i] = 0.5 + Math.random() * 0.5;
  precipDrift[i] = Math.random() * Math.PI * 2;
}
precipGeo.setAttribute('position', new THREE.BufferAttribute(precipPos, 3));
const precipMat = new THREE.PointsMaterial({
  size: 0.5,
  map: softDotTex,
  color: 0xBFD8F2,
  transparent: true,
  opacity: 0,
  depthWrite: false
});
const precip = new THREE.Points(precipGeo, precipMat);
scene.add(precip);

let precipMode = 'none';
scene.fog = new THREE.FogExp2(0x2B4E7A, 0);

const sceneTarget = {
  topColor: new THREE.Color('#0A1230'),
  bottomColor: new THREE.Color('#2B4E7A'),
  starOpacity: 0,
  cloudOpacity: 0,
  precipOpacity: 0,
  fogDensity: 0,
  fogColor: new THREE.Color('#2B4E7A'),
  sunVisible: 1,
  moonVisible: 0,
  ambientIntensity: 0.7
};
let stormActive = false;

function applyWeatherToScene(main, isDay) {
  stormActive = false;
  precipMode = 'none';
  sceneTarget.fogDensity = 0;

  if (isDay) {
    sceneTarget.sunVisible = 1;
    sceneTarget.moonVisible = 0;
    sceneTarget.starOpacity = 0;
  } else {
    sceneTarget.sunVisible = 0;
    sceneTarget.moonVisible = 1;
    sceneTarget.starOpacity = 1;
  }

  switch (main) {
    case 'Clear':
      sceneTarget.topColor.set(isDay ? '#3E7BC4' : '#060A1E');
      sceneTarget.bottomColor.set(isDay ? '#9FD4EC' : '#141A3B');
      sceneTarget.cloudOpacity = 0;
      sceneTarget.ambientIntensity = isDay ? 0.95 : 0.35;
      break;
    case 'Clouds':
      sceneTarget.topColor.set(isDay ? '#5C7793' : '#0C1226');
      sceneTarget.bottomColor.set(isDay ? '#A9BCC9' : '#232B44');
      sceneTarget.cloudOpacity = 1;
      sceneTarget.ambientIntensity = isDay ? 0.8 : 0.32;
      break;
    case 'Rain':
    case 'Drizzle':
      sceneTarget.topColor.set(isDay ? '#3B4A5C' : '#080B18');
      sceneTarget.bottomColor.set(isDay ? '#7C8D9C' : '#1B2333');
      sceneTarget.cloudOpacity = 1;
      precipMode = 'rain';
      sceneTarget.precipOpacity = 0.85;
      sceneTarget.ambientIntensity = isDay ? 0.6 : 0.28;
      sceneTarget.fogDensity = 0.0025;
      sceneTarget.fogColor.set(isDay ? '#65788c' : '#141b2b');
      break;
    case 'Thunderstorm':
      sceneTarget.topColor.set('#11141F');
      sceneTarget.bottomColor.set('#2A2E3D');
      sceneTarget.cloudOpacity = 1;
      precipMode = 'rain';
      sceneTarget.precipOpacity = 0.9;
      sceneTarget.ambientIntensity = 0.3;
      stormActive = true;
      sceneTarget.fogDensity = 0.003;
      sceneTarget.fogColor.set('#161a26');
      break;
    case 'Snow':
      sceneTarget.topColor.set(isDay ? '#7C8CA0' : '#0E1526');
      sceneTarget.bottomColor.set(isDay ? '#D7E2EA' : '#2A3448');
      sceneTarget.cloudOpacity = 0.85;
      precipMode = 'snow';
      sceneTarget.precipOpacity = 0.9;
      sceneTarget.ambientIntensity = isDay ? 0.85 : 0.35;
      break;
    case 'Mist': case 'Haze': case 'Fog': case 'Smoke': case 'Dust':
      sceneTarget.topColor.set(isDay ? '#8A97A3' : '#141A26');
      sceneTarget.bottomColor.set(isDay ? '#C9D2D8' : '#242B38');
      sceneTarget.cloudOpacity = 0.5;
      sceneTarget.ambientIntensity = isDay ? 0.7 : 0.3;
      sceneTarget.fogDensity = 0.012;
      sceneTarget.fogColor.set(isDay ? '#c3ccd2' : '#1c2430');
      break;
    default:
      sceneTarget.topColor.set(isDay ? '#3E7BC4' : '#060A1E');
      sceneTarget.bottomColor.set(isDay ? '#9FD4EC' : '#141A3B');
      sceneTarget.cloudOpacity = 0.4;
      sceneTarget.ambientIntensity = isDay ? 0.85 : 0.32;
  }
}
applyWeatherToScene('Clear', true);

let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5);
  mouseY = (e.clientY / window.innerHeight - 0.5);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();

  const lerpSpeed = 1 - Math.pow(0.001, dt);
  skyMat.uniforms.colorTop.value.lerp(sceneTarget.topColor, lerpSpeed);
  skyMat.uniforms.colorBottom.value.lerp(sceneTarget.bottomColor, lerpSpeed);
  starMat.opacity += (sceneTarget.starOpacity - starMat.opacity) * lerpSpeed;
  precipMat.opacity += (sceneTarget.precipOpacity - precipMat.opacity) * lerpSpeed;
  ambientLight.intensity += (sceneTarget.ambientIntensity - ambientLight.intensity) * lerpSpeed;
  sunGroup.children[0].material.opacity = 1;
  const sunTargetScale = sceneTarget.sunVisible;
  sunGroup.scale.setScalar(THREE.MathUtils.lerp(sunGroup.scale.x, sunTargetScale, lerpSpeed));
  moonGroup.scale.setScalar(THREE.MathUtils.lerp(moonGroup.scale.x, sceneTarget.moonVisible, lerpSpeed));
  scene.fog.density += (sceneTarget.fogDensity - scene.fog.density) * lerpSpeed;
  scene.fog.color.lerp(sceneTarget.fogColor, lerpSpeed);

  clouds.forEach((c) => {
    const targetOp = c.userData.baseOpacity * sceneTarget.cloudOpacity;
    c.material.opacity += (targetOp - c.material.opacity) * lerpSpeed;
    c.position.x += c.userData.speed * dt * 2.2;
    if (c.position.x > 150) c.position.x = -150;
  });

  if (precipMode !== 'none') {
    const pos = precipGeo.attributes.position.array;
    for (let i = 0; i < precipCount; i++) {
      const idx = i * 3;
      if (precipMode === 'rain') {
        pos[idx + 1] -= precipVel[i] * dt * 60;
        pos[idx] += Math.sin(t + precipDrift[i]) * 0.02;
      } else {
        pos[idx + 1] -= precipVel[i] * dt * 12;
        pos[idx] += Math.sin(t * 0.6 + precipDrift[i]) * 0.05;
        pos[idx + 2] += Math.cos(t * 0.5 + precipDrift[i]) * 0.03;
      }
      if (pos[idx + 1] < -20) {
        pos[idx + 1] = 100 + Math.random() * 20;
        pos[idx] = (Math.random() - 0.5) * 180;
      }
    }
    precipGeo.attributes.position.needsUpdate = true;
    precipMat.size = precipMode === 'rain' ? 0.4 : 0.9;
  }

  if (stormActive && Math.random() < 0.006) {
    gsap.timeline()
      .to(el.lightningFlash, { opacity: 0.85, duration: 0.05 })
      .to(el.lightningFlash, { opacity: 0, duration: 0.15 })
      .to(el.lightningFlash, { opacity: 0.5, duration: 0.03, delay: 0.05 })
      .to(el.lightningFlash, { opacity: 0, duration: 0.25 });
  }

  camera.position.x += (mouseX * 12 - camera.position.x) * 0.02;
  camera.position.y += (-mouseY * 8 - camera.position.y) * 0.02;
  camera.lookAt(0, 8, -100);

  starMat.size = 1.4 + Math.sin(t * 2) * 0.2;
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ============================ WEATHER LOGIC ============================= */

function setStatus(msg, isError = false) {
  el.statusLine.textContent = msg;
  el.statusLine.classList.toggle('error', isError);
}

function displayTemp(celsiusValue) {
  if (unit === 'metric') return `${Math.round(celsiusValue)}<sup>°C</sup>`;
  return `${Math.round((celsiusValue * 9) / 5 + 32)}<sup>°F</sup>`;
}

function displayTempPlain(celsiusValue) {
  if (unit === 'metric') return `${Math.round(celsiusValue)}°`;
  return `${Math.round((celsiusValue * 9) / 5 + 32)}°`;
}

function windLabel(speedMs) {
  if (unit === 'metric') return `${Math.round(speedMs * 3.6)} km/h`;
  return `${Math.round(speedMs * 2.237)} mph`;
}

function formatHour(dt, tzOffsetSec) {
  const d = new Date((dt + tzOffsetSec) * 1000);
  let h = d.getUTCHours();
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}${suffix}`;
}

function formatDay(dt, tzOffsetSec) {
  const d = new Date((dt + tzOffsetSec) * 1000);
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function formatDate(dt, tzOffsetSec) {
  const d = new Date((dt + tzOffsetSec) * 1000);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatClock(dt, tzOffsetSec) {
  const d = new Date((dt + tzOffsetSec) * 1000);
  let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

function iconUrl(code) {
  return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

function renderCurrent(data) {
  const tzOffset = data.timezone;
  const isDay = data.dt >= data.sys.sunrise && data.dt < data.sys.sunset;

  el.placeName.textContent = `${data.name}${data.sys.country ? ', ' + data.sys.country : ''}`;
  el.placeDate.textContent = formatDate(data.dt, tzOffset);
  el.conditionDesc.textContent = data.weather[0].description;
  el.tempBig.innerHTML = displayTemp(data.main.temp);
  el.feelsLike.textContent = displayTempPlain(data.main.feels_like);
  el.tempHigh.textContent = displayTempPlain(data.main.temp_max);
  el.tempLow.textContent = displayTempPlain(data.main.temp_min);
  el.statHumidity.textContent = `${data.main.humidity}%`;
  el.statWind.textContent = windLabel(data.wind.speed);
  el.statPressure.textContent = `${data.main.pressure} hPa`;
  el.statSunset.textContent = formatClock(data.sys.sunset, tzOffset);
  el.weatherIcon.src = iconUrl(data.weather[0].icon);
  el.weatherIcon.style.display = 'block';

  applyWeatherToScene(data.weather[0].main, isDay);
}

function renderHourly(list, tzOffset) {
  el.hourlyScroll.innerHTML = '';
  list.slice(0, 8).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'hour-card';
    card.innerHTML = `
      <div class="h-time">${formatHour(item.dt, tzOffset)}</div>
      <img src="${iconUrl(item.weather[0].icon)}" alt="${item.weather[0].description}">
      <div class="h-temp">${displayTempPlain(item.main.temp)}</div>
    `;
    el.hourlyScroll.appendChild(card);
  });
}

function renderDaily(list, tzOffset) {
  const byDay = {};
  list.forEach((item) => {
    const dayKey = formatDay(item.dt, tzOffset) + '-' + Math.floor((item.dt + tzOffset) / 86400);
    if (!byDay[dayKey]) byDay[dayKey] = [];
    byDay[dayKey].push(item);
  });
  const days = Object.values(byDay).slice(0, 5);
  el.dailyList.innerHTML = '';
  days.forEach((entries) => {
    const temps = entries.map((e) => e.main.temp);
    const hi = Math.max(...temps);
    const lo = Math.min(...temps);
    const midday = entries.find((e) => new Date((e.dt + tzOffset) * 1000).getUTCHours() >= 12) || entries[Math.floor(entries.length / 2)];
    const row = document.createElement('div');
    row.className = 'day-row';
    row.innerHTML = `
      <div class="d-name">${formatDay(entries[0].dt, tzOffset)}</div>
      <img src="${iconUrl(midday.weather[0].icon)}" alt="">
      <div class="d-desc">${midday.weather[0].description}</div>
      <div class="d-range">${displayTempPlain(hi)} <span class="lo">${displayTempPlain(lo)}</span></div>
    `;
    el.dailyList.appendChild(row);
  });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function loadWeatherByQuery(query) {
  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === "YOUR_API_KEY_HERE") {
    setStatus('API key missing. Enter your key inside script.js.', true);
    el.panel.classList.add('ready');
    return;
  }

  setStatus('Fetching current conditions…');
  try {
    const isCoords = typeof query === 'object';
    const base = isCoords
      ? `lat=${query.lat}&lon=${query.lon}`
      : `q=${encodeURIComponent(query)}`;

    const current = await fetchJSON(`https://api.openweathermap.org/data/2.5/weather?${base}&units=metric&appid=${OPENWEATHER_API_KEY}`);
    lastWeatherData = current;
    renderCurrent(current);

    setStatus('Fetching forecast…');
    const forecast = await fetchJSON(`https://api.openweathermap.org/data/2.5/forecast?${base}&units=metric&appid=${OPENWEATHER_API_KEY}`);
    lastForecastData = forecast;
    renderHourly(forecast.list, current.timezone);
    renderDaily(forecast.list, current.timezone);

    setStatus(`Updated just now · ${unit === 'metric' ? 'Celsius' : 'Fahrenheit'}`);
    el.panel.classList.add('ready');
  } catch (err) {
    if (err.status === 401) {
      setStatus('Invalid API key. Please check your key in script.js.', true);
    } else if (err.status === 404) {
      setStatus(`Couldn't find "${query}". Try a different spelling.`, true);
    } else {
      setStatus('Something went wrong fetching weather. Try again.', true);
    }
    el.panel.classList.add('ready');
  }
}

/* ------------------------------ Controls -------------------------------- */

el.cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && el.cityInput.value.trim()) {
    loadWeatherByQuery(el.cityInput.value.trim());
    el.cityInput.blur();
  }
});

el.unitC.addEventListener('click', () => setUnit('metric'));
el.unitF.addEventListener('click', () => setUnit('imperial'));

function setUnit(u) {
  if (unit === u) return;
  unit = u;
  el.unitC.classList.toggle('active', u === 'metric');
  el.unitF.classList.toggle('active', u === 'imperial');
  if (lastWeatherData) renderCurrent(lastWeatherData);
  if (lastForecastData) {
    renderHourly(lastForecastData.list, lastWeatherData.timezone);
    renderDaily(lastForecastData.list, lastWeatherData.timezone);
  }
  setStatus(`Updated just now · ${unit === 'metric' ? 'Celsius' : 'Fahrenheit'}`);
}

el.locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    setStatus('Geolocation is not available in this browser.', true);
    return;
  }
  setStatus('Locating you…');
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeatherByQuery({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => {
      setStatus('Location access denied — defaulting to Pune.', true);
      loadWeatherByQuery('Pune');
    },
    { timeout: 8000 }
  );
});

/* ------------------------------ Bootstrap -------------------------------- */
(function init() {
  el.cityInput.value = '';
  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === "YOUR_API_KEY_HERE") {
    setStatus('Please add your OpenWeatherMap API key in script.js.', true);
    el.panel.classList.add('ready');
    return;
  }
  loadWeatherByQuery('Pune');
})();
