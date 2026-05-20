/* ================================================================
   NEOTOPIA v4.0 – Punto de Entrada Principal

   Este archivo es el núcleo de la aplicación. Coordina todos los
   módulos: sistema de partículas del fondo, esfera 3D del hero,
   barra de navegación, animaciones con scroll y los mini-canvas
   de cada tarjeta de topología.

   Módulos importados:
   - gsap/ScrollTrigger : animaciones basadas en scroll
   - topology-view      : panel de detalle de cada topología
   - topology-data      : datos y función de dibujo en canvas 2D
   - topology-3d        : escenas Three.js
================================================================ */

import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initView, openViewById, setLenis } from './topology-view.js';
import { TOPOLOGIES, drawTopologyOnCanvas, hexToRgbStr } from './topology-data.js';
import { Topology3DScene } from './topology-3d.js';

// Registrar el plugin ScrollTrigger para usar animaciones por scroll
gsap.registerPlugin(ScrollTrigger);

// ================================================================
//  SCROLL SUAVE – LENIS
//  Lenis proporciona scroll fluido en escritorio.
//  En móviles táctiles se omite porque el scroll nativo ya es suave
//  y Lenis interferiría con los gestos del navegador.
// ================================================================
let _lenisInstance = null;

// Desplaza el viewport hasta el elemento `el`, usando Lenis si está
// disponible o scroll nativo como respaldo. Resta 72 px para la navbar.
function scrollToEl(el) {
  if (!el) return;
  if (_lenisInstance) {
    _lenisInstance.scrollTo(el, { offset: -72, duration: 1.0 });
  } else {
    el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -72);
  }
}

async function initLenis() {
  // Lenis v1.x registra touchmove/touchend con { passive: false }, lo que
  // genera la advertencia "Ignored attempt to cancel a touchmove event".
  // En dispositivos táctiles el scroll nativo ya es suave, así que se omite.
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) return null;

  try {
    const { default: Lenis } = await import('@studio-freight/lenis');
    const lenis = new Lenis({
      duration:        1.1,                                          // duración del scroll en segundos
      easing:          t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // curva de suavizado exponencial
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      smoothTouch:     false, // desactivado para no competir con gestos nativos
    });
    // Sincronizar Lenis con GSAP para que ScrollTrigger reciba las posiciones correctas
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    _lenisInstance = lenis;
    return lenis;
  } catch (err) {
    console.warn('[Lenis] no se pudo inicializar, usando scroll nativo:', err);
    return null;
  }
}

// ================================================================
//  SISTEMA DE PARTÍCULAS – física de muelles interactiva
//
//  Cada partícula tiene una posición "origen" a la que regresa
//  constantemente (muelle). El cursor del ratón/toque genera una
//  fuerza de repulsión cuadrática. Las partículas cercanas entre sí
//  se conectan con líneas semitransparentes; al pasar el cursor
//  cerca, esas líneas se iluminan en verde neón.
// ================================================================
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.W = 0; this.H = 0;

    // Cursor fuera de pantalla por defecto: el muelle es la única fuerza activa en reposo
    this.mouse  = { x: -9999, y: -9999, radius: 185 };
    this.particles = [];

    // Ajustar cantidad de partículas y distancia de conexión según resolución de pantalla
    const w = window.innerWidth;
    this.COUNT    = w < 480 ? 65 : w < 768 ? 115 : 300;
    this.MAX_DIST = w < 480 ? 75 : w < 768 ? 95  : 120;

    // Paleta de colores de las partículas (cian, azul, verde neón)
    this.COLORS   = ['#94fc17', '#00E5FF', '#3B82F6', '#00bcd4', '#00E5FF', '#94fc17'];
    this.raf        = null;
    this._destroyed = false;
    this._paused    = false;

    this._resize();
    this._init();

    // Listener de redimensionado de ventana
    window.addEventListener('resize', () => this._resize(), { passive: true });

    // Seguimiento del ratón en escritorio
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    }, { passive: true });
    window.addEventListener('mouseleave', () => {
      // Al salir del viewport, alejar el cursor para que no haya repulsión residual
      this.mouse.x = -9999; this.mouse.y = -9999;
    });
    window.addEventListener('click', (e) => this._onClick(e));

    // Seguimiento táctil — se escucha en window porque el canvas tiene pointer-events:none
    window.addEventListener('touchmove', (e) => {
      if (this._paused) return;
      const t = e.touches[0];
      if (t) { this.mouse.x = t.clientX; this.mouse.y = t.clientY; }
    }, { passive: true });
    window.addEventListener('touchend', () => {
      this.mouse.x = -9999; this.mouse.y = -9999;
    }, { passive: true });
    window.addEventListener('touchstart', (e) => {
      if (this._paused) return;
      const t = e.touches[0];
      if (t) this._onClick({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });

    // Pausar las partículas al abrir el panel de detalle y reanudar al cerrar
    window.addEventListener('topo-view-open',  () => this.pause(),  { passive: true });
    window.addEventListener('topo-view-close', () => this.resume(), { passive: true });

    this._animate();
  }

  // Detiene el bucle de animación sin destruir el sistema
  pause()  { this._paused = true; }

  // Reactiva el bucle de animación si no estaba corriendo
  resume() {
    this._paused = false;
    if (!this.raf && !this._destroyed) this._animate();
  }

  // Ajusta el tamaño del canvas y escala las posiciones de las partículas
  // proporcionalmente para que no se "desordenen" al redimensionar
  _resize() {
    const newW = window.innerWidth;
    const newH = window.innerHeight;
    if (this.particles.length && this.W > 0) {
      const sx = newW / this.W, sy = newH / this.H;
      this.particles.forEach(p => {
        p.x       *= sx; p.y       *= sy;
        p.originX *= sx; p.originY *= sy;
      });
    }
    this.W = this.canvas.width  = newW;
    this.H = this.canvas.height = newH;
  }

  // Crea una partícula con posición aleatoria (o en coordenadas dadas)
  // y propiedades físicas aleatorias (velocidad, tamaño, fase de pulso)
  _mkParticle(x, y) {
    const col = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];
    const ox = x ?? Math.random() * this.W;
    const oy = y ?? Math.random() * this.H;
    return {
      x: ox, y: oy,
      originX: ox, originY: oy,  // posición de equilibrio — el muelle atrae aquí
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      sz: Math.random() * 2.3 + 0.6,        // radio entre 0.6 y 2.9 px
      col,
      al: Math.random() * 0.5 + 0.35,       // opacidad base entre 0.35 y 0.85
      pulsePhase: Math.random() * Math.PI * 2,
    };
  }

  // Inicializa el arreglo de partículas
  _init() {
    for (let i = 0; i < this.COUNT; i++) this.particles.push(this._mkParticle());
  }

  // Al hacer clic/tap, se crean 8 partículas nuevas que explotan desde ese punto
  _onClick(e) {
    for (let i = 0; i < 8; i++) {
      const p = this._mkParticle(
        e.clientX + (Math.random() - 0.5) * 24,
        e.clientY + (Math.random() - 0.5) * 24,
      );
      // velocidad inicial de explosión radial
      p.vx = (Math.random() - 0.5) * 4.5;
      p.vy = (Math.random() - 0.5) * 4.5;
      this.particles.push(p);
    }
    // Evitar crecimiento ilimitado del arreglo: eliminar las más antiguas
    if (this.particles.length > this.COUNT + 55) this.particles.splice(0, 8);
  }

  // Bucle principal de animación a ~60 fps
  _animate() {
    if (this._destroyed) return;
    if (this._paused) { this.raf = null; return; }
    this.raf = requestAnimationFrame(() => this._animate());

    const ctx = this.ctx;
    const { W, H, mouse, particles, MAX_DIST } = this;
    ctx.clearRect(0, 0, W, H);

    // ── Constantes de física ──────────────────────────────────────
    const SPRING   = 0.033;  // rigidez del muelle: qué tan rápido vuelve la partícula a su origen
    const FRICTION  = 0.875; // amortiguación de velocidad por frame (multiplica la velocidad)
    const REPULSE   = 10;    // multiplicador de la fuerza de repulsión del cursor
    const MAX_SPD   = 12;    // velocidad máxima por frame (tope de seguridad)
    const mr2 = mouse.radius * mouse.radius; // radio² del cursor, reutilizado en dos bucles

    // ── Actualizar física de cada partícula ───────────────────────
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Fuerza de muelle hacia el origen (siempre activa)
      p.vx += (p.originX - p.x) * SPRING;
      p.vy += (p.originY - p.y) * SPRING;

      // Repulsión del cursor — caída cuadrática para sensación natural
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < mr2 && d2 > 0.01) {
        const d  = Math.sqrt(d2);
        const t  = 1 - d / mouse.radius;   // factor 0→1 (1 = justo debajo del cursor)
        p.vx += (dx / d) * t * t * REPULSE;
        p.vy += (dy / d) * t * t * REPULSE;
      }

      // Aplicar fricción y limitar velocidad máxima
      p.vx *= FRICTION; p.vy *= FRICTION;
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > MAX_SPD) { p.vx = (p.vx / spd) * MAX_SPD; p.vy = (p.vy / spd) * MAX_SPD; }

      // Mover la partícula
      p.x += p.vx; p.y += p.vy;

      // Rebote suave en los bordes del canvas (no teletransporte circular)
      if (p.x < 0)  { p.x = 0;  p.vx =  Math.abs(p.vx) * 0.4; }
      if (p.x > W)  { p.x = W;  p.vx = -Math.abs(p.vx) * 0.4; }
      if (p.y < 0)  { p.y = 0;  p.vy =  Math.abs(p.vy) * 0.4; }
      if (p.y > H)  { p.y = H;  p.vy = -Math.abs(p.vy) * 0.4; }

      // Avanzar la fase del pulso (oscilación suave de tamaño)
      p.pulsePhase += 0.018;
    }

    // ── Dibujar conexiones entre partículas cercanas ──────────────
    // Las líneas se iluminan en verde neón cuando el cursor pasa cerca
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const ddx = a.x - b.x, ddy = a.y - b.y;
        const d2  = ddx * ddx + ddy * ddy;
        if (d2 < MAX_DIST * MAX_DIST) {
          const d      = Math.sqrt(d2);
          const baseAl = (1 - d / MAX_DIST) * 0.16;  // opacidad proporcional a la proximidad
          // Verificar si el punto medio de la conexión está cerca del cursor
          const cmx = (a.x + b.x) * 0.5, cmy = (a.y + b.y) * 0.5;
          const mdx = cmx - mouse.x,     mdy = cmy - mouse.y;
          const nearMouse = (mdx * mdx + mdy * mdy) < mr2 * 0.45;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          if (nearMouse) {
            // Línea iluminada en verde neón al acercarse el cursor
            ctx.strokeStyle = `rgba(148,252,23,${Math.min(0.55, baseAl * 3.5).toFixed(3)})`;
            ctx.lineWidth   = 1.1;
          } else {
            // Línea tenue en cian por defecto
            ctx.strokeStyle = `rgba(0,229,255,${baseAl.toFixed(3)})`;
            ctx.lineWidth   = 0.55;
          }
          ctx.stroke();
        }
      }
    }

    // ── Dibujar cada partícula con pulso y brillo dinámico ────────
    ctx.save();
    for (const p of particles) {
      const pulse    = 0.88 + 0.12 * Math.sin(p.pulsePhase);  // factor de tamaño oscilante
      const mdx      = p.x - mouse.x, mdy = p.y - mouse.y;
      const prox     = Math.max(0, 1 - Math.sqrt(mdx * mdx + mdy * mdy) / mouse.radius);
      const energized = 1 + prox * 0.95;  // multiplicador de tamaño/brillo cerca del cursor

      ctx.globalAlpha = Math.min(0.92, p.al * pulse * energized);
      ctx.shadowBlur  = p.sz * (4 + prox * 12);
      // Color verde neón cuando el cursor está cerca; color base en caso contrario
      ctx.shadowColor = prox > 0.22 ? '#94fc17' : p.col;
      ctx.fillStyle   = prox > 0.22 ? '#94fc17' : p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sz * pulse * energized, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Cancela el bucle de animación y libera recursos
  destroy() {
    this._destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

// ================================================================
//  BARRA DE NAVEGACIÓN
//  - Añade la clase "scrolled" cuando el usuario baja más de 40 px
//  - Menú hamburguesa para móviles con atributos ARIA
//  - Botones CTA que desplazan hasta secciones específicas
// ================================================================
function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const menu      = document.getElementById('navMenu');

  // Cambiar estilo de la navbar al hacer scroll (para el efecto glassmorphism)
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        navbar?.classList.toggle('scrolled', window.scrollY > 40);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // Abrir/cerrar menú hamburguesa en móvil
  hamburger?.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    hamburger.classList.toggle('active', open);
    hamburger.setAttribute('aria-expanded', String(open));
  });

  // Al hacer clic en un enlace del menú: cerrar menú y navegar con Lenis
  menu?.querySelectorAll('.nav-link').forEach(link =>
    link.addEventListener('click', (e) => {
      menu.classList.remove('open');
      hamburger?.classList.remove('active');
      hamburger?.setAttribute('aria-expanded', 'false');
      // Interceptar el hash para que Lenis maneje el scroll (no el nativo)
      const href = link.getAttribute('href');
      if (href?.startsWith('#') && _lenisInstance) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) scrollToEl(target);
      }
    })
  );

  // Botones CTA de navegación rápida a secciones
  document.getElementById('navCta')?.addEventListener('click', () =>
    scrollToEl(document.getElementById('topologies'))
  );
  document.getElementById('btnExplore')?.addEventListener('click', () =>
    scrollToEl(document.getElementById('topologies'))
  );
  document.getElementById('btnCompare')?.addEventListener('click', () =>
    scrollToEl(document.getElementById('comparative'))
  );
  document.getElementById('btnCtaExplore')?.addEventListener('click', () =>
    scrollToEl(document.getElementById('topologies'))
  );
  // Logo: volver al inicio de la página
  document.getElementById('navLogo')?.addEventListener('click', () => {
    if (_lenisInstance) _lenisInstance.scrollTo(0, { duration: 1.0 });
    else window.scrollTo({ top: 0 });
  });
}

// ================================================================
//  ESFERA 3D DEL HERO (Three.js)
//  Crea la esfera decorativa de red en el hero de la página.
//  Se importa topology-3d.js de forma dinámica para no bloquear
//  la carga inicial.
// ================================================================
let _heroScene = null;
function initHero3D() {
  const canvas = document.getElementById('heroCanvas3D');
  if (!canvas) return;
  try {
    const { Topology3DScene } = window.__topo3d__ || {};
    _heroScene = Topology3DScene.createHeroSphere(canvas);
  } catch (e) {
    // Respaldo: importar el módulo directamente si no está precargado
    import('./topology-3d.js').then(({ Topology3DScene }) => {
      _heroScene = Topology3DScene.createHeroSphere(canvas);
    }).catch(() => {});
  }
}

// ================================================================
//  CANVAS DE INTRODUCCIÓN (sección intro)
//  Dibuja una red de nodos animada con paquetes de datos circulando
//  por los enlaces. Topología de estrella con 6 nodos periféricos.
// ================================================================
function initIntroCanvas() {
  const canvas = document.getElementById('introCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let t = 0;

  // Posiciones de los nodos: centro + 6 periféricos
  const nodes = [
    { x: W*0.5, y: H*0.5 },                                       // nodo central
    { x: W*0.2, y: H*0.25 }, { x: W*0.5, y: H*0.15 }, { x: W*0.8, y: H*0.25 },
    { x: W*0.2, y: H*0.75 }, { x: W*0.5, y: H*0.85 }, { x: W*0.8, y: H*0.75 },
  ];
  // Conexiones: [índice nodo A, índice nodo B]
  const edges = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,2],[3,6],[4,5]];

  (function frame() {
    ctx.clearRect(0, 0, W, H);
    t += 0.4;
    // Dibujar enlace y paquete viajando sobre él
    edges.forEach(([a, b], i) => {
      const na = nodes[a], nb = nodes[b];
      ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
      ctx.strokeStyle = 'rgba(0,229,255,0.16)'; ctx.lineWidth = 1.2; ctx.stroke();
      // Paquete: posición 0→1 con desfase por índice de enlace
      const p = (t * 0.006 + i * 0.14) % 1;
      const px = na.x + (nb.x - na.x) * p, py = na.y + (nb.y - na.y) * p;
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#00E5FF'; ctx.shadowBlur = 7; ctx.shadowColor = '#00E5FF';
      ctx.fill(); ctx.shadowBlur = 0;
    });
    // Dibujar nodos (el central es más grande y de color azul)
    nodes.forEach((nd, i) => {
      const r   = i === 0 ? 9 : 5.5;
      const col = i === 0 ? '#3B82F6' : '#00E5FF';
      ctx.beginPath(); ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.shadowBlur = r * 2; ctx.shadowColor = col;
      ctx.fill(); ctx.shadowBlur = 0;
    });
    requestAnimationFrame(frame);
  })();
}

// ================================================================
//  CANVAS DE REDUNDANCIA (sección comparativa Estrella vs Malla)
//  Muestra en tiempo real la diferencia de tolerancia a fallos:
//  - Estrella (izquierda): al fallar el centro, toda la red cae
//  - Malla (derecha): al fallar un nodo, la red continúa operando
//  El fallo se alterna cada 180 frames (~3 segundos a 60 fps)
// ================================================================
function initRedundancyCanvas() {
  const canvas = document.getElementById('redundancyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let t = 0, failTimer = 0, starFail = false;

  (function frame() {
    ctx.clearRect(0, 0, W, H);
    t += 0.5;
    failTimer++;
    // Alternar el estado de fallo cada 3 segundos aproximadamente
    if (failTimer > 180) { starFail = !starFail; failTimer = 0; }
    const half = W / 2;

    // ── TOPOLOGÍA ESTRELLA (mitad izquierda) ─────────────────────
    const sc = { x: half * 0.46, y: H * 0.46 };
    // Calcular posiciones de 5 nodos periféricos en círculo
    const sNodes = Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return { x: sc.x + 60 * Math.cos(a), y: sc.y + 60 * Math.sin(a) };
    });
    sNodes.forEach((nd, i) => {
      ctx.beginPath(); ctx.moveTo(sc.x, sc.y); ctx.lineTo(nd.x, nd.y);
      // Rojo en fallo, rosa en funcionamiento
      ctx.strokeStyle = starFail ? 'rgba(255,94,91,0.28)' : 'rgba(255,77,141,0.28)';
      ctx.lineWidth = 1.2; ctx.stroke();
      // Solo mostrar paquetes cuando la red funciona
      if (!starFail) {
        const p = (t * 0.007 + i * 0.2) % 1;
        const px = sc.x + (nd.x-sc.x)*p, py = sc.y + (nd.y-sc.y)*p;
        ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI*2);
        ctx.fillStyle = '#FF7A00'; ctx.shadowBlur = 7; ctx.shadowColor = '#FF7A00';
        ctx.fill(); ctx.shadowBlur = 0;
      }
      const col = starFail ? '#FF5E5B' : '#FF4D8D';
      ctx.beginPath(); ctx.arc(nd.x, nd.y, 5.5, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.shadowBlur = 8; ctx.shadowColor = col; ctx.fill(); ctx.shadowBlur = 0;
    });
    // Nodo central: rojo si falla, naranja si funciona
    ctx.beginPath(); ctx.arc(sc.x, sc.y, 9, 0, Math.PI*2);
    const cCol = starFail ? '#FF5E5B' : '#FF7A00';
    ctx.fillStyle = cCol; ctx.shadowBlur = 14; ctx.shadowColor = cCol; ctx.fill(); ctx.shadowBlur = 0;
    // Etiquetas descriptivas debajo de la topología
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = starFail ? '#FF5E5B' : 'rgba(255,77,141,0.75)';
    ctx.fillText('ESTRELLA', sc.x, H * 0.9);
    ctx.fillStyle = starFail ? '#FF5E5B' : 'rgba(255,255,255,0.38)';
    ctx.fillText(starFail ? 'FALLO TOTAL' : 'SPOF: centro', sc.x, H * 0.96);

    // Línea divisoria central
    ctx.beginPath(); ctx.moveTo(half, H*0.06); ctx.lineTo(half, H*0.96);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();

    // ── TOPOLOGÍA MALLA (mitad derecha) ──────────────────────────
    const mc = { x: half + half * 0.54, y: H * 0.46 };
    const mNodes = Array.from({ length: 5 }, (_, i) => ({
      x: mc.x + 60 * Math.cos((i/5)*Math.PI*2 - Math.PI/2),
      y: mc.y + 60 * Math.sin((i/5)*Math.PI*2 - Math.PI/2),
      failed: starFail && i === 2,  // solo falla el nodo 2 cuando starFail=true
    }));
    // Dibujar todas las conexiones posibles (malla completa)
    for (let i = 0; i < mNodes.length; i++) {
      for (let j = i+1; j < mNodes.length; j++) {
        const a = mNodes[i], b = mNodes[j], lf = a.failed || b.failed;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = lf ? 'rgba(255,94,91,0.12)' : 'rgba(0,229,255,0.22)';
        ctx.lineWidth = 1; ctx.stroke();
        // Paquetes solo en enlaces activos
        if (!lf) {
          const p = (t * 0.005 + i*0.12 + j*0.09) % 1;
          ctx.beginPath(); ctx.arc(a.x+(b.x-a.x)*p, a.y+(b.y-a.y)*p, 2.5, 0, Math.PI*2);
          ctx.fillStyle = '#00E5FF'; ctx.shadowBlur = 6; ctx.shadowColor = '#00E5FF';
          ctx.fill(); ctx.shadowBlur = 0;
        }
      }
    }
    // Nodos: rojo si fallado, cian si activo
    mNodes.forEach(nd => {
      const col = nd.failed ? '#FF5E5B' : '#00E5FF';
      ctx.beginPath(); ctx.arc(nd.x, nd.y, 6, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.shadowBlur = 10; ctx.shadowColor = col; ctx.fill(); ctx.shadowBlur = 0;
    });
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,229,255,0.75)';
    ctx.fillText('MALLA', mc.x, H * 0.9);
    // La red continúa aunque un nodo falle (redundancia total)
    ctx.fillStyle = 'rgba(148,252,23,0.65)';
    ctx.fillText(starFail ? 'RED CONTINUA' : 'SIN SPOF', mc.x, H * 0.96);

    requestAnimationFrame(frame);
  })();
}

// ================================================================
//  MINI CANVAS DE TARJETAS DE TOPOLOGÍA
//  Cada tarjeta en la grilla tiene un pequeño canvas que muestra
//  la topología animada correspondiente (estrella, bus, anillo, etc.)
//  usando la función drawTopologyOnCanvas de topology-data.js
// ================================================================
function initMiniCanvases() {
  document.querySelectorAll('.mini-canvas').forEach(canvas => {
    const topo = canvas.dataset.topo; // tipo leído del atributo data-topo del HTML
    const ctx  = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let t = Math.random() * 1000; // desfase inicial aleatorio para que no se vean sincronizadas
    (function loop() {
      ctx.clearRect(0, 0, W, H);
      drawTopologyOnCanvas(ctx, W, H, topo, t);
      t += 0.55;
      requestAnimationFrame(loop);
    })();
  });
}

// ================================================================
//  EFECTO TILT EN TARJETAS AL HOVER
//  Al mover el ratón sobre una tarjeta, se aplica una rotación 3D
//  perspectiva proporcional a la posición del cursor dentro de la tarjeta.
// ================================================================
function initCardHover() {
  document.querySelectorAll('.topo-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - 0.5;  // -0.5 a 0.5
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translateY(-6px) scale(1.02)`;
    }, { passive: true });
    // Restaurar al salir
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    // Accesibilidad: activar con teclado
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });
}

// ================================================================
//  APERTURA DEL PANEL DE DETALLE DESDE LAS TARJETAS
//  Al hacer clic en cualquier tarjeta de topología, se busca
//  el ID correspondiente en el arreglo TOPOLOGIES y se abre
//  el panel overlay con el detalle completo.
// ================================================================
function initTopoCards() {
  document.querySelectorAll('.topo-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = TOPOLOGIES.findIndex(t => t.id === card.dataset.type);
      if (idx >= 0) openViewById(TOPOLOGIES[idx].id);
    });
  });
}

// ================================================================
//  TARJETAS DE RECOMENDACIÓN (sección "¿Cuál usar?")
//  Cada tarjeta tiene un botón para abrir el detalle de la topología
//  recomendada y un botón para mostrar/ocultar el razonamiento.
// ================================================================
function initChooserCards() {
  document.querySelectorAll('.chooser-card[data-open]').forEach(card => {
    // Botón "Ver detalle": abre el panel overlay de la topología
    card.querySelector('.chooser-view-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      openViewById(card.dataset.open);
    });
    // Botón "Ver razonamiento": despliega/colapsa la explicación
    card.querySelector('.chooser-toggle')?.addEventListener('click', e => {
      e.stopPropagation();
      const body = card.querySelector('.chooser-body');
      const open = body.classList.toggle('open');
      e.currentTarget.textContent = open ? 'Ocultar razonamiento' : 'Ver razonamiento';
    });
  });
}

// ================================================================
//  TABLA COMPARATIVA DE TOPOLOGÍAS
//  Genera dinámicamente las filas de la tabla con puntuaciones
//  (puntos de colores) y tooltips descriptivos para cada métrica.
//  Las filas son clickeables para abrir el panel de detalle.
// ================================================================
// Textos descriptivos para cada valor de puntuación (1-5) por categoría
const STAT_NOTES = {
  cost:           ['Muy costosa','Costosa','Costo moderado','Economica','Muy economica'],
  scalability:    ['Muy dificil de escalar','Escalabilidad limitada','Escalabilidad moderada','Escala bien','Escalabilidad excelente'],
  performance:    ['Rendimiento muy bajo','Rendimiento bajo','Rendimiento moderado','Alto rendimiento','Rendimiento maximo'],
  faultTolerance: ['Sin tolerancia','Tolerancia muy baja','Tolerancia moderada','Alta tolerancia','Tolerancia maxima'],
  ease:           ['Muy compleja','Compleja','Complejidad moderada','Facil','Muy facil'],
};

// Genera el HTML de 5 puntos para una puntuación (i < score → encendido)
function _dots(score, color) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="score-dot${i < score ? ' on' : ''}" ${i < score ? `style="background:${color};box-shadow:0 0 5px ${color}88"` : ''}></span>`
  ).join('');
}

function initComparativeTable() {
  const tbody = document.getElementById('compareBody');
  if (!tbody) return;
  const keys  = ['cost','scalability','performance','faultTolerance','ease'];
  const names = { estrella:'Estrella', bus:'Bus', anillo:'Anillo', arbol:'Arbol', malla:'Malla', hibrida:'Hibrida' };

  TOPOLOGIES.forEach(t => {
    const tr = document.createElement('tr');
    tr.dataset.type = t.id;

    // Badges de SPOF y nivel de redundancia
    const spofHtml = t.spof
      ? `<span class="tbl-spof yes">SPOF</span>`
      : `<span class="tbl-spof no">Sin SPOF</span>`;
    const redColor = { alta:'#00E5FF', media:'#FF7A00', baja:'#FF5E5B', nula:'#FF5E5B', variable:'#FF7A00' }[t.redundancyLevel];
    const redLabel = { alta:'Alta', media:'Media', baja:'Baja', nula:'Nula', variable:'Var.' }[t.redundancyLevel];

    // Primera celda: nombre + punto de color + badges
    const nameTd = document.createElement('td');
    nameTd.className = 'col-topo';
    nameTd.innerHTML = `
      <div class="topo-name-cell">
        <span class="topo-dot" style="background:${t.accentColor};box-shadow:0 0 8px ${t.accentColor}"></span>
        <div>
          <span class="topo-cell-name">${names[t.id] || t.id}</span>
          <div class="topo-cell-meta">${spofHtml}<span class="tbl-red" style="color:${redColor}">${redLabel}</span></div>
        </div>
      </div>`;
    tr.appendChild(nameTd);

    // Celdas de puntuación con tooltip descriptivo
    keys.forEach(key => {
      const td = document.createElement('td');
      td.className   = 'score-cell';
      td.dataset.tooltip = STAT_NOTES[key][t.stats[key] - 1] || '';
      td.innerHTML   = `<div class="score-dots">${_dots(t.stats[key], t.accentColor)}</div>`;
      tr.appendChild(td);
    });

    // Clic en la fila: abrir panel de detalle de esa topología
    tr.addEventListener('click', () => openViewById(t.id));
    tbody.appendChild(tr);
  });
}

// ================================================================
//  ANIMACIONES DE SCROLL CON GSAP
//  Cada sección tiene su propia animación de entrada disparada por
//  ScrollTrigger cuando el elemento entra en el viewport.
// ================================================================
function initScrollAnimations() {
  const ease = 'power3.out';

  // Animación de entrada del hero (se ejecuta al cargar la página)
  gsap.timeline({ defaults: { ease, duration: 0.75 }, delay: 0.1 })
    .from('.hero-label',    { y: 18, opacity: 0, duration: 0.55 })
    .from('.hero-title',    { y: 34, opacity: 0 }, '-=0.3')
    .from('.hero-sub',      { y: 20, opacity: 0 }, '-=0.38')
    .from('.hero-actions',  { y: 16, opacity: 0, duration: 0.6 }, '-=0.38')
    .from('.hero-features', { y: 14, opacity: 0, duration: 0.55 }, '-=0.35')
    .from('.hero-3d-wrap',  { x: 40, opacity: 0, duration: 0.9 }, '-=0.8')
    .from('.float-card',    { opacity: 0, scale: 0.8, stagger: 0.1, duration: 0.4 }, '-=0.4')
    .from('.scroll-indicator', { opacity: 0, y: 10, duration: 0.5 }, '-=0.1');

  // Encabezados de sección: aparecen al hacer scroll
  gsap.utils.toArray('.section-header').forEach(el => {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none reverse' },
      y: 28, opacity: 0, duration: 0.75, ease,
    });
  });

  // Sección intro: texto e imagen entran desde lados opuestos
  gsap.from('.intro-left', {
    scrollTrigger: { trigger: '.intro-section', start: 'top 80%' },
    x: -32, opacity: 0, duration: 0.8, ease,
  });
  gsap.from('.intro-canvas-wrap', {
    scrollTrigger: { trigger: '.intro-section', start: 'top 78%' },
    x: 32, opacity: 0, duration: 0.8, ease, delay: 0.1,
  });

  // Tarjetas de topologías: entrada escalonada de izquierda a derecha
  gsap.from('.topo-card', {
    scrollTrigger: { trigger: '.topo-grid', start: 'top 82%' },
    y: 45, opacity: 0, stagger: { each: 0.07, from: 'start' }, duration: 0.65, ease,
  });

  // Tarjetas de características y aplicaciones
  gsap.from('.feat-card', {
    scrollTrigger: { trigger: '.feat-cards', start: 'top 84%' },
    y: 28, opacity: 0, stagger: 0.06, duration: 0.55, ease,
  });
  gsap.from('.app-card', {
    scrollTrigger: { trigger: '.app-cards', start: 'top 84%' },
    y: 24, opacity: 0, stagger: 0.05, duration: 0.5, ease,
  });

  // Canvas de redundancia y filas de la sección
  gsap.from('.redundancy-canvas-wrap', {
    scrollTrigger: { trigger: '#redundancy', start: 'top 80%' },
    scale: 0.93, opacity: 0, duration: 0.85, ease,
  });
  gsap.utils.toArray('.red-row').forEach((el, i) => {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 92%' },
      x: -20, opacity: 0, duration: 0.5, ease, delay: i * 0.04,
    });
  });

  // Tabla comparativa
  gsap.from('.compare-table-container', {
    scrollTrigger: { trigger: '.compare-table-container', start: 'top 84%' },
    y: 30, opacity: 0, duration: 0.75, ease,
  });

  // Tarjetas de selección de escenario
  gsap.utils.toArray('.chooser-card').forEach((card, i) => {
    gsap.from(card, {
      scrollTrigger: { trigger: card, start: 'top 90%' },
      y: 36, opacity: 0, duration: 0.6, ease, delay: i * 0.055,
    });
  });

  // Banner CTA y footer
  gsap.from('.cta-banner', {
    scrollTrigger: { trigger: '.cta-banner', start: 'top 84%' },
    y: 30, opacity: 0, duration: 0.7, ease,
  });
  gsap.from('.footer-brand, .footer-nav, .footer-resources, .footer-credits', {
    scrollTrigger: { trigger: '.footer', start: 'top 94%' },
    y: 18, opacity: 0, stagger: 0.09, duration: 0.55, ease,
  });

  // Forzar recálculo de posiciones tras renderizado inicial
  ScrollTrigger.refresh();
}

// ================================================================
//  INICIALIZACIÓN PRINCIPAL
//  Se ejecuta cuando el DOM está completamente cargado.
//  El orden importa: Lenis debe estar listo antes que cualquier
//  módulo que lo necesite (topology-view).
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar scroll suave y compartir instancia con topology-view
  const lenis = await initLenis();
  if (lenis) setLenis(lenis);

  // 2. Sistema de partículas del fondo
  const pCanvas = document.getElementById('particlesCanvas');
  if (pCanvas) new ParticleSystem(pCanvas);

  // 3. Esfera 3D del hero (importación dinámica para no bloquear el renderizado)
  const { Topology3DScene } = await import('./topology-3d.js');
  const heroCanvas = document.getElementById('heroCanvas3D');
  if (heroCanvas) {
    try { _heroScene = Topology3DScene.createHeroSphere(heroCanvas); } catch (_) {}
  }

  // 4. Inicializar todos los módulos de la página
  initNavbar();
  initIntroCanvas();
  initRedundancyCanvas();
  initMiniCanvases();
  initCardHover();
  initTopoCards();
  initChooserCards();
  initComparativeTable();
  initView();           // panel overlay de detalle de topologías
  initScrollAnimations();
});
