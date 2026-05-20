/* ================================================================
   NEOTOPIA – Motor 3D de Topologías de Red (Three.js)

   Este módulo implementa escenas 3D interactivas para cada topología.
   Características principales:
   - Detección de capacidad del dispositivo (móvil/escritorio/bajo rendimiento)
   - Calidad adaptativa según GPU (DPR, segmentos de geometría, antialiasing)
   - OrbitControls: arrastrar para rotar, scroll/pellizco para zoom
   - Raycaster: hover y clic/tap en nodos para mostrar tooltips
   - Paquetes de datos animados viajando por los enlaces
   - Pausa automática al salir de la pantalla (IntersectionObserver)
   - Limpieza completa de recursos GPU al destruir la escena
================================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Detección de capacidad del dispositivo ───────────────────────
// Determina si el dispositivo es táctil, móvil o de bajo rendimiento
// para ajustar la calidad de renderizado.
function detectDevice() {
  const touch   = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const w       = window.innerWidth;
  const dpr     = window.devicePixelRatio || 1;
  const mobile  = touch || w < 768;
  // "lowEnd": móvil con pantalla pequeña o poca RAM (navigator.deviceMemory ≤ 2 GB)
  const lowEnd  = mobile && (w <= 430 || (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 2));
  return { touch, mobile, lowEnd, dpr };
}

// ── Utilidades de color ──────────────────────────────────────────
// Convierte un color hexadecimal a THREE.Color
function hex(str) {
  return new THREE.Color(str);
}

// ── Caché de materiales compartidos ─────────────────────────────
// Reutilizar materiales idénticos evita crear objetos GPU duplicados
const _matCache = {};
function emissiveMat(color, intensity = 0.9, opacity = 1) {
  const key = `${color}_${intensity}_${opacity}`;
  if (_matCache[key]) return _matCache[key];
  const mat = new THREE.MeshStandardMaterial({
    color: hex(color),
    emissive: hex(color),
    emissiveIntensity: intensity,
    metalness: 0.3,
    roughness: 0.25,
    transparent: opacity < 1,
    opacity,
  });
  _matCache[key] = mat;
  return mat;
}

// Material para líneas (enlaces entre nodos)
function lineMat(color, opacity = 0.45) {
  return new THREE.LineBasicMaterial({
    color: hex(color),
    transparent: true,
    opacity,
  });
}

// ================================================================
//  Clase principal: escena 3D de una topología de red
// ================================================================
export class Topology3DScene {
  constructor(canvas, topologyType, colors, onNodeClick) {
    this.canvas       = canvas;
    this.type         = topologyType;
    this.colors       = colors;       // { primary, secondary }
    this.onNodeClick  = onNodeClick || null;  // callback al hacer clic en nodo
    this.nodeObjects  = [];           // mallas 3D de los nodos (para raycasting)
    this.packets      = [];           // esferas que representan paquetes en tránsito
    this.raf          = null;         // ID del requestAnimationFrame activo
    this.mouse        = new THREE.Vector2(-2, -2);  // posición del cursor normalizada
    this.hoveredNode  = null;
    this._autoRotTimer  = null;       // temporizador para reanudar auto-rotación
    this._destroyed     = false;
    this._isVisible     = true;       // controla la pausa por IntersectionObserver
    this._touchStartPos = null;       // posición inicial del toque (para distinguir tap de arrastre)

    // Ajustar calidad según capacidad del dispositivo
    const dev = detectDevice();
    this._isMobile = dev.mobile;
    this._isTouch  = dev.touch;
    this._isLowEnd = dev.lowEnd;

    this._init();
    this._buildTopology();
    this._fitCameraToTopology(); // encuadre automático para que toda la topología sea visible
    this._animate();
  }

  // Inicializa la escena, cámara, renderizador, luces y controles
  _init() {
    const rect = this.canvas.getBoundingClientRect();
    const W = rect.width  > 1 ? rect.width  : (this.canvas.parentElement?.clientWidth  || 800);
    const H = rect.height > 1 ? rect.height : (this.canvas.parentElement?.clientHeight || 480);

    // Escena
    this.scene = new THREE.Scene();

    // Cámara perspectiva (FOV 58° es un equilibrio entre distorsión y profundidad)
    this.camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 500);
    this.camera.position.set(0, 2.5, 9);

    // DPR adaptativo: reducir en móviles para ahorrar fill-rate GPU
    const dprCap = this._isLowEnd ? 1 : this._isMobile ? 1.5 : 2;
    const dpr    = Math.min(window.devicePixelRatio, dprCap);

    // Renderizador WebGL con calidad adaptativa
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this._isLowEnd,  // desactivar antialiasing en dispositivos de bajo rendimiento
      alpha: true,
      powerPreference: this._isMobile ? 'low-power' : 'high-performance',
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);
    this.renderer.setClearColor(0x050816, 1);   // fondo azul oscuro (mismo que el CSS)
    this.renderer.shadowMap.enabled = false;    // sombras desactivadas para mejor rendimiento

    // Iluminación: ambiente suave + direccional para dar volumen a los nodos
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 8, 6);
    this.scene.add(dir);

    // Controles de órbita: rotar, hacer zoom, autorotación
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping   = true;
    this.controls.dampingFactor   = this._isMobile ? 0.08 : 0.06;  // más amortiguación en móvil
    this.controls.rotateSpeed     = this._isTouch ? 1.1 : 0.7;
    this.controls.enablePan       = false;   // desactivar paneo para simplificar la interacción
    this.controls.minDistance     = 3;
    this.controls.maxDistance     = 22;
    this.controls.autoRotate      = true;
    this.controls.autoRotateSpeed = 0.55;

    // En táctil: habilitar zoom con pellizco; en escritorio: desactivado (para no interceptar scroll)
    this.controls.enableZoom = this._isTouch;
    if (this._isTouch) {
      // Evitar conflictos con los gestos nativos del navegador en el canvas 3D
      this.canvas.style.touchAction = 'none';
    }

    // Al interactuar: pausar autorotación; reanudarla 3 segundos después de soltar
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false;
      clearTimeout(this._autoRotTimer);
    });
    this.controls.addEventListener('end', () => {
      this._autoRotTimer = setTimeout(() => {
        if (!this._destroyed) this.controls.autoRotate = true;
      }, 3000);
    });

    // Redirigir eventos wheel al contenedor del overlay para que el scroll de la página funcione
    // incluso cuando el cursor está sobre el canvas 3D
    this._boundWheel = (e) => {
      const scrollable = this.canvas.closest('.topo-view') || document.getElementById('topoView');
      if (scrollable) scrollable.scrollBy({ top: e.deltaY, behavior: 'auto' });
    };
    this.canvas.addEventListener('wheel', this._boundWheel, { passive: true });

    // Campo de estrellas de fondo
    this._addStarfield();

    // Raycaster para detección de hover y clic en nodos
    this.raycaster = new THREE.Raycaster();
    this._boundMouseMove  = (e) => this._onMouseMove(e);
    this._boundMouseClick = (e) => this._onMouseClick(e);
    this.canvas.addEventListener('mousemove', this._boundMouseMove, { passive: true });
    this.canvas.addEventListener('click', this._boundMouseClick);

    // Detector de tap táctil (diferente del arrastre de OrbitControls)
    this._boundTouchStart = (e) => {
      if (e.touches.length === 1) {
        this._touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    this._boundTouchEnd = (e) => this._onTouchEnd(e);
    this.canvas.addEventListener('touchstart', this._boundTouchStart, { passive: true });
    this.canvas.addEventListener('touchend',   this._boundTouchEnd,   { passive: true });

    // IntersectionObserver: pausar el renderizado cuando el canvas no es visible
    // (ahorra batería en móviles al hacer scroll más allá del canvas)
    if ('IntersectionObserver' in window) {
      this._visObs = new IntersectionObserver(([entry]) => {
        this._isVisible = entry.isIntersecting;
        if (this._isVisible && !this.raf && !this._destroyed) this._animate();
      }, { threshold: 0.05 });
      this._visObs.observe(this.canvas);
    }

    // ResizeObserver: adaptar el renderizador al nuevo tamaño del canvas
    this._resizeObs = new ResizeObserver(() => this._onResize());
    this._resizeObs.observe(this.canvas.parentElement || document.body);
  }

  // Crea un campo de estrellas aleatorio como fondo de la escena 3D
  _addStarfield() {
    const geo = new THREE.BufferGeometry();
    // Menos estrellas en dispositivos de bajo rendimiento para mejorar FPS
    const n   = this._isLowEnd ? 150 : this._isMobile ? 280 : 600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 140;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.55 });
    this.scene.add(new THREE.Points(geo, mat));
  }

  // ── Creación de nodos ─────────────────────────────────────────
  // Crea una esfera 3D que representa un nodo de red.
  // Incluye: malla principal con emisión de luz, halo exterior y point light.
  _makeNode(x, y, z, color, radius = 0.25, label = '') {
    // Segmentos de la esfera: más detalle en escritorio, menos en móvil/lowEnd
    const seg  = this._isLowEnd ? 8 : this._isMobile ? 12 : 28;
    const geo  = new THREE.SphereGeometry(radius, seg, seg);
    const mat  = new THREE.MeshStandardMaterial({
      color:             hex(color),
      emissive:          hex(color),
      emissiveIntensity: 0.85,   // brillo de emisión base (aumenta a 2.2 al hacer hover)
      metalness: 0.25,
      roughness: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.userData = { label, color, baseIntensity: 0.85, isNode: true };

    // Luz puntual dentro del nodo para iluminar los cables cercanos
    const light = new THREE.PointLight(hex(color).getHex(), 1.4, radius * 12);
    mesh.add(light);

    // Esfera de halo semitransparente (efecto glow exterior)
    const haloGeo = new THREE.SphereGeometry(radius * 2.2, 14, 14);
    const haloMat = new THREE.MeshBasicMaterial({
      color: hex(color), transparent: true, opacity: 0.07, side: THREE.BackSide,
    });
    mesh.add(new THREE.Mesh(haloGeo, haloMat));

    this.scene.add(mesh);
    this.nodeObjects.push(mesh);  // registrar para raycasting
    return mesh;
  }

  // ── Creación de enlaces ───────────────────────────────────────
  // Crea una línea 3D entre dos nodos y añade un paquete de datos animado
  _makeEdge(a, b, color, opacity = 0.38) {
    const pts = [a.position.clone(), b.position.clone()];
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, lineMat(color, opacity));
    this.scene.add(line);
    this._spawnPacket(a, b, color); // crear paquete viajando por este enlace
    return line;
  }

  // Versión de _makeEdge para coordenadas raw (sin nodo Three.js como origen)
  _makeEdgeRaw(ax, ay, az, bx, by, bz, color, opacity = 0.38) {
    const pts = [new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz)];
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    this.scene.add(new THREE.Line(geo, lineMat(color, opacity)));
  }

  // ── Paquetes de datos animados ────────────────────────────────
  // Crea una esfera pequeña que viaja de nodeA a nodeB en bucle.
  // La velocidad varía aleatoriamente para un efecto más orgánico.
  _spawnPacket(nodeA, nodeB, color) {
    const geo  = new THREE.SphereGeometry(0.09, 8, 8);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const pkt  = new THREE.Mesh(geo, mat);
    pkt.userData = {
      start:   nodeA.position.clone(),
      end:     nodeB.position.clone(),
      t:       Math.random(),                        // posición inicial aleatoria (0→1)
      speed:   0.0028 + Math.random() * 0.0022,     // velocidad ligeramente aleatoria
      color:   hex(color).getHex(),
    };
    this.scene.add(pkt);
    this.packets.push(pkt);
  }

  // ── Construcción de topologías ────────────────────────────────
  // Despacha a la función correcta según el tipo de topología
  _buildTopology() {
    const c1 = this.colors.primary;
    const c2 = this.colors.secondary;
    switch (this.type) {
      case 'star':   this._buildStar(c1, c2);   break;
      case 'bus':    this._buildBus(c1, c2);    break;
      case 'ring':   this._buildRing(c1, c2);   break;
      case 'tree':   this._buildTree(c1, c2);   break;
      case 'mesh':   this._buildMesh(c1, c2);   break;
      case 'hybrid': this._buildHybrid(c1, c2); break;
      default:       this._buildStar(c1, c2);
    }
  }

  // Estrella 3D: hub central grande + 8 nodos periféricos distribuidos en círculo con variación vertical
  _buildStar(c1, c2) {
    const hub = this._makeNode(0, 0, 0, c2, 0.42, 'Hub Central');
    const n = 8, r = 3.4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const y = Math.sin(a * 1.3) * 0.6;  // variación vertical para efecto 3D más interesante
      const node = this._makeNode(r * Math.cos(a), y, r * Math.sin(a), c1, 0.22, `Nodo ${i + 1}`);
      this._makeEdge(hub, node, c1);
    }
  }

  // Bus 3D: línea horizontal (backbone) + terminadores + dispositivos alternados arriba/abajo
  _buildBus(c1, c2) {
    // Línea del backbone
    const bpts = [new THREE.Vector3(-4.5, 0, 0), new THREE.Vector3(4.5, 0, 0)];
    const bgeo  = new THREE.BufferGeometry().setFromPoints(bpts);
    const bmat  = new THREE.LineBasicMaterial({ color: hex(c1), transparent: true, opacity: 0.65, linewidth: 2 });
    this.scene.add(new THREE.Line(bgeo, bmat));

    // Terminadores resistivos en los extremos del bus
    this._makeNode(-4.5, 0, 0, c2, 0.18, '50Ω');
    this._makeNode( 4.5, 0, 0, c2, 0.18, '50Ω');

    // 5 dispositivos conectados con derivaciones alternadas arriba/abajo
    const positions = [-3.2, -1.6, 0, 1.6, 3.2];
    positions.forEach((x, i) => {
      const y = (i % 2 === 0) ? 2.2 : -2.2;  // alternar posición vertical
      const node = this._makeNode(x, y, 0, c1, 0.22, `Dispositivo ${i + 1}`);
      this._makeEdgeRaw(x, y, 0, x, 0, 0, c1, 0.32);  // derivación vertical al backbone
      this._makeNode(x, 0, 0, c2, 0.1, '');             // punto de unión en el backbone
      this._spawnPacket(
        { position: new THREE.Vector3(x, y, 0) },
        { position: new THREE.Vector3(x, 0, 0) },
        c1
      );
    });

    // Paquetes viajando en ambas direcciones a lo largo del backbone
    const busA = { position: new THREE.Vector3(-4.5, 0, 0) };
    const busB = { position: new THREE.Vector3( 4.5, 0, 0) };
    this._spawnPacket(busA, busB, c1);
    this._spawnPacket(busB, busA, c1);  // tráfico bidireccional
  }

  // Anillo 3D: N nodos en círculo con enlace entre cada par consecutivo + token
  _buildRing(c1, c2) {
    const n = 9, r = 3.2;
    const nodes = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      const y = Math.sin(a * 2) * 0.45;  // variación vertical suave para efecto 3D
      return this._makeNode(x, y, z, c1, 0.24, `Nodo ${i + 1}`);
    });
    // Conectar cada nodo al siguiente (anillo)
    for (let i = 0; i < n; i++) {
      this._makeEdge(nodes[i], nodes[(i + 1) % n], c1);
    }
    // Token: esfera blanca brillante que orbita independientemente del modelo
    const tokGeo = new THREE.SphereGeometry(0.14, 12, 12);
    const tokMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    this._tokenMesh  = new THREE.Mesh(tokGeo, tokMat);
    this.scene.add(this._tokenMesh);
    this._tokenAngle = 0;
    this._tokenR     = r;
  }

  // Árbol jerárquico 3D: Core → 2 switches de Distribución → 4 switches de Acceso
  _buildTree(c1, c2) {
    const root  = this._makeNode(0, 3.8, 0, c2, 0.4, 'Core');
    const dist1 = this._makeNode(-3.5, 1.2, 0, c1, 0.3, 'Distribución 1');
    const dist2 = this._makeNode( 3.5, 1.2, 0, c1, 0.3, 'Distribución 2');
    this._makeEdge(root, dist1, c1);
    this._makeEdge(root, dist2, c1);

    const cyan = '#00E5FF';
    // 4 switches de acceso: 2 cuelgan de cada switch de distribución
    const accData = [
      [-6, -1.6, -1], [-2.5, -1.6, -1],   // hijos de dist1
      [ 2.5, -1.6, -1], [ 6, -1.6, -1],   // hijos de dist2
    ];
    const parents = [dist1, dist1, dist2, dist2];
    accData.forEach(([x, y, z], i) => {
      const acc = this._makeNode(x, y, z, cyan, 0.2, `Acceso ${i + 1}`);
      this._makeEdge(parents[i], acc, cyan);
    });
  }

  // Malla 3D completa: 7 nodos con todas las N(N-1)/2 conexiones posibles
  _buildMesh(c1, c2) {
    const n = 7, r = 3.0;
    const nodes = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const rr = r + (Math.random() - 0.5) * 0.6;  // radio ligeramente aleatorio para aspecto orgánico
      return this._makeNode(
        rr * Math.cos(a),
        (Math.random() - 0.5) * 2.2,  // altura aleatoria (efecto 3D)
        rr * Math.sin(a),
        c1, 0.26, `Nodo ${i + 1}`
      );
    });
    // Conectar todos los pares (malla completa = N(N-1)/2 enlaces)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        this._makeEdge(nodes[i], nodes[j], c1, 0.22);
      }
    }
  }

  // Híbrida 3D: núcleo en triángulo de malla (3 hubs) + estrellas desde cada hub
  _buildHybrid(c1, c2) {
    // Tres hubs centrales interconectados en malla completa (triángulo)
    const h1 = this._makeNode(-2.5, 0, -1.5, c1, 0.35, 'Hub A');
    const h2 = this._makeNode( 2.5, 0, -1.5, c1, 0.35, 'Hub B');
    const h3 = this._makeNode( 0,   0,  2.2, c1, 0.35, 'Hub C');
    this._makeEdge(h1, h2, c1, 0.5);
    this._makeEdge(h2, h3, c1, 0.5);
    this._makeEdge(h1, h3, c1, 0.5);

    // 3 nodos hoja por cada hub (topología estrella local)
    const leafData = [
      [[-5.2, 1.8, -2.5], [-5.5, -0.8, -2.5], [-3.8, -1.5, 0.2]],  // hojas de h1
      [[ 5.2, 1.8, -2.5], [ 5.5, -0.8, -2.5], [ 3.8, -1.5, 0.2]],  // hojas de h2
      [[  0,  2.8,  4.5], [-2.2, 0.8,  4.8],  [ 2.2, 0.8, 4.8]],   // hojas de h3
    ];
    const hubs = [h1, h2, h3];
    hubs.forEach((hub, hi) => {
      leafData[hi].forEach(([x, y, z], li) => {
        const leaf = this._makeNode(x, y, z, c2, 0.19, `Nodo ${hi * 3 + li + 1}`);
        this._makeEdge(hub, leaf, c2, 0.35);
      });
    });
  }

  // ── Variante especial: esfera del hero ────────────────────────
  // Crea la esfera decorativa de red 3D que aparece en el hero de la página.
  // Es un método estático porque no requiere una instancia completa de la clase.
  static createHeroSphere(canvas) {
    const dev    = detectDevice();
    const scene  = new THREE.Scene();
    const W      = canvas.clientWidth  || 520;
    const H      = canvas.clientHeight || 520;
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    camera.position.set(0, 0, 7.5);

    const dprCap   = dev.lowEnd ? 1 : dev.mobile ? 1.5 : 2;
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: !dev.lowEnd, alpha: true,
      powerPreference: dev.mobile ? 'low-power' : 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0); // fondo transparente (el CSS pone el fondo)

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const dir = new THREE.DirectionalLight(0x00e5ff, 0.8);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    // Estrellas de fondo (menos en móvil para mejor rendimiento)
    const starCount = dev.lowEnd ? 150 : dev.mobile ? 280 : 500;
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) sp[i] = (Math.random() - 0.5) * 90;
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.5 })));

    // Grupo que agrupa nodos y líneas para que roten juntos
    const group = new THREE.Group();
    scene.add(group);

    // Distribución de nodos en la superficie de una esfera usando la secuencia de Fibonacci
    // Esto garantiza una distribución uniforme sin agrupamientos
    const COLORS  = ['#00E5FF', '#3B82F6', '#94fc17', '#FF4D8D', '#FF7A00'];
    const nodes   = [];
    const nodeSeg = dev.lowEnd ? 8 : 16;
    const nodeGeo = new THREE.SphereGeometry(0.12, nodeSeg, nodeSeg);
    const n       = dev.lowEnd ? 14 : dev.mobile ? 20 : 28;
    for (let i = 0; i < n; i++) {
      // Fórmula de esfera de Fibonacci para distribución uniforme
      const phi   = Math.acos(1 - (2 * (i + 0.5)) / n);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r     = 2.8 + (Math.random() - 0.5) * 0.5;
      const x     = r * Math.sin(phi) * Math.cos(theta);
      const y     = r * Math.sin(phi) * Math.sin(theta);
      const z     = r * Math.cos(phi);
      const col   = COLORS[i % COLORS.length];
      const mat   = new THREE.MeshStandardMaterial({
        color: new THREE.Color(col), emissive: new THREE.Color(col),
        emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.3,
      });
      const mesh  = new THREE.Mesh(nodeGeo, mat);
      mesh.position.set(x, y, z);
      group.add(mesh);  // añadir al grupo (no a scene) para que rote con las líneas
      nodes.push(mesh);
      // Luz puntual parental al nodo (rota con el grupo)
      const pl = new THREE.PointLight(new THREE.Color(col).getHex(), 0.8, 2.5);
      mesh.add(pl);
    }

    // Conectar cada nodo a sus ~3 vecinos más cercanos
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.22 });
    for (let i = 0; i < n; i++) {
      const dists = nodes.map((b, j) => ({ j, d: nodes[i].position.distanceTo(b.position) }))
        .filter(e => e.j !== i).sort((a, b) => a.d - b.d).slice(0, 3);
      dists.forEach(({ j }) => {
        const pts = [nodes[i].position.clone(), nodes[j].position.clone()];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMaterial));
      });
    }

    // Bucle de animación: rotación lenta con oscilación en X
    let raf = null;
    function frame() {
      raf = requestAnimationFrame(frame);
      group.rotation.y += 0.003;
      group.rotation.x  = Math.sin(Date.now() * 0.0003) * 0.15;  // balanceo suave
      renderer.render(scene, camera);
    }
    frame();

    // Adaptar al cambiar el tamaño del contenedor
    function resize() {
      const p = canvas.parentElement;
      if (!p) return;
      const w = p.clientWidth, h = p.clientHeight || w;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // Devolver objeto con método destroy para limpiar recursos
    return { destroy() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); } };
  }

  // ── Interacción: ratón y táctil ───────────────────────────────

  // Actualiza la posición del mouse normalizada (–1 a 1) para el raycaster
  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1;
  }

  // Al hacer clic: detectar intersecciones con nodos y mostrar tooltip
  _onMouseClick(e) {
    if (this.nodeObjects.length === 0) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.nodeObjects);
    if (hits.length > 0) {
      const node  = hits[0].object;
      const label = node.userData.label;
      if (label) this._showTooltip(label, e.clientX, e.clientY);
      if (this.onNodeClick) this.onNodeClick(label, node.userData.color);
    }
  }

  // Tap táctil: se activa solo si el dedo no se movió más de 10 px (no es un arrastre)
  _onTouchEnd(e) {
    if (!e.changedTouches.length || !this._touchStartPos) return;
    const t  = e.changedTouches[0];
    const dx = t.clientX - this._touchStartPos.x;
    const dy = t.clientY - this._touchStartPos.y;
    if (dx * dx + dy * dy > 100) return; // distancia > 10 px → era un arrastre, no tap

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x =  ((t.clientX - rect.left)  / rect.width)  * 2 - 1;
    this.mouse.y = -((t.clientY - rect.top)   / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.nodeObjects);
    if (hits.length > 0) {
      const node  = hits[0].object;
      const label = node.userData.label;
      if (label) this._showTooltip(label, t.clientX, t.clientY);
      if (this.onNodeClick) this.onNodeClick(label, node.userData.color);
    }
  }

  // Muestra un tooltip flotante con el nombre del nodo en la posición del clic
  _showTooltip(label, x, y) {
    let t = document.getElementById('node-tooltip');
    if (!t) {
      t = document.createElement('div');
      t.id = 'node-tooltip';
      document.body.appendChild(t);
    }
    t.textContent = label;
    t.style.left    = (x + 12) + 'px';
    t.style.top     = (y - 36) + 'px';
    t.style.opacity = '1';
    clearTimeout(this._ttTimer);
    this._ttTimer = setTimeout(() => { t.style.opacity = '0'; }, 2200);  // ocultar a los 2.2 s
  }

  // Ajusta la cámara y el renderizador al nuevo tamaño del canvas
  _onResize() {
    if (this._destroyed || !this.canvas.parentElement) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width  > 1 ? rect.width  : (this.canvas.parentElement.clientWidth  || 800);
    const h = rect.height > 1 ? rect.height : (this.canvas.parentElement.clientHeight || 480);
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this._fitCameraToTopology(); // reencuadrar tras el redimensionado
  }

  // Calcula y ajusta la distancia de la cámara para que toda la topología
  // sea siempre visible, independientemente del tamaño o aspecto del canvas
  _fitCameraToTopology() {
    if (!this.nodeObjects.length) return;
    // Calcular la caja envolvente (bounding box) de todos los nodos
    const box = new THREE.Box3();
    this.nodeObjects.forEach(obj => box.expandByPoint(obj.position));
    const center = new THREE.Vector3();
    box.getCenter(center);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    // Usar el FOV más restrictivo (vertical vs horizontal) para garantizar visibilidad completa
    const vHalf = (this.camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * Math.max(0.3, this.camera.aspect));
    const minHalf = Math.min(vHalf, hHalf);
    const dist = (sphere.radius / Math.tan(minHalf)) * 1.35;  // margen del 35%
    this.camera.position.set(center.x, center.y + sphere.radius * 0.18, center.z + dist);
    this.controls.target.copy(center);
    this.controls.minDistance = Math.max(2.5, dist * 0.28);
    this.controls.maxDistance = dist * 3.5;
    this.controls.update();
  }

  // ── Bucle de animación ────────────────────────────────────────
  _animate() {
    if (this._destroyed) return;
    // No renderizar cuando el canvas está fuera de pantalla (ahorra CPU/GPU en móvil)
    if (!this._isVisible) { this.raf = null; return; }
    this.raf = requestAnimationFrame(() => this._animate());

    // Animar el token del anillo: orbitar alrededor del centro
    if (this._tokenMesh && this._tokenAngle !== undefined) {
      this._tokenAngle += 0.018;
      this._tokenMesh.position.set(
        this._tokenR * Math.cos(this._tokenAngle),
        Math.sin(this._tokenAngle * 2) * 0.45,   // leve oscilación vertical
        this._tokenR * Math.sin(this._tokenAngle)
      );
    }

    // Mover paquetes de datos a lo largo de sus enlaces (lerp de start a end)
    this.packets.forEach(pkt => {
      const ud = pkt.userData;
      ud.t += ud.speed;
      if (ud.t > 1) ud.t = 0;  // reiniciar al llegar al destino
      pkt.position.lerpVectors(ud.start, ud.end, ud.t);
    });

    // Hover highlight: aumentar emisión del nodo bajo el cursor
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.nodeObjects);
    this.nodeObjects.forEach(n => {
      n.material.emissiveIntensity = n.userData.baseIntensity;  // restaurar emisión base
    });
    if (hits.length > 0) {
      hits[0].object.material.emissiveIntensity = 2.2;  // brillo máximo en hover
      this.canvas.style.cursor = 'pointer';
    } else {
      this.canvas.style.cursor = 'grab';
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // ── Limpieza de recursos ──────────────────────────────────────
  // Libera toda la memoria GPU y elimina todos los event listeners
  destroy() {
    this._destroyed = true;
    clearTimeout(this._autoRotTimer);
    clearTimeout(this._ttTimer);
    if (this.raf) cancelAnimationFrame(this.raf);
    // Eliminar event listeners
    this.canvas.removeEventListener('mousemove',  this._boundMouseMove);
    this.canvas.removeEventListener('click',      this._boundMouseClick);
    this.canvas.removeEventListener('touchstart', this._boundTouchStart);
    this.canvas.removeEventListener('touchend',   this._boundTouchEnd);
    if (this._boundWheel) this.canvas.removeEventListener('wheel', this._boundWheel);
    if (this._resizeObs) this._resizeObs.disconnect();
    if (this._visObs)    this._visObs.disconnect();
    this.controls.dispose();
    // Recorrer la escena y liberar geometrías y materiales de GPU
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    this.renderer.dispose();
    // Limpiar caché de materiales para evitar referencias a objetos destruidos
    Object.keys(_matCache).forEach(k => delete _matCache[k]);
  }
}
