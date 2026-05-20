/* ================================================================
   NEOTOPIA – Base de Datos de Topologías + Utilidades de Dibujo
   v2.0 — Campos educativos expandidos

   Este archivo exporta dos cosas:
   1. TOPOLOGIES: arreglo con los datos completos de las 6 topologías
      de red (definición, ventajas, desventajas, métricas, SPOF, etc.)
   2. drawTopologyOnCanvas: función que dibuja la animación 2D de
      cada topología en un elemento <canvas>
================================================================ */

// ================================================================
//  BASE DE DATOS DE TOPOLOGÍAS
//  Cada objeto contiene todos los campos necesarios para la página:
//  metadatos visuales, contenido educativo y métricas comparativas.
// ================================================================
export const TOPOLOGIES = [
  {
    // ── Identificación y metadatos visuales ──────────────────────
    id: 'estrella', num: 'TIPO-01', miniType: 'star',
    accentColor: '#FF4D8D', accentColor2: '#FF7A00',
    chips: ['Hub Central', 'Alta Fiabilidad'],
    tagline: 'Un centro que lo controla todo',
    shortDesc: 'Todos los nodos conectados a un hub o switch central. La más usada en redes LAN modernas.',

    // ── Campos educativos de tolerancia a fallos ─────────────────
    spof: true,  // tiene Punto Único de Fallo (Single Point of Failure)
    spofDesc: 'El switch o hub central es el único punto de fallo. Si colapsa, toda la red queda inoperativa.',
    redundancyLevel: 'baja',
    redundancyNote: 'Sin redundancia inherente. Requiere switch redundante o UPS para mejorarla.',
    failureType: 'total',
    failureNote: 'Fallo del centro = fallo total. Fallo de nodo periférico = fallo aislado, red continúa.',
    cableFormula: 'N cables para N nodos',
    cableNote: 'Cada dispositivo requiere un cable propio hasta el nodo central.',
    standards: ['Ethernet IEEE 802.3', 'Fast Ethernet 802.3u', 'Gigabit Ethernet 802.3ab'],
    status: 'vigente',
    statusNote: 'Topología dominante en redes LAN modernas. Reemplazó al Bus coaxial desde los 90.',

    // ── Contenido académico completo ─────────────────────────────
    definition: 'La topología estrella es una arquitectura de red donde todos los nodos están conectados directamente a un nodo central —generalmente un switch o hub. La comunicación entre dispositivos siempre pasa a través de este punto central, que actúa como controlador del tráfico de datos.',
    structure: 'Un nodo central (hub/switch) forma el eje de la red. Cada dispositivo periférico posee su propio enlace dedicado hacia el centro. El nodo central puede ser activo (switch inteligente con tabla MAC) o pasivo (hub de difusión broadcast). Con switch: N cables para N nodos.',
    howItWorks: 'Cuando un dispositivo desea comunicarse, envía los datos al nodo central. Un switch los reenvía directamente al destinatario consultando su tabla MAC. Un hub los retransmite a todos los nodos simultáneamente (broadcast); solo el destinatario correcto procesa el paquete. Con switch, cada enlace es full-duplex y dedicado.',
    advantages: [
      { title: 'Fácil diagnóstico', desc: 'Los fallos se aíslan fácilmente. Si un nodo periférico falla, el resto continúa sin interrupción.' },
      { title: 'Alta fiabilidad por rama', desc: 'El fallo de un cable o nodo periférico no afecta a los demás dispositivos conectados.' },
      { title: 'Gestión centralizada', desc: 'Toda la administración, monitoreo y control de la red se realiza desde el nodo central.' },
      { title: 'Escalabilidad simple', desc: 'Agregar nuevos dispositivos es sencillo: solo se conecta al centro sin interrumpir la red activa.' },
      { title: 'Rendimiento predecible', desc: 'Con switch, cada dispositivo tiene su propio canal dedicado de comunicación full-duplex.' },
    ],
    disadvantages: [
      { title: 'Punto único de fallo (SPOF)', desc: 'Si el nodo central falla, toda la red colapsa completamente. Sin redundancia inherente en la topología base.' },
      { title: 'Costo del hardware central', desc: 'Requiere switch o hub de calidad como nodo central, representando una inversión significativa.' },
      { title: 'Mayor cantidad de cableado', desc: 'Cada nodo necesita su propio cable hasta el centro, incrementando costos en redes grandes.' },
      { title: 'Cuello de botella en el centro', desc: 'El rendimiento global depende completamente de la capacidad del nodo central.' },
    ],
    applications: ['Redes LAN domésticas y de oficina', 'Redes empresariales de pequeña y mediana escala', 'Redes escolares y universitarias', 'Laboratorios de computación'],
    realExample: 'Una red de oficina donde computadores, impresoras y teléfonos IP están conectados a un switch central. Si la impresora falla, el resto continúa operando. Es la topología más implementada en redes locales modernas gracias a su simplicidad y fiabilidad práctica.',
    // Métricas 1-5 (5 = mejor): costo, escalabilidad, rendimiento, tolerancia a fallos, facilidad
    stats: { cost: 3, scalability: 4, performance: 4, faultTolerance: 3, ease: 5 },
  },

  {
    id: 'bus', num: 'TIPO-02', miniType: 'bus',
    accentColor: '#00E5FF', accentColor2: '#3B82F6',
    chips: ['Canal Único', 'Económico'],
    tagline: 'Un canal compartido por todos',
    shortDesc: 'Canal central compartido por todos los nodos. Histórica en LAN coaxial, vigente en CAN bus industrial.',

    spof: true,
    spofDesc: 'El backbone (cable principal) es el SPOF total. Un corte en cualquier punto inutiliza toda la red instantáneamente.',
    redundancyLevel: 'nula',
    redundancyNote: 'No existe ningún camino alternativo. Un fallo en el cable es un fallo catastrófico total.',
    failureType: 'catastrófico',
    failureNote: 'Fallo del backbone = pérdida total e inmediata de toda la red. Sin posibilidad de rerouting.',
    cableFormula: '1 cable troncal + derivaciones',
    cableNote: 'Un segmento principal con terminadores en ambos extremos (50Ω/75Ω). Cada nodo se conecta mediante derivación T.',
    standards: ['Ethernet 10Base-2 (ThinNet)', 'Ethernet 10Base-5 (ThickNet)', 'CAN Bus ISO 11898', 'RS-485'],
    status: 'legacy-lan',
    statusNote: 'Obsoleta en LAN desde los 90 (reemplazada por Estrella). Vigente en entornos industriales: CAN bus en vehículos, RS-485 en automatización.',

    definition: 'La topología de bus utiliza un único cable central (backbone) al que todos los dispositivos se conectan mediante derivaciones. Los datos viajan por el bus en ambas direcciones como señal eléctrica; todos los nodos reciben la señal, pero solo el destinatario la procesa.',
    structure: 'Un cable coaxial principal actúa como columna vertebral compartida. Los nodos se conectan mediante conectores-T o derivaciones tap. Los extremos del bus llevan terminadores resistivos (50Ω o 75Ω) que absorben la señal y evitan reflexiones que degradarían la transmisión.',
    howItWorks: 'Un dispositivo que desea transmitir verifica primero si el bus está libre (CSMA/CD). Si está disponible, envía los datos como señal eléctrica. La señal viaja por todo el cable y todos los nodos la reciben simultáneamente; solo el que reconoce su dirección MAC acepta y procesa el paquete.',
    advantages: [
      { title: 'Bajo costo de implementación', desc: 'Requiere considerablemente menos cable que otras topologías. Mínima infraestructura inicial.' },
      { title: 'Instalación simple y rápida', desc: 'Fácil de instalar en redes pequeñas con disposición lineal o en una sola sala.' },
      { title: 'Sin hardware central costoso', desc: 'No necesita switch ni hub central, eliminando ese costo de la inversión.' },
      { title: 'Extensión sencilla', desc: 'Se pueden añadir nuevos nodos al cable principal con relativa facilidad.' },
    ],
    disadvantages: [
      { title: 'Ancho de banda compartido', desc: 'Todos los dispositivos compiten por el mismo canal único de comunicación, limitando el rendimiento.' },
      { title: 'Fallo catastrófico del backbone', desc: 'Un corte o fallo en cualquier punto del cable principal inutiliza toda la red instantáneamente.' },
      { title: 'Rendimiento degradado con escala', desc: 'A mayor número de nodos, mayor congestión y colisiones CSMA/CD. Impráctica con más de 30 nodos.' },
      { title: 'Longitud física limitada', desc: 'La señal eléctrica se degrada con la distancia, limitando la longitud máxima del segmento.' },
      { title: 'Colisiones frecuentes', desc: 'Las transmisiones simultáneas generan colisiones que requieren retransmisión y consumen ancho de banda.' },
    ],
    applications: ['Redes Ethernet coaxiales históricas (10Base-2, 10Base-5)', 'CAN bus en vehículos y sistemas industriales', 'RS-485 en automatización y SCADA', 'Redes pequeñas de bajo presupuesto'],
    realExample: 'Las primeras redes Ethernet de los años 80-90 usaban bus con cable coaxial RG-58. Hoy el CAN bus (Controller Area Network) en automóviles conecta el motor, ABS, airbags y sensores en un único bus de datos compartido, siendo el ejemplo vigente más importante de esta topología.',
    stats: { cost: 5, scalability: 2, performance: 2, faultTolerance: 1, ease: 4 },
  },

  {
    id: 'anillo', num: 'TIPO-03', miniType: 'ring',
    accentColor: '#FF007A', accentColor2: '#FF4D8D',
    chips: ['Ciclo Cerrado', 'Token Ring'],
    tagline: 'Datos que fluyen en circuito cerrado',
    shortDesc: 'Nodos en ciclo cerrado con control por token. Sin colisiones y latencia garantizada.',

    spof: true,
    spofDesc: 'En anillo simple, cualquier nodo o segmento de cable fallido interrumpe todo el ciclo. Anillo doble (FDDI) elimina este problema.',
    redundancyLevel: 'media',
    redundancyNote: 'Anillo simple: redundancia nula. Anillo doble FDDI: alta redundancia por conmutación automática al anillo secundario.',
    failureType: 'total-o-nulo',
    failureNote: 'Anillo simple: fallo de 1 nodo = fallo total. Anillo doble: fallo de fibra = conmutación automática en milisegundos, cero pérdida.',
    cableFormula: 'N cables para N nodos (anillo simple) / 2N cables (anillo doble)',
    cableNote: 'Cada nodo conecta con el anterior y el siguiente. FDDI usa dos anillos concéntricos en direcciones opuestas.',
    standards: ['Token Ring IEEE 802.5', 'FDDI (Fiber Distributed Data Interface)', 'SONET/SDH', 'RPR IEEE 802.17'],
    status: 'legacy-lan',
    statusNote: 'Token Ring IBM obsoleto en LAN desde los 90. SONET/SDH y FDDI vigentes en telecomunicaciones metropolitanas y de larga distancia.',

    definition: 'En la topología de anillo, cada dispositivo está conectado exactamente a otros dos nodos, formando un circuito cerrado. Los datos viajan en una dirección (unidireccional) o en ambas (anillo doble), pasando secuencialmente por cada nodo hasta alcanzar el destinatario.',
    structure: 'Cada nodo tiene exactamente dos conexiones: al nodo anterior y al siguiente en el ciclo. En Token Ring IEEE 802.5, un token especial circula continuamente. En anillo doble FDDI, dos anillos concéntricos operan en direcciones opuestas para proporcionar redundancia automática ante fallos de fibra.',
    howItWorks: 'Los datos se transmiten en paquetes que contienen la dirección de destino. Cada nodo examina el paquete: si la dirección MAC no coincide, lo regenera y reenvía al siguiente. El proceso continúa hasta que llega al destinatario, quien lo copia y libera el token. El tiempo máximo de espera (time-to-token) es calculable y garantizado.',
    advantages: [
      { title: 'Acceso equitativo garantizado', desc: 'El token ring asegura que todos los dispositivos tienen igual oportunidad de transmitir sin monopolización.' },
      { title: 'Cero colisiones de datos', desc: 'El control mediante token elimina completamente las colisiones, a diferencia de CSMA/CD.' },
      { title: 'Latencia determinística', desc: 'El tiempo máximo de espera para transmitir es calculable y predecible bajo cualquier carga.' },
      { title: 'Redundancia automática (doble)', desc: 'FDDI: fallo de fibra provoca conmutación automática al anillo secundario en milisegundos.' },
    ],
    disadvantages: [
      { title: 'Fallo total en anillo simple', desc: 'Un solo nodo o segmento defectuoso interrumpe toda la comunicación del anillo.' },
      { title: 'Diagnóstico complejo', desc: 'Localizar el punto de fallo requiere verificación secuencial nodo por nodo a lo largo del anillo.' },
      { title: 'Modificaciones disruptivas', desc: 'Añadir o quitar nodos requiere interrumpir la red temporalmente durante la reconfiguración.' },
      { title: 'Latencia acumulada', desc: 'Los datos deben pasar y ser procesados por cada nodo intermedio, aumentando la latencia proporcional al tamaño.' },
    ],
    applications: ['Redes Token Ring IBM 802.5 (legacy corporativo)', 'Redes FDDI metropolitanas', 'Sistemas de control industrial de tiempo real', 'Redes SONET/SDH de telecomunicaciones de alta disponibilidad'],
    realExample: 'Las redes SONET/SDH utilizadas en telecomunicaciones metropolitanas implementan anillo doble de fibra óptica. Si una fibra se corta, el tráfico se redirige automáticamente por el anillo secundario en sentido opuesto, restaurando la comunicación en milisegundos. Es el estándar en backbone de telecos.',
    stats: { cost: 3, scalability: 2, performance: 3, faultTolerance: 2, ease: 2 },
  },

  {
    id: 'arbol', num: 'TIPO-04', miniType: 'tree',
    accentColor: '#3B82F6', accentColor2: '#00E5FF',
    chips: ['Jerárquica', 'Escalable'],
    tagline: 'Jerarquía que escala al infinito',
    shortDesc: 'Estructura jerárquica Core-Distribution-Access. Estándar en redes empresariales y campus.',

    spof: true,
    spofDesc: 'El switch Core (raíz) es el SPOF para el tráfico inter-rama. Switches de distribución son SPOF para sus subramas.',
    redundancyLevel: 'media',
    redundancyNote: 'Redundancia por rama: fallo de una rama no afecta a otras. Sin STP, los loops destruyen la red. Con RSTP, reconvergencia en <1s.',
    failureType: 'parcial',
    failureNote: 'Fallo de nodo hoja = fallo aislado. Fallo de switch de distribución = pérdida de una subrama. Fallo del Core = red fragmentada.',
    cableFormula: 'N-1 enlaces para N nodos (árbol mínimo)',
    cableNote: 'Árbol jerárquico mínimo. En la práctica se añaden enlaces redundantes gestionados por STP/RSTP.',
    standards: ['Ethernet IEEE 802.3', 'STP IEEE 802.1D', 'RSTP IEEE 802.1w', 'MSTP IEEE 802.1s', 'VLAN IEEE 802.1Q'],
    status: 'vigente',
    statusNote: 'Arquitectura Core-Distribution-Access es el estándar de facto en redes corporativas y campus universitarios actuales.',

    definition: 'La topología de árbol es una extensión jerárquica de la topología estrella. Combina múltiples grupos estrella en una estructura ramificada donde los switches de nivel inferior se conectan a switches de nivel superior, culminando en un nodo raíz que gestiona el tráfico global.',
    structure: 'Tiene tres capas: Core (cima de la jerarquía), Distribución (switches que agregan tráfico de subredes) y Acceso (dispositivos finales o switches por sala). Cada nodo tiene exactamente un padre, excepto la raíz. STP/RSTP previene loops en topologías con enlaces redundantes.',
    howItWorks: 'La comunicación sigue la jerarquía: los datos suben por la rama del emisor hasta alcanzar el primer ancestro común con el destinatario, luego descienden por la rama correcta. Los switches Core gestionan el tráfico entre subredes y VLANs. STP bloquea puertos redundantes para prevenir loops y los activa ante fallos.',
    advantages: [
      { title: 'Escalabilidad máxima estructurada', desc: 'Se expande fácilmente añadiendo nuevas ramas y subramas sin afectar la estructura existente.' },
      { title: 'Gestión jerárquica natural', desc: 'La organización por departamentos, pisos y edificios se mapea directamente a la topología.' },
      { title: 'Aislamiento de fallos por rama', desc: 'Un fallo en una rama específica no afecta a otras ramas de la red global.' },
      { title: 'Soporte para redes corporativas grandes', desc: 'Diseñado para organizaciones con múltiples departamentos, pisos o edificios.' },
      { title: 'QoS y prioridad por nivel', desc: 'Permite implementar calidad de servicio y prioridad de tráfico según el nivel jerárquico.' },
    ],
    disadvantages: [
      { title: 'Dependencia crítica del nodo raíz', desc: 'Si el switch Core falla sin redundancia, toda la red pierde comunicación inter-rama.' },
      { title: 'Mayor infraestructura requerida', desc: 'La jerarquía demanda más equipos de red y cableado que una topología estrella simple.' },
      { title: 'Complejidad de configuración', desc: 'Gestionar VLANs, STP y políticas en múltiples niveles jerárquicos es complejo.' },
      { title: 'Cuello de botella en el Core', desc: 'Todo el tráfico inter-rama converge en los switches superiores, que pueden saturarse bajo alta carga.' },
    ],
    applications: ['Redes corporativas empresariales de gran escala', 'Infraestructura de campus universitarios', 'Redes de edificios con múltiples pisos', 'Arquitectura Core-Distribution-Access de datacenters'],
    realExample: 'Una universidad con datacenter central conectado a switches de distribución en cada edificio (Ingeniería, Ciencias, Administración), y estos a switches de acceso en cada sala y laboratorio. Cada departamento opera su subred independiente pero comparte el backbone institucional con STP previniendo loops.',
    stats: { cost: 3, scalability: 5, performance: 4, faultTolerance: 3, ease: 3 },
  },

  {
    id: 'malla', num: 'TIPO-05', miniType: 'mesh',
    accentColor: '#FF7A00', accentColor2: '#FF5E5B',
    chips: ['Redundante', 'Alta Tolerancia'],
    tagline: 'Redundancia total, cero puntos débiles',
    shortDesc: 'Cada nodo conectado a múltiples otros. Máxima redundancia para infraestructuras de misión crítica.',

    spof: false,  // malla completa no tiene SPOF
    spofDesc: 'En malla completa no existe SPOF. Cada nodo tiene múltiples caminos independientes al resto. La red sobrevive fallos múltiples simultáneos.',
    redundancyLevel: 'alta',
    redundancyNote: 'Malla completa: redundancia máxima absoluta. Malla parcial: redundancia alta pero acotada a los enlaces estratégicos definidos.',
    failureType: 'ninguno',
    failureNote: 'Fallo de nodo o enlace = rerouting automático por protocolos dinámicos (OSPF, BGP) en segundos. La red continúa sin intervención.',
    cableFormula: 'N(N−1)/2 enlaces para malla completa',
    cableNote: 'Ejemplo: 10 nodos = 45 enlaces. 20 nodos = 190 enlaces. Por eso Internet usa malla parcial, no completa.',
    standards: ['OSPF (Open Shortest Path First)', 'IS-IS', 'BGP (Border Gateway Protocol)', 'Wi-Fi Mesh IEEE 802.11s'],
    status: 'vigente',
    statusNote: 'Vigente en backbone de Internet, datacenters de alta disponibilidad y redes militares. Wi-Fi Mesh vigente en entornos domésticos y empresariales.',

    definition: 'En la topología de malla, cada dispositivo tiene conexiones directas con múltiples o todos los demás nodos. La malla completa conecta cada nodo con absolutamente todos los demás; la malla parcial conecta estratégicamente los nodos más críticos, balanceando redundancia y costo.',
    structure: 'Para N nodos en malla completa, cada nodo tiene N-1 conexiones, totalizando N(N-1)/2 enlaces bidireccionales. No existe punto central de fallo; el tráfico puede enrutarse dinámicamente por múltiples caminos simultáneos. La malla parcial selecciona estratégicamente qué pares de nodos se interconectan.',
    howItWorks: 'Los protocolos de enrutamiento dinámico (OSPF, IS-IS, BGP) calculan en tiempo real el camino óptimo hacia cada destino basándose en métricas de costo, latencia y disponibilidad. Si un enlace falla, el protocolo detecta la interrupción y recalcula automáticamente rutas alternativas sin intervención humana.',
    advantages: [
      { title: 'Máxima redundancia de red', desc: 'Múltiples caminos independientes garantizan comunicación continua incluso con fallos múltiples simultáneos.' },
      { title: 'Sin punto único de fallo', desc: 'En malla completa, no existe SPOF. La red sobrevive la pérdida de múltiples nodos.' },
      { title: 'Alto rendimiento y balanceo', desc: 'El tráfico puede distribuirse simultáneamente entre múltiples rutas, maximizando el ancho de banda efectivo.' },
      { title: 'Auto-reparación automática', desc: 'Los protocolos detectan fallos y rerutan automáticamente sin intervención humana.' },
    ],
    disadvantages: [
      { title: 'Costo extremadamente elevado', desc: 'N(N-1)/2 enlaces hace el costo prohibitivo: 10 nodos = 45 enlaces; 20 nodos = 190 enlaces.' },
      { title: 'Complejidad de implementación alta', desc: 'Configuración de enrutamiento dinámico y redundancia requiere ingenieros de red especializados.' },
      { title: 'Escalabilidad muy limitada', desc: 'Cada nuevo nodo en malla completa requiere N nuevas conexiones, haciéndola impráctica a gran escala.' },
      { title: 'Infraestructura física masiva', desc: 'Requiere cantidades enormes de cable, fibra óptica, interfaces y puertos de red en cada nodo.' },
    ],
    applications: ['Backbone global de Internet (ISPs interconectados)', 'Redes militares y de defensa nacional', 'Infraestructura crítica: hospitales, plantas nucleares, sistemas financieros', 'Datacenters de alta disponibilidad', 'Redes mesh WiFi domésticas (malla parcial Wi-Fi 6E)'],
    realExample: 'El backbone de Internet es una malla parcial: los principales ISPs (AT&T, Verizon, Lumen) están interconectados en IXPs (Internet Exchange Points) con múltiples rutas redundantes. La ARPANET original fue diseñada como malla para garantizar comunicaciones militares incluso tras un ataque nuclear.',
    stats: { cost: 1, scalability: 2, performance: 5, faultTolerance: 5, ease: 1 },
  },

  {
    id: 'hibrida', num: 'TIPO-06', miniType: 'hybrid',
    accentColor: '#00E5FF', accentColor2: '#FF4D8D',
    chips: ['Flexible', 'Multi-tipo'],
    tagline: 'Lo mejor de cada mundo, combinado',
    shortDesc: 'Combinación estratégica de múltiples topologías. Estándar en grandes corporaciones e ISPs.',

    spof: false,
    spofDesc: 'Depende de la combinación. El diseño híbrido puede eliminar todos los SPOF si usa malla en el núcleo y redundancia en las capas de distribución.',
    redundancyLevel: 'variable',
    redundancyNote: 'Redundancia diferenciada: malla en segmentos críticos, árbol/estrella en segmentos estándar. Optimización costo-disponibilidad.',
    failureType: 'parcial',
    failureNote: 'Un fallo aislado en cualquier segmento afecta solo a ese segmento según su topología local. El diseño correcto limita el radio de impacto.',
    cableFormula: 'Variable según combinación',
    cableNote: 'Suma de los requisitos de cada topología componente. El diseño híbrido optimiza el cableado por segmento según su criticidad.',
    standards: ['BGP (entre sedes)', 'OSPF (dentro de sede)', 'STP/RSTP (capa de acceso)', 'VLAN IEEE 802.1Q', 'MPLS'],
    status: 'vigente',
    statusNote: 'Arquitectura universal en grandes organizaciones, ISPs, nubes públicas (AWS, Azure, GCP) y redes de defensa. Es la topología real de Internet.',

    definition: 'La topología híbrida combina dos o más topologías base diferentes en una red integrada y cohesiva. Se diseña para aprovechar las ventajas de cada topología componente y minimizar sus debilidades individuales, adaptándose a los requisitos únicos de cada organización.',
    structure: 'Combina segmentos de diferentes topologías interconectados mediante routers o switches Layer 3. Ejemplo clásico: malla completa entre sedes centrales (máxima redundancia), árbol jerárquico dentro de cada sede (escalabilidad), y estrella en cada piso (simplicidad de gestión local).',
    howItWorks: 'Cada segmento funciona según su propia topología con sus protocolos específicos. Los dispositivos de interconexión (routers, switches L3, firewalls) gestionan el tráfico entre segmentos. Protocolos como BGP (entre sedes), OSPF (dentro de sede) y STP (capa de acceso) coordinan la red global.',
    advantages: [
      { title: 'Máxima flexibilidad arquitectural', desc: 'Se adapta a cualquier requisito organizacional, geográfico o de disponibilidad sin restricciones.' },
      { title: 'Optimización por función', desc: 'Cada segmento usa la topología más eficiente para su propósito específico.' },
      { title: 'Fiabilidad diferenciada por criticidad', desc: 'Los segmentos críticos usan malla; los estándar usan árbol o estrella, optimizando el presupuesto.' },
      { title: 'Integración de infraestructura existente', desc: 'Incorpora redes legacy de diferentes tipos sin necesidad de reemplazar infraestructura funcional.' },
    ],
    disadvantages: [
      { title: 'Complejidad de diseño y documentación', desc: 'Planificar, implementar y documentar múltiples topologías interconectadas requiere experiencia avanzada.' },
      { title: 'Mayor costo total de propiedad', desc: 'Necesita hardware heterogéneo, licencias variadas y personal especializado en cada tecnología.' },
      { title: 'Diagnóstico inter-topología complejo', desc: 'Los fallos en las interfaces entre diferentes tipos de topología son los más difíciles de localizar.' },
      { title: 'Gestión multi-dominio', desc: 'Administrar simultáneamente múltiples tipos de red y protocolos requiere un equipo de TI muy especializado.' },
    ],
    applications: ['Grandes corporaciones y empresas multinacionales', 'Proveedores de servicios de Internet (ISPs)', 'Infraestructura de nube pública (AWS, Azure, GCP)', 'Redes hospitalarias, gubernamentales y de defensa', 'Datacenters distribuidos globalmente'],
    realExample: 'La red global de una multinacional: malla entre datacenters en NY, Londres y Tokio (redundancia máxima), árbol Core-Distribution-Access dentro de cada datacenter, estrella en cada oficina regional, y VPN punto a punto para sitios remotos. Esta arquitectura híbrida optimiza cada segmento según sus necesidades reales.',
    stats: { cost: 2, scalability: 5, performance: 5, faultTolerance: 4, ease: 2 },
  },
];

// ================================================================
//  UTILIDADES DE DIBUJO EN CANVAS 2D
//  Funciones auxiliares compartidas por todos los dibujadores de topología.
//  Estas se usan tanto en los mini-canvas de las tarjetas como
//  en el canvas de la sección de introducción.
// ================================================================

// Caché para conversiones hex→RGB (evitar recalcular la misma conversión)
const _rgbCache = {};

// Convierte un color hexadecimal (#RRGGBB o #RGB) a cadena "R,G,B"
// compatible con rgba() de Canvas 2D. Resultado en caché.
export function hexToRgbStr(hex) {
  if (_rgbCache[hex]) return _rgbCache[hex];
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  const s = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  _rgbCache[hex] = s;
  return s;
}

// Despacha el dibujo al dibujador correcto según el tipo de topología
export function drawTopologyOnCanvas(ctx, W, H, type, t) {
  switch (type) {
    case 'star':   _drawStar(ctx, W, H, t);   break;
    case 'bus':    _drawBus(ctx, W, H, t);    break;
    case 'ring':   _drawRing(ctx, W, H, t);   break;
    case 'tree':   _drawTree(ctx, W, H, t);   break;
    case 'mesh':   _drawMesh(ctx, W, H, t);   break;
    case 'hybrid': _drawHybrid(ctx, W, H, t); break;
  }
}

// ── Primitivas de dibujo ──────────────────────────────────────────

// Dibuja un nodo circular con halo exterior semitransparente y glow
function _node(ctx, x, y, r, color) {
  // Halo exterior difuso
  ctx.beginPath();
  ctx.arc(x, y, r * 2.8, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${hexToRgbStr(color)},0.1)`;
  ctx.fill();
  // Círculo central sólido con glow
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowBlur = r * 3;
  ctx.shadowColor = color;
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Igual que _node pero además dibuja una etiqueta de texto debajo
function _nodeLabeled(ctx, x, y, r, color, label) {
  _node(ctx, x, y, r, color);
  if (label) {
    ctx.font = `${Math.max(8, r * 1.2)}px monospace`;
    ctx.fillStyle = `rgba(255,255,255,0.65)`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r + 10);
  }
}

// Dibuja una línea semitransparente entre dos puntos
function _line(ctx, x1, y1, x2, y2, color, alpha = 0.3, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = `rgba(${hexToRgbStr(color)},${alpha})`;
  ctx.lineWidth = width;
  ctx.stroke();
}

// Dibuja un paquete de datos en tránsito entre dos puntos.
// `progress` va de 0.0 (origen) a 1.0 (destino).
// Incluye una estela degradada detrás del paquete.
function _packet(ctx, x1, y1, x2, y2, color, progress) {
  const px = x1 + (x2 - x1) * progress;
  const py = y1 + (y2 - y1) * progress;
  // Calcular inicio de la estela (10% antes del paquete)
  const trail = Math.max(0, progress - 0.1);
  const tx = x1 + (x2 - x1) * trail;
  const ty = y1 + (y2 - y1) * trail;
  // Estela con degradado de transparente a sólido
  const tg = ctx.createLinearGradient(tx, ty, px, py);
  tg.addColorStop(0, `rgba(${hexToRgbStr(color)},0)`);
  tg.addColorStop(1, `rgba(${hexToRgbStr(color)},0.9)`);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(px, py);
  ctx.strokeStyle = tg;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Punto brillante en la cabeza del paquete
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowBlur = 9;
  ctx.shadowColor = color;
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ── Dibujadores específicos por topología ─────────────────────────

// Estrella: hub central + N nodos periféricos + paquetes radiales
function _drawStar(ctx, W, H, t) {
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.34;  // radio de los nodos periféricos
  const n = 5;
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  // Dibujar enlaces y paquetes hacia cada nodo periférico
  nodes.forEach((nd, i) => {
    _line(ctx, cx, cy, nd.x, nd.y, '#FF4D8D', 0.35);
    _packet(ctx, cx, cy, nd.x, nd.y, '#FF7A00', (t * 0.007 + i / n) % 1);
  });
  nodes.forEach(nd => _node(ctx, nd.x, nd.y, 5, '#FF4D8D'));
  // Hub central más grande con etiqueta "SW" (switch)
  _node(ctx, cx, cy, 9, '#FF7A00');
  ctx.font = '8px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('SW', cx, cy + 16);
}

// Bus: cable troncal horizontal + terminadores + nodos en derivaciones alternadas
function _drawBus(ctx, W, H, t) {
  const pad = W * 0.1, y = H / 2;
  const n = 5;
  const nodes = Array.from({ length: n }, (_, i) => ({
    x: pad + (i / (n - 1)) * (W - pad * 2), y
  }));
  // Backbone con degradado de opacidad en los extremos
  const bg = ctx.createLinearGradient(pad, y, W - pad, y);
  bg.addColorStop(0, 'rgba(0,229,255,0)');
  bg.addColorStop(0.1, 'rgba(0,229,255,0.5)');
  bg.addColorStop(0.9, 'rgba(0,229,255,0.5)');
  bg.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.beginPath();
  ctx.moveTo(pad - 8, y); ctx.lineTo(W - pad + 8, y);
  ctx.strokeStyle = bg; ctx.lineWidth = 2;
  ctx.shadowBlur = 8; ctx.shadowColor = '#00E5FF';
  ctx.stroke(); ctx.shadowBlur = 0;

  // Terminadores resistivos en ambos extremos del bus
  [pad - 10, W - pad + 10].forEach(x => {
    ctx.beginPath(); ctx.rect(x - 3, y - 8, 6, 16);
    ctx.fillStyle = 'rgba(0,229,255,0.6)'; ctx.fill();
  });
  ctx.font = '7px monospace';
  ctx.fillStyle = 'rgba(0,229,255,0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('50Ω', pad - 10, y + 22);
  ctx.fillText('50Ω', W - pad + 10, y + 22);

  // Paquete que viaja a lo largo del backbone (de extremo a extremo)
  const px = pad + ((t * 0.008) % 1) * (W - pad * 2);
  ctx.beginPath(); ctx.arc(px, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#00E5FF'; ctx.shadowBlur = 10; ctx.shadowColor = '#00E5FF';
  ctx.fill(); ctx.shadowBlur = 0;

  // Nodos alternados arriba y abajo del backbone
  nodes.forEach((nd, i) => {
    const ny = i % 2 === 0 ? y - 28 : y + 28;
    _line(ctx, nd.x, nd.y, nd.x, ny, '#00E5FF', 0.3);
    _node(ctx, nd.x, ny, 5, '#3B82F6');
  });
}

// Anillo: N nodos en ciclo + token blanco que da vueltas
function _drawRing(ctx, W, H, t) {
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) * 0.35;
  const n = 6;
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  // Círculo guía tenue (indica el camino del anillo)
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,0,122,0.08)'; ctx.lineWidth = 1; ctx.stroke();
  // Enlace entre cada nodo y el siguiente, con paquete en tránsito
  nodes.forEach((nd, i) => {
    const next = nodes[(i + 1) % n];
    _line(ctx, nd.x, nd.y, next.x, next.y, '#FF007A', 0.35);
    _packet(ctx, nd.x, nd.y, next.x, next.y, '#FF4D8D', (t * 0.006 + i / n) % 1);
  });
  // Token circulando continuamente por el anillo (punto blanco)
  const tokenAngle = (t * 0.006) * Math.PI * 2 - Math.PI / 2;
  const tx2 = cx + r * Math.cos(tokenAngle);
  const ty2 = cy + r * Math.sin(tokenAngle);
  ctx.beginPath(); ctx.arc(tx2, ty2, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 8; ctx.shadowColor = '#FF007A';
  ctx.fill(); ctx.shadowBlur = 0;
  nodes.forEach(nd => _node(ctx, nd.x, nd.y, 5.5, '#FF007A'));
}

// Árbol: estructura jerárquica Core → Distribución → Acceso
function _drawTree(ctx, W, H, t) {
  const root = { x: W / 2, y: H * 0.12 };                    // nivel Core (raíz)
  const lvl1 = [{ x: W * 0.28, y: H * 0.45 }, { x: W * 0.72, y: H * 0.45 }]; // Distribución
  const lvl2 = [                                               // nivel Acceso
    { x: W * 0.14, y: H * 0.82 }, { x: W * 0.38, y: H * 0.82 },
    { x: W * 0.62, y: H * 0.82 }, { x: W * 0.86, y: H * 0.82 },
  ];
  // Relaciones padre-hijo: lvl1[0]→lvl2[0,1], lvl1[1]→lvl2[2,3]
  const pairs = [[0, 0], [0, 1], [1, 2], [1, 3]];
  // Enlace Core → Distribución con paquetes descendentes
  lvl1.forEach((nd, i) => {
    _line(ctx, root.x, root.y, nd.x, nd.y, '#3B82F6', 0.4);
    _packet(ctx, root.x, root.y, nd.x, nd.y, '#00E5FF', (t * 0.007 + i * 0.5) % 1);
  });
  // Enlace Distribución → Acceso
  pairs.forEach(([l1i, l2i], i) => {
    const a = lvl1[l1i], b = lvl2[l2i];
    _line(ctx, a.x, a.y, b.x, b.y, '#3B82F6', 0.35);
    _packet(ctx, a.x, a.y, b.x, b.y, '#00E5FF', (t * 0.006 + i * 0.25) % 1);
  });
  // Nodo Core con etiqueta
  _node(ctx, root.x, root.y, 8, '#3B82F6');
  ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'center';
  ctx.fillText('Core', root.x, root.y + 16);
  // Nodos de Distribución con etiqueta
  lvl1.forEach((nd, i) => {
    _node(ctx, nd.x, nd.y, 6, '#3B82F6');
    ctx.font = '7px monospace'; ctx.fillText('Dist', nd.x, nd.y + 13);
  });
  // Nodos de Acceso (más pequeños, sin etiqueta)
  lvl2.forEach(nd => _node(ctx, nd.x, nd.y, 4.5, '#00E5FF'));
}

// Malla: N nodos con todas las conexiones posibles (N(N-1)/2 enlaces)
function _drawMesh(ctx, W, H, t) {
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) * 0.33;
  const n = 5;
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  let pIdx = 0;
  // Conectar cada par de nodos (malla completa)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      _line(ctx, nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y, '#FF7A00', 0.2);
      // Solo mostrar paquete en 1 de cada 3 enlaces para no saturar visualmente
      if ((pIdx % 3) === 0) {
        _packet(ctx, nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y, '#FF5E5B', (t * 0.005 + pIdx * 0.17) % 1);
      }
      pIdx++;
    }
  }
  nodes.forEach(nd => _node(ctx, nd.x, nd.y, 6, '#FF7A00'));
  // Fórmula de enlaces como recordatorio visual
  ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(255,122,0,0.55)'; ctx.textAlign = 'center';
  ctx.fillText('N(N−1)/2', cx, cy);
}

// Híbrida: núcleo en malla (4 hubs interconectados) + estrella desde cada hub
function _drawHybrid(ctx, W, H, t) {
  const cx = W / 2, cy = H * 0.42;
  const spoke = Math.min(W, H) * 0.22;  // radio para los hubs del núcleo
  const n = 4;
  // Posicionar los 4 hubs centrales en círculo
  const hubs = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + spoke * Math.cos(a), y: cy + spoke * Math.sin(a) };
  });
  // Conexiones desde el centro hacia cada hub (topología estrella interna)
  hubs.forEach((nd, i) => {
    _line(ctx, cx, cy, nd.x, nd.y, '#FF4D8D', 0.35);
    _packet(ctx, cx, cy, nd.x, nd.y, '#FF7A00', (t * 0.008 + i * 0.25) % 1);
  });
  // Conexiones entre hubs adyacentes (anillo/malla parcial del núcleo)
  hubs.forEach((nd, i) => {
    const next = hubs[(i + 1) % n];
    _line(ctx, nd.x, nd.y, next.x, next.y, '#00E5FF', 0.3);
    _packet(ctx, nd.x, nd.y, next.x, next.y, '#00E5FF', (t * 0.006 + i * 0.25) % 1);
  });
  // Nodo central (hub de hubs) y hubs periféricos
  _node(ctx, cx, cy, 8, '#FF4D8D');
  hubs.forEach(nd => _node(ctx, nd.x, nd.y, 5.5, '#00E5FF'));
}
