# NEOTOPIA v4.0 — Topologías de Red 

Enciclopedia visual e interactiva sobre las principales topologías de redes de computadoras. Desarrollada como proyecto universitario para la asignatura de Redes, con enfoque educativo y diseño futurista.

---

## ¿De qué trata la página?

NEOTOPIA es una **landing page educativa** que explica de forma visual e interactiva las seis topologías de red más importantes:

| #  | Topología         | Característica principal                                           |
| -- | ------------------ | ------------------------------------------------------------------- |
| 01 | **Estrella** | Hub central, topología dominante en LAN modernas                   |
| 02 | **Bus**      | Cable coaxial compartido, legacy pero vigente en CAN bus industrial |
| 03 | **Anillo**   | Token Ring, control de acceso por token, FDDI en telecomunicaciones |
| 04 | **Árbol**   | Jerarquía Core-Distribution-Access, estándar corporativo          |
| 05 | **Malla**    | Redundancia máxima, backbone de Internet                           |
| 06 | **Híbrida** | Combinación de topologías, universal en grandes organizaciones    |

### Contenido por topología

Para cada topología la página muestra:

- Definición técnica y estructura detallada
- Cómo funciona la transmisión de datos
- Ventajas y desventajas
- Análisis de **SPOF** (Single Point of Failure) y redundancia
- Fórmula de cableado requerido
- Estándares y protocolos asociados (IEEE 802.x, BGP, OSPF, etc.)
- Aplicaciones reales en la industria
- Ejemplo del mundo real
- Métricas comparativas: Costo · Escalabilidad · Rendimiento · Tolerancia a fallos · Facilidad

### Secciones de la página

1. **Hero** — Presentación con esfera 3D y partículas interactivas
2. **Introducción** — Canvas animado con paquetes de datos en tránsito
3. **Grilla de topologías** — 6 tarjetas con mini-animaciones y panel de detalle
4. **Características** — Conceptos clave de redes
5. **Redundancia** — Demostración visual en tiempo real de Estrella vs Malla ante fallos
6. **Tabla comparativa** — Comparación de las 6 topologías en 5 métricas
7. **¿Cuál usar?** — Recomendaciones según el escenario de uso
8. **Footer** — Créditos y referencias

---

## Tecnologías utilizadas

### Core del proyecto

| Tecnología                       | Versión | Uso                                      |
| --------------------------------- | -------- | ---------------------------------------- |
| **Vite**                    | ^8.0     | Bundler y servidor de desarrollo con HMR |
| **Vanilla JS (ES Modules)** | ES2022   | Lógica de la aplicación sin frameworks |
| **HTML5 + CSS3**            | —       | Estructura y estilos                     |

### Librerías

| Librería             | Versión | Uso                                                        |
| --------------------- | -------- | ---------------------------------------------------------- |
| **Three.js**    | ^0.184   | Escenas 3D de cada topología y esfera decorativa del hero |
| **GSAP**        | ^3.15    | Animaciones de entrada y efectos con ScrollTrigger         |
| **Lenis**       | ^1.0.42  | Scroll suave en escritorio (omitido en móviles táctiles) |
| **tsparticles** | ^4.0.5   | Motor de partículas (dependencia instalada)               |

### Tipografías (Google Fonts)

- **Orbitron** — Titulares (estética futurista/tecnológica)
- **Rajdhani** — Texto secundario (técnico y compacto)
- **Inter** — Cuerpo de texto (máxima legibilidad)

### Paleta de colores

```css
--bg:     #050816  /* Fondo azul oscuro profundo */
--cyan:   #00E5FF  /* Acento principal */
--blue:   #3B82F6  /* Azul tecnológico */
--pink:   #FF4D8D  /* Topología Estrella */
--orange: #FF7A00  /* Topología Bus / Malla */
--neon:   #94fc17  /* Verde neón (partículas, hover) */
```

---

## Arquitectura del código

```
topologias-red-futuristas/
├── index.html              # Estructura HTML principal (~2300 líneas)
├── package.json            # Dependencias y scripts npm
├── src/
│   ├── main.js             # Punto de entrada: coordina todos los módulos
│   ├── style.css           # Sistema de diseño completo (~1520 líneas)
│   ├── topology-data.js    # Base de datos de las 6 topologías + dibujadores 2D
│   ├── topology-view.js    # Panel overlay de detalle (HTML dinámico + 3D)
│   └── topology-3d.js      # Motor Three.js con calidad adaptativa por dispositivo
└── public/
    ├── favicon.svg
    └── icons.svg
```

### Descripción de cada módulo

**`main.js`** — Orquestador principal. Inicializa: sistema de partículas con física de muelles, scroll suave Lenis, barra de navegación, canvas de introducción, canvas de redundancia, mini-canvas de tarjetas, efectos hover, tabla comparativa y animaciones GSAP con ScrollTrigger.

**`topology-data.js`** — Base de datos educativa. Contiene el objeto `TOPOLOGIES` con todos los campos de contenido, y las funciones `drawTopologyOnCanvas` y primitivas (`_drawStar`, `_drawBus`, etc.) que dibujan las animaciones 2D en los canvas pequeños.

**`topology-view.js`** — Controlador del panel overlay. Gestiona la apertura/cierre, genera el HTML dinámico del detalle, instancia la escena Three.js y anima las barras de métricas.

**`topology-3d.js`** — Motor 3D. Clase `Topology3DScene` con detección de capacidad del dispositivo, OrbitControls, raycaster para hover/clic en nodos, paquetes animados y limpieza total de recursos GPU.

---

## Instalación y uso

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo con recarga automática
npm run dev

# Compilar para producción
npm run build

# Previsualizar la versión compilada
npm run preview
```

El servidor de desarrollo se abre en `http://localhost:5173` por defecto.

---

## Características de diseño

- **Glassmorphism** — Fondos con desenfoque y opacidad en tarjetas y navbar
- **Responsive design** — Adaptable desde 380 px hasta pantallas 4K
- **Modo oscuro permanente** — Tema oscuro como identidad visual
- **Animaciones 60 fps** — Canvas 2D para topologías pequeñas, Three.js para escenas 3D
- **Accesibilidad** — Atributos ARIA, navegación por teclado, foco visible
- **Rendimiento adaptativo** — Menos partículas, menor DPR y geometrías simplificadas en móviles

---

## Materia y contexto académico

Proyecto desarrollado para la asignatura de **Redes de Computadoras** en la universidad. El objetivo es presentar de forma visual e interactiva los conceptos de topologías de red cubriendo: definiciones técnicas, análisis de fallos (SPOF), redundancia, estándares IEEE y aplicaciones industriales reales.
