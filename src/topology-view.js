/* ================================================================
   NEOTOPIA v4.0 – Panel de Detalle de Topología

   Módulo que controla el overlay de pantalla completa que se abre
   al hacer clic en una tarjeta de topología. Contiene:
   - Control de apertura/cierre del panel
   - Renderizado dinámico del contenido HTML
   - Escena Three.js 3D integrada
   - Animación de barras de métricas
   - Navegación entre topologías con teclado y botones
================================================================ */

import { TOPOLOGIES } from './topology-data.js';
import { Topology3DScene } from './topology-3d.js';

// Estado del módulo (privado)
let _scene3D = null;  // instancia activa de la escena Three.js
let _idx     = 0;     // índice de la topología actualmente visible
let _open    = false; // si el panel está abierto o cerrado
let _lenis   = null;  // instancia de Lenis para pausar el scroll

// Recibe la instancia de Lenis desde main.js para poder pausarla
export function setLenis(l) { _lenis = l; }

// ── API pública ───────────────────────────────────────────────────

// Inicializa todos los event listeners del panel y las tarjetas
export function initView() {
  // Botones de la barra superior del panel
  document.getElementById('viewBack')?.addEventListener('click', closeView);
  document.getElementById('viewPrevTop')?.addEventListener('click', () => _navigate(-1));
  document.getElementById('viewNextTop')?.addEventListener('click', () => _navigate(1));

  // Navegación con teclado cuando el panel está abierto
  document.addEventListener('keydown', e => {
    if (!_open) return;
    if (e.key === 'Escape')     closeView();       // cerrar con ESC
    if (e.key === 'ArrowRight') _navigate(1);      // siguiente topología
    if (e.key === 'ArrowLeft')  _navigate(-1);     // topología anterior
  });

  // Clic en tarjeta: abrir el panel en la topología correspondiente
  document.querySelectorAll('.topo-card').forEach(card =>
    card.addEventListener('click', () => {
      const idx = TOPOLOGIES.findIndex(t => t.id === card.dataset.type);
      if (idx >= 0) _openAt(idx);
    })
  );
}

// Abre el panel buscando la topología por su ID (llamado desde otras secciones)
export function openViewById(id) {
  const idx = TOPOLOGIES.findIndex(t => t.id === id);
  if (idx >= 0) _openAt(idx);
}

// Cierra el panel, destruye la escena 3D, restaura el scroll y limpia el DOM
export function closeView() {
  _destroyScene();
  const view = document.getElementById('topoView');
  if (!view) return;
  view.classList.remove('open');
  view.setAttribute('aria-hidden', 'true');
  _open = false;
  document.body.style.overflow = '';  // restaurar scroll del body
  if (_lenis) _lenis.start();         // reanudar Lenis
  window.dispatchEvent(new CustomEvent('topo-view-close'));  // activar partículas
  // Limpiar el HTML interno tras la transición de salida (420 ms)
  setTimeout(() => {
    const inner = document.getElementById('viewInner');
    if (inner) inner.innerHTML = '';
  }, 420);
}

// ── Funciones internas ────────────────────────────────────────────

// Abre el panel en la topología del índice dado
function _openAt(idx) {
  _idx = idx;
  const view = document.getElementById('topoView');
  if (!view) return;
  _destroyScene();
  _render(idx);
  view.classList.add('open');
  view.setAttribute('aria-hidden', 'false');
  view.scrollTo({ top: 0, behavior: 'instant' }); // siempre empezar desde arriba
  document.body.style.overflow = 'hidden';         // bloquear scroll del fondo
  if (_lenis) _lenis.stop();                       // pausar Lenis mientras el panel está abierto
  window.dispatchEvent(new CustomEvent('topo-view-open'));  // pausar partículas
  _open = true;
  requestAnimationFrame(() => {
    _start3D(TOPOLOGIES[idx]);  // iniciar escena Three.js
    _animBars();                // animar barras de métricas
    _updateHint();              // actualizar texto de ayuda según el dispositivo
  });
}

// Actualiza el texto de instrucciones del canvas 3D según si es táctil o escritorio
function _updateHint() {
  const hint = document.querySelector('.view-3d-hint');
  if (!hint) return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  hint.innerHTML = isTouch
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
       Desliza para rotar · Pellizca para zoom · Toca nodos`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
       Arrastra para rotar · Scroll para zoom · Click en nodos`;
}

// Navega al siguiente (dir=1) o anterior (dir=-1) topología con transición
function _navigate(dir) {
  _destroyScene();
  _idx = (_idx + dir + TOPOLOGIES.length) % TOPOLOGIES.length;  // ciclo circular
  document.getElementById('topoView')?.scrollTo({ top: 0, behavior: 'instant' });
  _render(_idx);
  requestAnimationFrame(() => {
    _start3D(TOPOLOGIES[_idx]);
    _animBars();
    _updateHint();
  });
}

// Destruye la escena Three.js activa para liberar memoria GPU
function _destroyScene() {
  if (_scene3D) {
    _scene3D.destroy();
    _scene3D = null;
  }
}

// Crea una nueva escena Three.js en el canvas del panel
function _start3D(data) {
  const canvas = document.getElementById('view3DCanvas');
  if (!canvas) return;
  const colors = { primary: data.accentColor, secondary: data.accentColor2 };
  _scene3D = new Topology3DScene(canvas, data.miniType, colors, info => {
    // Callback al hacer clic/tap en un nodo: mostrar tooltip
    const tt = document.getElementById('node-tooltip');
    if (!tt || !info) return;
    tt.textContent = info;
    tt.style.opacity = '1';
  });
}

// Construye el HTML del panel y lo inyecta en el contenedor
function _render(idx) {
  const d       = TOPOLOGIES[idx];
  const title   = document.getElementById('viewTitle');
  const counter = document.getElementById('viewCounter');
  const glow    = document.getElementById('view3DGlow');
  const inner   = document.getElementById('viewInner');

  // Actualizar encabezado del panel
  if (title)   title.textContent = _fullNames[d.id] || d.id;
  if (counter) counter.textContent = `${idx + 1} / ${TOPOLOGIES.length}`;
  // Fondo de glow con el color de la topología activa
  if (glow)    glow.style.background =
    `radial-gradient(ellipse at 50% 100%, ${d.accentColor}28 0%, transparent 65%)`;

  if (!inner) return;
  inner.innerHTML = _buildHTML(d, idx);

  // Botones de navegación inferior (dentro del contenido generado)
  document.getElementById('viewPrev')?.addEventListener('click', () => _navigate(-1));
  document.getElementById('viewNext')?.addEventListener('click', () => _navigate(1));

  // Ocultar tooltip cuando el cursor sale del canvas 3D
  document.getElementById('view3DCanvas')?.addEventListener('mouseleave', () => {
    const tt = document.getElementById('node-tooltip');
    if (tt) tt.style.opacity = '0';
  });
}

// Anima las barras de métricas de 0% al porcentaje correspondiente
// con un retraso escalonado para efecto visual
function _animBars() {
  document.querySelectorAll('.vstat-bar').forEach((bar, i) => {
    const score = parseInt(bar.dataset.score) || 0;
    bar.style.width = '0%';
    setTimeout(() => {
      bar.style.transition = 'width 0.7s cubic-bezier(0.4,0,0.2,1)';
      bar.style.width = (score / 5 * 100) + '%';  // convertir escala 1-5 a porcentaje
    }, 50 + i * 70);  // retraso acumulado entre barras
  });
}

// ── Mapas de etiquetas ────────────────────────────────────────────

// Nombres cortos para la navegación inferior
const _names = {
  estrella: 'Estrella', bus: 'Bus', anillo: 'Anillo',
  arbol: 'Árbol', malla: 'Malla', hibrida: 'Híbrida',
};
// Nombres completos para el encabezado del panel
const _fullNames = {
  estrella: 'Topología Estrella', bus: 'Topología Bus', anillo: 'Topología Anillo',
  arbol: 'Topología Árbol', malla: 'Topología Malla', hibrida: 'Topología Híbrida',
};
// Colores y etiquetas para el estado de vigencia
const _statusMap = {
  vigente:      { l: 'VIGENTE',        c: '#00E5FF' },
  'legacy-lan': { l: 'LEGACY EN LAN',  c: '#FF7A00' },
  historico:    { l: 'HISTÓRICO',      c: '#888'    },
};
// Colores y etiquetas para el nivel de redundancia
const _redMap = {
  alta:     { l: 'ALTA',     c: '#00E5FF' },
  media:    { l: 'MEDIA',    c: '#FF7A00' },
  baja:     { l: 'BAJA',     c: '#FF5E5B' },
  nula:     { l: 'NULA',     c: '#FF5E5B' },
  variable: { l: 'VARIABLE', c: '#FF7A00' },
};

// ── Constructor de HTML del panel ─────────────────────────────────

// Genera el HTML completo del panel de detalle para la topología `d`
// con índice `idx`. Incluye: identidad, métricas, datos técnicos,
// ventajas/desventajas, estándares, aplicaciones y ejemplo real.
function _buildHTML(d, idx) {
  const c1 = d.accentColor, c2 = d.accentColor2;
  // Calcular topologías anterior y siguiente para la navegación
  const prev = TOPOLOGIES[(idx - 1 + TOPOLOGIES.length) % TOPOLOGIES.length];
  const next = TOPOLOGIES[(idx + 1) % TOPOLOGIES.length];
  const st   = _statusMap[d.status] || _statusMap.vigente;
  const red  = _redMap[d.redundancyLevel] || _redMap.media;
  const spofC = d.spof ? '#FF5E5B' : '#00E5FF';  // rojo = tiene SPOF; cian = no tiene SPOF
  const spofL = d.spof ? 'CON SPOF'  : 'SIN SPOF';

  // Nombres y notas de las métricas (en el mismo orden que stats)
  const sLabels = ['Costo', 'Escalabilidad', 'Rendimiento', 'T. Fallos', 'Facilidad'];
  const sKeys   = ['cost', 'scalability', 'performance', 'faultTolerance', 'ease'];
  const sNotes  = [
    '5 = muy económico', '5 = muy escalable', '5 = máximo rendimiento',
    '5 = máxima tolerancia', '5 = muy fácil',
  ];

  // Generar HTML de las barras de métricas
  const statsH = sKeys.map((k, i) => `
    <div class="vstat">
      <span class="vstat-lbl" title="${sNotes[i]}">${sLabels[i]}</span>
      <div class="vstat-track">
        <div class="vstat-bar" data-score="${d.stats[k]}"
          style="--bc:${i < 2 ? c2 : c1}"></div>
      </div>
      <span class="vstat-val">${d.stats[k]}/5</span>
    </div>`).join('');

  // Generar HTML de tarjetas de ventajas (con ícono de check)
  const proH = d.advantages.map(a => `
    <div class="v-pro-card">
      <div class="v-card-icon" style="color:${c1}">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
      </div>
      <div><strong>${a.title}</strong><p>${a.desc}</p></div>
    </div>`).join('');

  // Generar HTML de tarjetas de desventajas (con ícono de X)
  const conH = d.disadvantages.map(a => `
    <div class="v-con-card">
      <div class="v-card-icon v-con-ico">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
      </div>
      <div><strong>${a.title}</strong><p>${a.desc}</p></div>
    </div>`).join('');

  // Tags de aplicaciones y estándares
  const appH = d.applications.map(a =>
    `<span class="v-app-tag" style="border-color:${c1}55;color:${c1}">${a}</span>`
  ).join('');
  const stdH = d.standards.map(s =>
    `<span class="v-std-tag">${s}</span>`
  ).join('');

  // Puntos de navegación inferior (uno por topología, activo = el actual)
  const dotsH = TOPOLOGIES.map((_, i) =>
    `<span class="vnav-dot${i === idx ? ' active' : ''}"
      ${i === idx ? `style="background:${c1};box-shadow:0 0 6px ${c1}"` : ''}></span>`
  ).join('');

  return `
<div class="view-identity" style="--c1:${c1};--c2:${c2}">
  <div class="v-badges">
    <span class="v-badge" style="color:${c1};border-color:${c1}55">${d.num}</span>
    <span class="v-badge" style="color:${st.c};border-color:${st.c}55;background:${st.c}14">${st.l}</span>
    <span class="v-badge" style="color:${spofC};border-color:${spofC}55;background:${spofC}14">${spofL}</span>
  </div>
  <h2 class="view-name" style="background:linear-gradient(90deg,${c1},${c2});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${_fullNames[d.id]}</h2>
  <p class="view-tagline">${d.tagline}</p>
</div>

<div class="view-body">
  <aside class="view-aside">
    <!-- Panel lateral: métricas numéricas -->
    <div class="v-card">
      <h3 class="v-card-title">Métricas</h3>
      <p class="v-stats-note">5 = mejor en cada categoría</p>
      <div class="v-stats-list">${statsH}</div>
    </div>
    <!-- Panel lateral: datos técnicos rápidos -->
    <div class="v-card v-qfacts-card">
      <!-- SPOF -->
      <div class="v-qfact" style="--qc:${spofC}">
        <div class="v-qfact-head">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>SPOF
        </div>
        <p class="v-qfact-val" style="color:${spofC}">${spofL}</p>
        <p class="v-qfact-desc">${d.spofDesc}</p>
      </div>
      <!-- Redundancia -->
      <div class="v-qfact" style="--qc:${red.c}">
        <div class="v-qfact-head">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          </svg>REDUNDANCIA
        </div>
        <p class="v-qfact-val" style="color:${red.c}">${red.l}</p>
        <p class="v-qfact-desc">${d.redundancyNote}</p>
      </div>
      <!-- Cableado -->
      <div class="v-qfact" style="--qc:${c2}">
        <div class="v-qfact-head">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="9" x2="20" y2="9"/>
            <line x1="4" y1="15" x2="20" y2="15"/>
            <line x1="10" y1="3" x2="8" y2="21"/>
            <line x1="16" y1="3" x2="14" y2="21"/>
          </svg>CABLEADO
        </div>
        <p class="v-qfact-val" style="color:${c2}">${d.cableFormula}</p>
        <p class="v-qfact-desc">${d.cableNote}</p>
      </div>
      <!-- Tipo de fallo -->
      <div class="v-qfact" style="--qc:${c1}">
        <div class="v-qfact-head">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>TIPO DE FALLO
        </div>
        <p class="v-qfact-val" style="color:${c1}">${d.failureType.toUpperCase()}</p>
        <p class="v-qfact-desc">${d.failureNote}</p>
      </div>
    </div>
  </aside>

  <!-- Contenido principal: texto académico y ventajas/desventajas -->
  <div class="view-text">
    <div class="v-section">
      <h3 class="v-sec-title" style="--mc:${c1}">Definición</h3>
      <p class="v-sec-p">${d.definition}</p>
    </div>
    <div class="v-section">
      <h3 class="v-sec-title" style="--mc:${c2}">Estructura</h3>
      <p class="v-sec-p">${d.structure}</p>
    </div>
    <div class="v-section">
      <h3 class="v-sec-title" style="--mc:${c1}">Funcionamiento</h3>
      <p class="v-sec-p">${d.howItWorks}</p>
    </div>
    <div class="v-section">
      <div class="v-two-col">
        <div>
          <h3 class="v-sec-title" style="--mc:${c1}">Ventajas</h3>
          <div class="v-pro-list">${proH}</div>
        </div>
        <div>
          <h3 class="v-sec-title" style="--mc:#FF5E5B">Desventajas</h3>
          <div class="v-con-list">${conH}</div>
        </div>
      </div>
    </div>
    <div class="v-section">
      <h3 class="v-sec-title" style="--mc:${c2}">Estándares y Protocolos</h3>
      <div class="v-std-tags">${stdH}</div>
    </div>
    <div class="v-section">
      <h3 class="v-sec-title" style="--mc:${c2}">Aplicaciones</h3>
      <div class="v-app-tags">${appH}</div>
    </div>
    <div class="v-section v-example-box" style="border-color:${c1}33;background:${c1}08">
      <div class="v-ex-label" style="color:${c1}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Ejemplo Real
      </div>
      <p class="v-sec-p">${d.realExample}</p>
    </div>
  </div>
</div>

<!-- Navegación inferior: botón anterior, puntos de progreso, botón siguiente -->
<div class="view-bottom-nav">
  <button class="vbnav-btn" id="viewPrev">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    <span>${_names[prev.id]}</span>
  </button>
  <div class="vbnav-dots">${dotsH}</div>
  <button class="vbnav-btn" id="viewNext">
    <span>${_names[next.id]}</span>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  </button>
</div>`;
}
