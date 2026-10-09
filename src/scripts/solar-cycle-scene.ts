import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  ColorManagement,
  DoubleSide,
  DynamicDrawUsage,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  LineSegments,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  BORDER_LINES,
  COUNTY_SHAPES,
  GROUND,
  LINKS,
  MAP,
  NODES,
  PILLARS,
  SOLAR,
  TARRANT_OUTLINE,
  densify,
  groundFade,
  insidePolygon,
  orbitPoint,
  type MapNode,
  type Vec3,
} from "@lib/solar-cycle";

// Colors are authored as CSS hex values and blended like CSS, so skip
// three's linear workflow entirely.
ColorManagement.enabled = false;

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const DWELL = 1.6;
const TRAVEL = 2.4;
const LEG = DWELL + TRAVEL;
const CYCLE = LEG * PILLARS.length;

export interface SolarCycleOptions {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  labels: HTMLElement[];
  coreLabel: HTMLElement;
  reducedMotion: boolean;
  /** A pillar index, -1 for the core, or -2 for the grassroots ground. */
  onActiveChange: (index: number) => void;
  /** A planet (or the core, -1) was clicked or tapped on the canvas. */
  onSelect: (index: number) => void;
}

export interface SolarCycle {
  /** Holds the cycle on a pillar (-1 for the core, -2 for the ground); null resumes it. */
  setPinned(index: number | null): void;
  dispose(): void;
}

const NOISE = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.02 + 3.1;
      a *= 0.5;
    }
    return v;
  }
`;

const SOFT_POINT_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, a * a * vAlpha * uOpacity);
  }
`;

// A crisp center dot inside a soft halo, for places on the map.
const NODE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float halo = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.15, 0.09, d);
    gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.55), (halo * halo * 0.6 + core) * vAlpha * uOpacity);
  }
`;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const VEC3_ATTRIBUTES = new Set(["position", "aColor", "aFrom", "aTo"]);

function glowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,0.55)");
  g.addColorStop(0.45, "rgba(255,255,255,0.14)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

function circlePoints(radius: number, segments: number) {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * TAU;
    pts.push(Math.cos(a) * radius, 0, -Math.sin(a) * radius);
  }
  return new Float32BufferAttribute(pts, 3);
}

const lineMaterial = (color: string, opacity: number) =>
  new LineBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });

export function mountSolarCycle(opts: SolarCycleOptions): SolarCycle | null {
  const { stage, canvas, labels, coreLabel, reducedMotion } = opts;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new Scene();
  const camera = new PerspectiveCamera(SOLAR.fov, SOLAR.aspect, 0.1, 100);
  const baseCamera = new Vector3(...SOLAR.camera);
  const target = new Vector3(...SOLAR.target);
  camera.position.copy(baseCamera);
  camera.lookAt(target);

  const system = new Group();
  scene.add(system);

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(d: T) => (disposables.push(d), d);
  const glow = track(glowTexture());

  const pointUniforms = {
    uPixelRatio: { value: renderer.getPixelRatio() },
    uScale: { value: 1 },
  };

  const geometryFrom = (attributes: Record<string, number[]>) => {
    const geometry = track(new BufferGeometry());
    for (const [name, values] of Object.entries(attributes)) {
      geometry.setAttribute(name, new Float32BufferAttribute(values, VEC3_ATTRIBUTES.has(name) ? 3 : 1));
    }
    return geometry;
  };

  // A line with dashes travelling from its first point to its last. `ends`
  // fades the line in and out over that fraction of its length.
  const flowLine = (
    points: Vector3[],
    opts: {
      colorA: string;
      colorB?: string;
      dashes?: number;
      dashLength?: number;
      speed?: number;
      base?: number;
      dash?: number;
      boost?: number;
      ends?: [number, number];
      fade?: (p: Vector3) => number;
    },
  ) => {
    const { colorA, colorB = colorA, speed = 0.45, base = 0.1, dash = 0.22, boost = 0.6, ends = [0.1, 0.14] } = opts;
    const distances = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
    const length = distances[distances.length - 1];
    const dashes = opts.dashLength ? length / opts.dashLength : (opts.dashes ?? 5);
    const geometry = track(new BufferGeometry()).setFromPoints(points);
    geometry.setAttribute("aT", new Float32BufferAttribute(distances.map((d) => d / length), 1));
    geometry.setAttribute("aFade", new Float32BufferAttribute(points.map((p) => opts.fade?.(p) ?? 1), 1));
    const material = track(
      new ShaderMaterial({
        uniforms: {
          uColorA: { value: new Color(colorA) },
          uColorB: { value: new Color(colorB) },
          uTime: { value: 0 },
          uActive: { value: 0 },
          uEnds: { value: ends },
        },
        vertexShader: /* glsl */ `
          attribute float aT;
          attribute float aFade;
          varying float vT;
          varying float vFade;
          void main() {
            vT = aT;
            vFade = aFade;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uTime;
          uniform float uActive;
          uniform vec2 uEnds;
          varying float vT;
          varying float vFade;
          void main() {
            float f = fract(vT * ${dashes.toFixed(2)} - uTime * ${speed.toFixed(3)});
            float d = smoothstep(0.0, 0.3, f) * (1.0 - smoothstep(0.3, 0.45, f));
            float fadeIn = uEnds.x > 0.0 ? smoothstep(0.0, uEnds.x, vT) : 1.0;
            float fadeOut = uEnds.y > 0.0 ? smoothstep(1.0, 1.0 - uEnds.y, vT) : 1.0;
            float a = fadeIn * fadeOut * vFade * (${base.toFixed(3)} + d * (${dash.toFixed(3)} + uActive * ${boost.toFixed(3)}));
            gl_FragColor = vec4(mix(uColorA, uColorB, vT), a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    return { line: new Line(geometry, material), material };
  };

  const flatRing = (inner: number, outer: number, color: string, opacity: number) => {
    const geometry = track(new RingGeometry(inner, outer, 64));
    geometry.rotateX(-Math.PI / 2);
    const material = track(
      new MeshBasicMaterial({ color, transparent: true, opacity, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }),
    );
    return new Mesh(geometry, material);
  };

  // --- Sun: Decentralized Governance -------------------------------------
  const sunMaterial = track(
    new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vObj;
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        void main() {
          vObj = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormalV = normalize(normalMatrix * normal);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uBoost;
        varying vec3 vObj;
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        ${NOISE}
        void main() {
          vec3 p = normalize(vObj);
          float n = fbm(p * 2.6 + vec3(0.0, uTime * 0.08, uTime * 0.05));
          float cells = fbm(p * 6.5 - vec3(uTime * 0.12, 0.0, uTime * 0.07));
          float heat = clamp(n * 1.15 + cells * 0.45 - 0.32 + uBoost * 0.15, 0.0, 1.0);
          vec3 col = mix(vec3(0.72, 0.22, 0.04), vec3(0.98, 0.6, 0.13), smoothstep(0.1, 0.6, heat));
          col = mix(col, vec3(1.0, 0.93, 0.7), smoothstep(0.55, 0.95, heat));
          float fres = pow(1.0 - clamp(dot(normalize(vNormalV), normalize(vViewDir)), 0.0, 1.0), 2.2);
          col = mix(col, vec3(1.0, 0.86, 0.52), fres * 0.65);
          float scan = smoothstep(0.93, 1.0, abs(sin(asin(p.y) * 16.0 + uTime * 0.5)));
          col += vec3(1.0, 0.8, 0.4) * scan * 0.07;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  const sun = new Mesh(track(new SphereGeometry(SOLAR.sunRadius, 64, 48)), sunMaterial);
  system.add(sun);

  const corona = new Sprite(
    track(new SpriteMaterial({ map: glow, color: SOLAR.sunColor, blending: AdditiveBlending, depthWrite: false, opacity: 0.85 })),
  );
  corona.scale.setScalar(SOLAR.sunRadius * 4.2);
  const coronaWide = new Sprite(
    track(new SpriteMaterial({ map: glow, color: "#F59E0B", blending: AdditiveBlending, depthWrite: false, opacity: 0.32 })),
  );
  coronaWide.scale.setScalar(SOLAR.sunRadius * 9);
  system.add(corona, coronaWide);

  // A slowly turning wireframe lattice: the decentralized network around the core.
  const lattice = new Group();
  const latticeGeometry = track(new IcosahedronGeometry(SOLAR.sunRadius * 1.5, 1));
  lattice.add(new LineSegments(track(new EdgesGeometry(latticeGeometry)), track(lineMaterial("#FCD34D", 0.16))));
  const nodePositions: number[] = [];
  const seen = new Set<string>();
  const pos = latticeGeometry.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nodePositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  }
  const nodeCount = nodePositions.length / 3;
  const nodeGeometry = track(new BufferGeometry());
  nodeGeometry.setAttribute("position", new Float32BufferAttribute(nodePositions, 3));
  nodeGeometry.setAttribute("aSize", new Float32BufferAttribute(new Array(nodeCount).fill(0.09), 1));
  nodeGeometry.setAttribute("aColor", new Float32BufferAttribute(new Array(nodeCount).fill([1, 0.85, 0.45]).flat(), 3));
  nodeGeometry.setAttribute("aAlpha", new Float32BufferAttribute(new Array(nodeCount).fill(0.9), 1));
  const softPointsMaterial = (opacity: number, fragmentShader = SOFT_POINT_FRAGMENT) =>
    track(
      new ShaderMaterial({
        uniforms: { ...pointUniforms, uOpacity: { value: opacity } },
        vertexShader: /* glsl */ `
          attribute float aSize;
          attribute vec3 aColor;
          attribute float aAlpha;
          uniform float uPixelRatio;
          uniform float uScale;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * uPixelRatio * uScale / -mv.z;
            vColor = aColor;
            vAlpha = aAlpha;
          }
        `,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
  lattice.add(new Points(nodeGeometry, softPointsMaterial(0.55)));
  system.add(lattice);

  // --- Orbit HUD ----------------------------------------------------------
  const R = SOLAR.orbitRadius;
  const orbitGeometry = track(new BufferGeometry());
  orbitGeometry.setAttribute("position", circlePoints(R, 256));
  system.add(new LineLoop(orbitGeometry, track(lineMaterial("#60A5FA", 0.3))));

  const outerGeometry = track(new BufferGeometry());
  outerGeometry.setAttribute("position", circlePoints(R * 1.2, 256));
  system.add(new LineLoop(outerGeometry, track(lineMaterial("#93C5FD", 0.08))));

  const ticks: number[] = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const major = deg % 45 === 0;
    const [x0, , z0] = orbitPoint(deg, R * (major ? 1.15 : 1.18));
    const [x1, , z1] = orbitPoint(deg, R * (major ? 1.25 : 1.22));
    ticks.push(x0, 0, z0, x1, 0, z1);
  }
  const tickGeometry = track(new BufferGeometry());
  tickGeometry.setAttribute("position", new Float32BufferAttribute(ticks, 3));
  system.add(new LineSegments(tickGeometry, track(lineMaterial("#93C5FD", 0.14))));

  const radials: number[] = [];
  for (let deg = 0; deg < 360; deg += 30) {
    const [x0, , z0] = orbitPoint(deg, R * 0.4);
    const [x1, , z1] = orbitPoint(deg, R * 1.12);
    radials.push(x0, 0, z0, x1, 0, z1);
  }
  const radialGeometry = track(new BufferGeometry());
  radialGeometry.setAttribute("position", new Float32BufferAttribute(radials, 3));
  system.add(new LineSegments(radialGeometry, track(lineMaterial("#60A5FA", 0.05))));

  const innerGeometry = track(new BufferGeometry());
  innerGeometry.setAttribute("position", circlePoints(R * 0.6, 192));
  const innerRing = new LineLoop(
    innerGeometry,
    track(new LineDashedMaterial({ color: "#FBBF24", dashSize: 0.1, gapSize: 0.12, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false })),
  );
  innerRing.computeLineDistances();
  system.add(innerRing);

  // --- Dust disc ----------------------------------------------------------
  const dustCount = 520;
  const dust = { position: [] as number[], aSize: [] as number[], aColor: [] as number[], aAlpha: [] as number[] };
  const warm = new Color("#FDE68A");
  const cool = new Color("#93C5FD");
  for (let i = 0; i < dustCount; i++) {
    const r = 1.1 + Math.sqrt(Math.random()) * 3.6;
    const a = Math.random() * TAU;
    const spread = (Math.random() + Math.random() + Math.random() - 1.5) * (0.04 + r * 0.02);
    dust.position.push(Math.cos(a) * r, spread, -Math.sin(a) * r);
    dust.aSize.push(0.018 + Math.random() * 0.03);
    const c = warm.clone().lerp(cool, Math.min(1, (r - 1.1) / 2.6));
    dust.aColor.push(c.r, c.g, c.b);
    dust.aAlpha.push(0.25 + Math.random() * 0.55);
  }
  const dustPoints = new Points(geometryFrom(dust), softPointsMaterial(0.5));
  system.add(dustPoints);

  // --- Map: North Texas, centered on Tarrant County -------------------------
  // Census county lines under the system with Tarrant lit up in the middle,
  // and grassroots nodes across the region that link up peer to peer while
  // new ones keep sprouting.
  const region = new Group();
  region.position.y = MAP.y;
  system.add(region);

  const inTarrant = (x: number, z: number) => insidePolygon([x, z], TARRANT_OUTLINE);

  // Hex dot grid, brightest inside Tarrant.
  const DOT = 0.16;
  const dots = { position: [] as number[], aSize: [] as number[], aColor: [] as number[], aAlpha: [] as number[] };
  const dotColor = new Color("#93C5FD");
  const rows = Math.ceil(MAP.extent.far / (DOT * 0.866));
  const cols = Math.ceil(MAP.extent.x / DOT) + 1;
  for (let row = -rows; row <= rows; row++) {
    const z = row * DOT * 0.866;
    for (let col = -cols; col <= cols; col++) {
      const x = (col + (row & 1) * 0.5) * DOT;
      const fade = groundFade(x, z);
      if (fade < 0.02) continue;
      dots.position.push(x, 0, z);
      dots.aSize.push(0.05);
      dots.aColor.push(dotColor.r, dotColor.g, dotColor.b);
      dots.aAlpha.push(fade * (inTarrant(x, z) ? 0.85 : 0.3));
    }
  }
  const dotsMaterial = softPointsMaterial(0.6);
  region.add(new Points(geometryFrom(dots), dotsMaterial));

  // County lines fade with the map through per-vertex alpha. Fading the color
  // alone would leave opaque dark lines on the transparent canvas.
  const borderColor = new Color("#93C5FD");
  const borderPositions: number[] = [];
  const borderColors: number[] = [];
  for (const line of BORDER_LINES) {
    const points = densify(line);
    for (let i = 1; i < points.length; i++) {
      for (const [x, z] of [points[i - 1], points[i]]) {
        borderPositions.push(x, 0, z);
        borderColors.push(borderColor.r, borderColor.g, borderColor.b, groundFade(x, z) * 0.62);
      }
    }
  }
  const borderGeometry = geometryFrom({ position: borderPositions });
  borderGeometry.setAttribute("color", new Float32BufferAttribute(borderColors, 4));
  const borderMaterial = track(
    new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }),
  );
  region.add(new LineSegments(borderGeometry, borderMaterial));

  // Tarrant: a faint fill and a live perimeter.
  const tarrantShape = new Shape(TARRANT_OUTLINE.map(([x, z]) => new Vector2(x, z)));
  const tarrantGeometry = track(new ShapeGeometry(tarrantShape));
  tarrantGeometry.rotateX(Math.PI / 2);
  const tarrantFill = new Mesh(
    tarrantGeometry,
    track(new MeshBasicMaterial({ color: "#3B82F6", transparent: true, opacity: 0.07, side: DoubleSide, blending: AdditiveBlending, depthWrite: false })),
  );
  const tarrantEdge = flowLine(
    densify(TARRANT_OUTLINE).map(([x, z]) => new Vector3(x, 0.005, z)),
    { colorA: "#BFDBFE", dashLength: 0.22, speed: 0.4, base: 0.42, dash: 0.4, boost: 0.3, ends: [0, 0] },
  );
  region.add(tarrantFill, tarrantEdge.line);

  // County names lie flat on the ground, reading north-up.
  const MONO = '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace';
  const groundText = (text: string, height: number, opacity: number) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const px = 64;
    const font = `600 ${px}px ${MONO}`;
    const spacing = px * 0.32;
    const chars = [...text.toUpperCase()];
    ctx.font = font;
    const widths = chars.map((c) => ctx.measureText(c).width);
    canvas.width = Math.ceil(widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1) + 16);
    canvas.height = Math.ceil(px * 1.3);
    ctx.font = font;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    let x = 8;
    chars.forEach((c, i) => {
      ctx.fillText(c, x, canvas.height / 2);
      x += widths[i] + spacing;
    });
    const texture = track(new CanvasTexture(canvas));
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const geometry = track(new PlaneGeometry((height * canvas.width) / canvas.height, height));
    geometry.rotateX(-Math.PI / 2);
    const material = track(
      new MeshBasicMaterial({ map: texture, color: "#BFDBFE", transparent: true, opacity, blending: AdditiveBlending, depthWrite: false }),
    );
    return new Mesh(geometry, material);
  };
  let tarrantLabel: Mesh | null = null;
  for (const county of COUNTY_SHAPES) {
    if (!county.label) continue;
    const [x, z] = county.label;
    const label = county.isTarrant
      ? groundText(county.name, 0.3, 0.75)
      : groundText(county.name, 0.24, 0.4 * groundFade(x, z));
    label.position.set(x, 0.01, z);
    region.add(label);
    if (county.isTarrant) tarrantLabel = label;
  }

  const nodeColor = (node: MapNode) => new Color(node.pillar < 0 ? GROUND.color : PILLARS[node.pillar].color);

  const linkGeometry = geometryFrom({
    position: LINKS.flatMap(([a, b]) => [NODES[a], NODES[b]].flatMap((n) => [n.x, 0.01, n.z])),
  });
  linkGeometry.setAttribute(
    "color",
    new Float32BufferAttribute(
      LINKS.flatMap(([a, b]) => [NODES[a], NODES[b]].flatMap((n) => [...nodeColor(n).toArray(), 0.8 * groundFade(n.x, n.z)])),
      4,
    ),
  );
  const linkMaterial = track(
    new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false }),
  );
  region.add(new LineSegments(linkGeometry, linkMaterial));

  // Node glow by channel: pillars 0-3, the downtown root, then the whole ground.
  const nodeGlow = { value: [0, 0, 0, 0, 0, 0] };
  const nodeMaterial = track(
    new ShaderMaterial({
      uniforms: { ...pointUniforms, uOpacity: { value: 1 }, uTime: { value: 0 }, uGlow: nodeGlow },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aChannel;
        attribute float aSeed;
        attribute float aFade;
        uniform float uPixelRatio;
        uniform float uScale;
        uniform float uTime;
        uniform float uGlow[6];
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float glow = max(uGlow[int(aChannel)], uGlow[5]);
          float twinkle = 0.85 + 0.15 * sin(uTime * 1.6 + aSeed * 40.0);
          vColor = aColor;
          vAlpha = (0.55 + 0.6 * glow) * twinkle * aFade;
          gl_PointSize = aSize * (1.0 + 0.45 * glow) * uPixelRatio * uScale / -mv.z;
        }
      `,
      fragmentShader: NODE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  region.add(
    new Points(
      geometryFrom({
        position: NODES.flatMap((n) => [n.x, 0.02, n.z]),
        aColor: NODES.flatMap((n) => nodeColor(n).toArray()),
        aSize: NODES.map((n) => (n.pillar < 0 ? 0.3 : 0.2)),
        aChannel: NODES.map((n) => (n.pillar < 0 ? 4 : n.pillar)),
        aSeed: NODES.map(() => Math.random()),
        aFade: NODES.map((n) => 0.35 + 0.65 * groundFade(n.x, n.z)),
      }),
      nodeMaterial,
    ),
  );

  // Fort Worth: where the core puts down roots.
  const fortWorth = NODES[0];
  const rootRing = flatRing(0.22, 0.24, GROUND.color, 0.45);
  const rootDashGeometry = track(new BufferGeometry());
  rootDashGeometry.setAttribute("position", circlePoints(0.38, 96));
  const rootDash = new LineLoop(
    rootDashGeometry,
    track(new LineDashedMaterial({ color: GROUND.color, dashSize: 0.06, gapSize: 0.07, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false })),
  );
  rootDash.computeLineDistances();
  rootRing.position.set(fortWorth.x, 0, fortWorth.z);
  rootDash.position.set(fortWorth.x, 0, fortWorth.z);
  region.add(rootRing, rootDash);

  const trunk = flowLine([new Vector3(fortWorth.x, MAP.y, fortWorth.z), new Vector3(0, -SOLAR.sunRadius * 1.05, 0)], {
    colorA: GROUND.color,
    colorB: SOLAR.sunColor,
    dashes: 4,
    speed: 0.5,
    base: 0.14,
    dash: 0.32,
    boost: 0.5,
  });
  system.add(trunk.line);

  // Ripples spread across the map when a part of the city lights up.
  const rippleGeometry = track(new RingGeometry(0.9, 1, 64));
  rippleGeometry.rotateX(-Math.PI / 2);
  const ripples = Array.from({ length: 18 }, () => {
    const material = track(
      new MeshBasicMaterial({ transparent: true, opacity: 0, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }),
    );
    const mesh = new Mesh(rippleGeometry, material);
    mesh.visible = false;
    region.add(mesh);
    return { mesh, material, start: -1, strength: 1, size: 0.5 };
  });
  let rippleCursor = 0;
  const ripple = (x: number, z: number, color: string | Color, delay = 0, size = 0.4, strength = 1) => {
    if (reducedMotion) return;
    const r = ripples[rippleCursor++ % ripples.length];
    r.mesh.position.set(x, 0.005, z);
    r.material.color.set(color);
    Object.assign(r, { start: time + delay, size, strength });
  };

  // Sprouts: pop-up nodes that appear anywhere in the metro, reach out to
  // their nearest neighbor, then fade.
  const SPROUTS = 4;
  const SPROUT_LIFE = 6.5;
  const sprouts = Array.from({ length: SPROUTS }, () => ({ x: 0, z: 0, target: 0, born: -Infinity, linked: false }));
  const lime = new Color(GROUND.color);
  const sproutGeometry = geometryFrom({
    position: new Array(SPROUTS * 3).fill(0),
    aSize: new Array(SPROUTS).fill(0),
    aColor: new Array(SPROUTS).fill(lime.toArray()).flat(),
    aAlpha: new Array(SPROUTS).fill(0),
  });
  const sproutPoints = new Points(sproutGeometry, softPointsMaterial(1, NODE_FRAGMENT));
  sproutPoints.frustumCulled = false;
  const sproutLinkGeometry = geometryFrom({ position: new Array(SPROUTS * 6).fill(0) });
  sproutLinkGeometry.setAttribute(
    "color",
    new Float32BufferAttribute(new Array(SPROUTS * 2).fill([lime.r, lime.g, lime.b, 0]).flat(), 4),
  );
  const sproutLinks = new LineSegments(
    sproutLinkGeometry,
    track(new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false })),
  );
  sproutLinks.frustumCulled = false;
  for (const geometry of [sproutGeometry, sproutLinkGeometry]) {
    for (const attribute of Object.values(geometry.attributes)) (attribute as Float32BufferAttribute).setUsage(DynamicDrawUsage);
  }
  region.add(sproutLinks, sproutPoints);

  // --- Packets: grassroots energy moving up and across ----------------------
  // Channels: 0-3 rise from each part of the city to its pillar, 4 rises from
  // downtown into the core, 5-8 cross the mesh in each quadrant, 9 heads
  // into downtown.
  const packetGain = { value: new Array(10).fill(0) };
  const packets = {
    position: [] as number[],
    aFrom: [] as number[],
    aTo: [] as number[],
    aColor: [] as number[],
    aSeed: [] as number[],
    aSpeed: [] as number[],
    aSize: [] as number[],
    aChannel: [] as number[],
    aArc: [] as number[],
  };
  const addPacket = (from: Vec3, to: Vec3, color: Color, channel: number, speed: number, size: number, arc = 0) => {
    packets.position.push(...from);
    packets.aFrom.push(...from);
    packets.aTo.push(...to);
    packets.aColor.push(color.r, color.g, color.b);
    packets.aSeed.push(Math.random());
    packets.aSpeed.push(speed * (0.8 + Math.random() * 0.4));
    packets.aSize.push(size);
    packets.aChannel.push(channel);
    packets.aArc.push(arc);
  };
  for (let i = 0; i < 10; i++) addPacket([fortWorth.x, MAP.y, fortWorth.z], [0, -SOLAR.sunRadius, 0], lime, 4, 0.36, 0.07);
  PILLARS.forEach((pillar, i) => {
    const [x, , z] = orbitPoint(pillar.angle);
    for (let k = 0; k < 4; k++) addPacket([x, MAP.y, z], [x, -SOLAR.planetRadius * 1.9, z], new Color(pillar.color), i, 0.4, 0.065);
  });
  for (const [a, b] of LINKS) {
    const [from, to] = Math.random() < 0.5 ? [NODES[a], NODES[b]] : [NODES[b], NODES[a]];
    const y = MAP.y + 0.02;
    addPacket([from.x, y, from.z], [to.x, y, to.z], nodeColor(to), to.pillar < 0 ? 9 : 5 + to.pillar, 0.22, 0.055, 0.1);
  }
  const packetMaterial = track(
    new ShaderMaterial({
      uniforms: { ...pointUniforms, uOpacity: { value: 1 }, uTime: { value: 0 }, uGain: packetGain },
      vertexShader: /* glsl */ `
        attribute vec3 aFrom;
        attribute vec3 aTo;
        attribute vec3 aColor;
        attribute float aSeed;
        attribute float aSpeed;
        attribute float aSize;
        attribute float aChannel;
        attribute float aArc;
        uniform float uPixelRatio;
        uniform float uScale;
        uniform float uTime;
        uniform float uGain[10];
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float t = fract(uTime * aSpeed + aSeed);
          float hump = sin(t * 3.14159265);
          vec3 pos = mix(aFrom, aTo, t);
          pos.y += hump * aArc;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          vColor = aColor;
          vAlpha = hump * uGain[int(aChannel)];
          gl_PointSize = aSize * uPixelRatio * uScale / -mv.z;
        }
      `,
      fragmentShader: SOFT_POINT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  const packetPoints = new Points(geometryFrom(packets), packetMaterial);
  packetPoints.frustumCulled = false;
  system.add(packetPoints);

  // --- Virtuous-cycle stream: particles flowing clockwise around the orbit,
  // tinted by whichever pillars they are travelling between. ---------------
  const step = ((PILLARS[0].angle - PILLARS[1].angle + 360) % 360) * DEG;
  const flowCount = 260;
  const flow = { position: [] as number[], aAngle: [] as number[], aRadius: [] as number[], aSize: [] as number[], aSpeed: [] as number[], aSeed: [] as number[] };
  for (let i = 0; i < flowCount; i++) {
    flow.position.push(0, (Math.random() - 0.5) * 0.05, 0);
    flow.aAngle.push(Math.random() * TAU);
    flow.aRadius.push(R + (Math.random() - 0.5) * 0.14);
    flow.aSize.push(0.035 + Math.random() * 0.05);
    flow.aSpeed.push(0.8 + Math.random() * 0.4);
    flow.aSeed.push(Math.random());
  }
  const flowGeometry = geometryFrom(flow);
  const flowMaterial = track(
    new ShaderMaterial({
      uniforms: {
        ...pointUniforms,
        uOpacity: { value: 1 },
        uTime: { value: 0 },
        uFlow: { value: 0 },
        uPulse: { value: PILLARS[0].angle * DEG },
        uPulseOn: { value: 0 },
        uStart: { value: PILLARS[0].angle * DEG },
        uStep: { value: step },
        uColors: { value: PILLARS.map((p) => new Color(p.color)) },
      },
      vertexShader: /* glsl */ `
        attribute float aAngle;
        attribute float aRadius;
        attribute float aSize;
        attribute float aSpeed;
        attribute float aSeed;
        uniform float uPixelRatio;
        uniform float uScale;
        uniform float uTime;
        uniform float uFlow;
        uniform float uPulse;
        uniform float uPulseOn;
        uniform float uStart;
        uniform float uStep;
        uniform vec3 uColors[${PILLARS.length}];
        varying vec3 vColor;
        varying float vAlpha;
        const float TAU = 6.28318530718;
        void main() {
          float a = aAngle - uFlow * aSpeed;
          vec3 pos = vec3(cos(a) * aRadius, position.y, -sin(a) * aRadius);
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;

          float s = mod((uStart - a) / uStep, ${PILLARS.length}.0);
          int i = int(min(floor(s), ${PILLARS.length - 1}.0));
          int j = i + 1;
          if (j >= ${PILLARS.length}) j = 0;
          vColor = mix(uColors[i], uColors[j], smoothstep(0.0, 1.0, fract(s)));

          float behind = mod(a - uPulse, TAU);
          float trail = uPulseOn * exp(-behind * 3.0) * step(behind, 2.2);
          float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 40.0);
          vAlpha = 0.32 * twinkle + trail * 1.5;
          gl_PointSize = aSize * (1.0 + trail * 1.6) * uPixelRatio * uScale / -mv.z;
        }
      `,
      fragmentShader: SOFT_POINT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  system.add(new Points(flowGeometry, flowMaterial));

  // --- Pulse: the bright packet that carries the cycle pillar to pillar ---
  const pulse = new Group();
  const pulseHalo = new Sprite(track(new SpriteMaterial({ map: glow, color: PILLARS[0].color, blending: AdditiveBlending, depthWrite: false, opacity: 0.9 })));
  pulseHalo.scale.setScalar(0.75);
  const pulseCore = new Sprite(track(new SpriteMaterial({ map: glow, color: "#FFFFFF", blending: AdditiveBlending, depthWrite: false, opacity: 0.95 })));
  pulseCore.scale.setScalar(0.22);
  pulse.add(pulseHalo, pulseCore);
  pulse.visible = !reducedMotion;
  system.add(pulse);

  // --- Pillar planets ------------------------------------------------------
  const sunPosition = new Vector3();
  const planets = PILLARS.map((pillar, index) => {
    const group = new Group();
    group.position.set(...orbitPoint(pillar.angle));
    const color = new Color(pillar.color);

    const material = track(
      new ShaderMaterial({
        uniforms: { uColor: { value: color }, uActive: { value: 0 }, uTime: { value: 0 }, uSunPos: { value: sunPosition } },
        vertexShader: /* glsl */ `
          varying vec3 vNormalW;
          varying vec3 vPosW;
          varying vec3 vObj;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vPosW = w.xyz;
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vObj = position;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uActive;
          uniform float uTime;
          uniform vec3 uSunPos;
          varying vec3 vNormalW;
          varying vec3 vPosW;
          varying vec3 vObj;
          ${NOISE}
          void main() {
            vec3 n = normalize(vNormalW);
            vec3 l = normalize(uSunPos - vPosW);
            vec3 v = normalize(cameraPosition - vPosW);
            float diff = max(dot(n, l), 0.0);
            float fres = pow(1.0 - max(dot(n, v), 0.0), 2.4);
            vec3 p = normalize(vObj);
            float bands = 0.5 + 0.5 * sin(p.y * 13.0 + fbm(p * 3.0 + uTime * 0.05) * 4.0);
            vec3 body = mix(uColor * 0.3, uColor * 0.85, bands * 0.6);
            vec3 col = body * (0.38 + 0.85 * diff) + vec3(1.0, 0.86, 0.6) * pow(diff, 10.0) * 0.3;
            col += uColor * fres * (0.75 + uActive * 0.9);
            float lon = atan(p.z, p.x);
            float lat = asin(clamp(p.y, -1.0, 1.0));
            float grid = max(smoothstep(0.97, 1.0, abs(sin(lon * 6.0))), smoothstep(0.97, 1.0, abs(sin(lat * 6.0))));
            col += uColor * grid * (0.08 + uActive * 0.3);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    );
    const body = new Mesh(track(new SphereGeometry(SOLAR.planetRadius, 48, 32)), material);
    body.rotation.z = 0.25 * (index % 2 ? 1 : -1);

    const ringMaterial = track(new MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }));
    const ring = new Mesh(track(new RingGeometry(SOLAR.planetRadius * 1.55, SOLAR.planetRadius * 1.66, 96)), ringMaterial);
    ring.rotation.x = -Math.PI / 2 + 0.35;
    ring.rotation.y = (index - 1.5) * 0.3;

    const haloMaterial = track(new SpriteMaterial({ map: glow, color, blending: AdditiveBlending, depthWrite: false, opacity: 0.4 }));
    const halo = new Sprite(haloMaterial);
    halo.scale.setScalar(SOLAR.planetRadius * 5);

    group.add(halo, body, ring);
    system.add(group);

    // Governance spoke: energy flowing from the core out to each pillar.
    const [x, , z] = orbitPoint(pillar.angle, 1);
    const spoke = flowLine(
      [
        new Vector3(x * SOLAR.sunRadius * 1.1, 0, z * SOLAR.sunRadius * 1.1),
        new Vector3(x * (R - SOLAR.planetRadius * 1.8), 0, z * (R - SOLAR.planetRadius * 1.8)),
      ],
      { colorA: SOLAR.sunColor, colorB: pillar.color },
    );
    system.add(spoke.line);

    // Root: the pillar's own corner of the city, feeding energy up to it.
    const [fx, , fz] = orbitPoint(pillar.angle);
    const foot = flatRing(0.15, 0.165, pillar.color, 0.4);
    foot.position.set(fx, 0.01, fz);
    region.add(foot);
    const root = flowLine([new Vector3(fx, MAP.y, fz), new Vector3(fx, -SOLAR.planetRadius * 1.9, fz)], {
      colorA: pillar.color,
      dashes: 4,
      speed: 0.4,
      base: 0.07,
      dash: 0.16,
      boost: 0.55,
    });
    system.add(root.line);

    return {
      group,
      body,
      material,
      ring,
      ringMaterial,
      halo,
      haloMaterial,
      spokeMaterial: spoke.material,
      rootMaterial: root.material,
      foot: { x: fx, z: fz, material: foot.material as MeshBasicMaterial },
      active: 0,
      flare: 0,
    };
  });

  const rippleQuadrant = (index: number) => {
    const { foot } = planets[index];
    ripple(foot.x, foot.z, PILLARS[index].color, 0, 0.55, 1);
    NODES.forEach((node) => {
      if (node.pillar !== index) return;
      ripple(node.x, node.z, PILLARS[index].color, Math.hypot(node.x - foot.x, node.z - foot.z) * 0.15, 0.32, 0.75);
    });
  };

  // --- State ---------------------------------------------------------------
  let width = 0;
  let height = 0;
  let labelWidths: number[] = labels.map(() => 0);
  let time = 0;
  let flowOffset = 0;
  let cycleTime = DWELL * 0.5;
  let pinned: number | null = null;
  let hovered: number | null = null;
  let displayed: number | null = null;
  let lastArrival = -1;
  let coreActive = 0;
  let groundActive = 0;
  let groundWasActive = false;
  let nextSprout = 1.2;
  let nextAmbient = 2;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const projected = PILLARS.map(() => ({ x: 0, y: 0, r: 0 }));
  const sunProjected = { x: 0, y: 0, r: 0 };
  const tmp = new Vector3();
  const worldPos = new Vector3();
  const tanHalf = Math.tan((SOLAR.fov * DEG) / 2);

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function cycleState() {
    const leg = Math.floor(cycleTime / LEG) % PILLARS.length;
    const u = cycleTime % LEG;
    const from = PILLARS[leg].angle * DEG;
    const progress = u < DWELL ? 0 : ease((u - DWELL) / TRAVEL);
    return { leg, angle: from - step * progress, sinceArrival: u };
  }

  function project(world: Vector3, radius: number, out: { x: number; y: number; r: number }) {
    tmp.copy(world).applyMatrix4(camera.matrixWorldInverse);
    const depth = -tmp.z;
    tmp.copy(world).project(camera);
    out.x = (tmp.x + 1) * 0.5 * width;
    out.y = (1 - tmp.y) * 0.5 * height;
    out.r = (radius / (depth * tanHalf)) * 0.5 * height;
  }

  function placeLabels() {
    PILLARS.forEach((pillar, i) => {
      const p = projected[i];
      const gap = p.r * SOLAR.labelGap + 4;
      // Keep the label inside the frame on narrow screens.
      const half = labelWidths[i] / 2 + 6;
      const x = half * 2 < width ? Math.min(Math.max(p.x, half), width - half) : p.x;
      labels[i].style.transform =
        pillar.labelSide === "above"
          ? `translate3d(${x}px, ${p.y - gap}px, 0) translate(-50%, -100%)`
          : `translate3d(${x}px, ${p.y + gap}px, 0) translate(-50%, 0)`;
    });
    coreLabel.style.transform = `translate3d(${sunProjected.x}px, ${sunProjected.y + sunProjected.r + 6}px, 0) translate(-50%, 0)`;
  }

  function spawnSprout() {
    const slot = sprouts.find((s) => time - s.born > SPROUT_LIFE);
    if (!slot) return;
    // Anywhere in the metro, not only where nodes already are.
    const r = 0.7 + Math.sqrt(Math.random()) * 2.6;
    const a = Math.random() * TAU;
    slot.x = Math.cos(a) * r;
    slot.z = Math.sin(a) * r * 0.9;
    let best = Infinity;
    NODES.forEach((node, i) => {
      const d = Math.hypot(node.x - slot.x, node.z - slot.z);
      if (d < best) [best, slot.target] = [d, i];
    });
    slot.born = time;
    slot.linked = false;
    ripple(slot.x, slot.z, GROUND.color, 0, 0.3, 0.9);
  }

  function updateSprouts() {
    const position = sproutGeometry.getAttribute("position") as Float32BufferAttribute;
    const size = sproutGeometry.getAttribute("aSize") as Float32BufferAttribute;
    const alpha = sproutGeometry.getAttribute("aAlpha") as Float32BufferAttribute;
    const linkPosition = sproutLinkGeometry.getAttribute("position") as Float32BufferAttribute;
    const linkColor = sproutLinkGeometry.getAttribute("color") as Float32BufferAttribute;
    sprouts.forEach((s, i) => {
      const age = time - s.born;
      const live = age < SPROUT_LIFE;
      const grow = smoothstep(0, 0.5, age);
      const fade = live ? grow * smoothstep(SPROUT_LIFE, SPROUT_LIFE - 1.4, age) : 0;
      const reach = ease(Math.min(1, Math.max(0, (age - 0.3) / 0.9)));
      const target = NODES[s.target];
      if (live && reach >= 1 && !s.linked) {
        s.linked = true;
        ripple(target.x, target.z, GROUND.color, 0, 0.22, 0.6);
      }
      position.setXYZ(i, s.x, 0.02, s.z);
      size.setX(i, 0.17 * (1 + (1 - grow) * 0.8));
      alpha.setX(i, fade);
      linkPosition.setXYZ(i * 2, s.x, 0.01, s.z);
      linkPosition.setXYZ(i * 2 + 1, s.x + (target.x - s.x) * reach, 0.01, s.z + (target.z - s.z) * reach);
      linkColor.setW(i * 2, fade * 0.6);
      linkColor.setW(i * 2 + 1, fade * 0.25);
    });
    for (const attribute of [position, size, alpha, linkPosition, linkColor]) attribute.needsUpdate = true;
  }

  function updateRipples() {
    for (const r of ripples) {
      const age = (time - r.start) / 1.8;
      r.mesh.visible = r.start >= 0 && age >= 0 && age <= 1;
      if (!r.mesh.visible) continue;
      r.mesh.scale.setScalar(0.03 + r.size * (1 - (1 - age) ** 3));
      r.material.opacity = (1 - age) ** 2 * 0.6 * r.strength;
    }
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    labelWidths = labels.map((label) => label.offsetWidth);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    pointUniforms.uScale.value = height / (2 * tanHalf);
  }

  function update(dt: number) {
    time += dt;
    const holding = pinned !== null || hovered !== null;
    if (!reducedMotion) {
      if (!holding) cycleTime = (cycleTime + dt) % CYCLE;
      flowOffset += dt * 0.12;
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
      camera.position.set(baseCamera.x + pointer.x * 0.9, baseCamera.y - pointer.y * 0.45, baseCamera.z);
      camera.lookAt(target);
      system.rotation.y = Math.sin(time * 0.1) * 0.035;
      lattice.rotation.y += dt * 0.08;
      lattice.rotation.x = Math.sin(time * 0.07) * 0.2;
      sun.rotation.y += dt * 0.04;
      innerRing.rotation.y -= dt * 0.05;
      dustPoints.rotation.y += dt * 0.012;
      rootDash.rotation.y += dt * 0.1;
      if (time > nextSprout) {
        spawnSprout();
        nextSprout = time + 1.3 + Math.random() * 1.3;
      }
      if (time > nextAmbient) {
        const node = NODES[1 + Math.floor(Math.random() * (NODES.length - 1))];
        ripple(node.x, node.z, nodeColor(node), 0, 0.24, 0.45);
        nextAmbient = time + 1.2 + Math.random() * 1.2;
      }
    }
    camera.updateMatrixWorld();
    system.updateMatrixWorld();

    const state = cycleState();
    const focus = hovered ?? pinned;
    const active = focus ?? state.leg;
    if (state.leg !== lastArrival && !holding) {
      lastArrival = state.leg;
      if (!reducedMotion) {
        planets[state.leg].flare = 1;
        rippleQuadrant(state.leg);
      }
    }
    if (active !== displayed) {
      displayed = active;
      opts.onActiveChange(active);
    }

    sunMaterial.uniforms.uTime.value = time;
    const k = reducedMotion ? 1 : Math.min(1, dt * 6);
    coreActive += ((active === -1 ? 1 : 0) - coreActive) * k;
    groundActive += ((active === -2 ? 1 : 0) - groundActive) * k;
    if (active === -2 && !groundWasActive) {
      NODES.forEach((node) => ripple(node.x, node.z, nodeColor(node), Math.hypot(node.x, node.z) * 0.14, 0.32, 0.8));
    }
    groundWasActive = active === -2;
    sunMaterial.uniforms.uBoost.value = coreActive;
    corona.material.opacity = 0.8 + Math.sin(time * 1.3) * 0.06 + coreActive * 0.15;
    coronaWide.scale.setScalar(SOLAR.sunRadius * (9 + Math.sin(time * 0.8) * 0.4 + coreActive * 1.5));

    flowMaterial.uniforms.uTime.value = time;
    flowMaterial.uniforms.uFlow.value = flowOffset;
    flowMaterial.uniforms.uPulse.value = state.angle;
    flowMaterial.uniforms.uPulseOn.value = reducedMotion || holding ? 0 : 1;

    const [px, , pz] = orbitPoint(state.angle / DEG);
    pulse.position.set(px, 0, pz);
    pulse.visible = !reducedMotion && !holding;
    pulseHalo.material.color.set(PILLARS[state.leg].color);
    pulseHalo.scale.setScalar(0.7 + Math.sin(time * 6) * 0.05);

    system.getWorldPosition(sunPosition);
    planets.forEach((planet, i) => {
      planet.active += ((i === active ? 1 : 0) - planet.active) * k;
      planet.flare = Math.max(0, planet.flare - dt * 0.9);
      const a = planet.active;
      const f = planet.flare * planet.flare;
      planet.material.uniforms.uActive.value = Math.min(1.4, a + f * 0.6);
      planet.material.uniforms.uTime.value = time;
      planet.spokeMaterial.uniforms.uTime.value = time;
      planet.spokeMaterial.uniforms.uActive.value = a;
      planet.body.rotation.y += dt * 0.25;
      planet.body.scale.setScalar(1 + a * 0.18 + f * 0.12);
      planet.ring.rotation.z += dt * (0.2 + a * 0.6);
      planet.ring.scale.setScalar(1 + a * 0.2);
      planet.ringMaterial.opacity = 0.32 + a * 0.5;
      planet.halo.scale.setScalar(SOLAR.planetRadius * (5 + a * 2.2 + f * 4));
      planet.haloMaterial.opacity = 0.32 + a * 0.35 + f * 0.4;
      planet.group.position.y = reducedMotion ? 0 : Math.sin(time * 0.9 + i * 1.7) * 0.05;
      planet.rootMaterial.uniforms.uTime.value = time;
      planet.rootMaterial.uniforms.uActive.value = a + f * 0.5;
      planet.foot.material.opacity = 0.35 + a * 0.45;
      nodeGlow.value[i] = Math.min(1, a + f * 0.5);
      packetGain.value[i] = 0.1 + a * 1.1 + f * 0.6;
      packetGain.value[5 + i] = 0.4 + a * 0.6 + groundActive * 0.6;
    });

    // The city: brighter when the ground itself is in focus.
    nodeGlow.value[4] = Math.max(coreActive, groundActive);
    nodeGlow.value[5] = groundActive;
    packetGain.value[4] = 0.55 + coreActive * 0.6 + groundActive * 0.5;
    packetGain.value[9] = 0.5 + groundActive * 0.6 + coreActive * 0.3;
    nodeMaterial.uniforms.uTime.value = time;
    packetMaterial.uniforms.uTime.value = time;
    trunk.material.uniforms.uTime.value = time;
    trunk.material.uniforms.uActive.value = Math.max(coreActive, groundActive);
    tarrantEdge.material.uniforms.uTime.value = time;
    tarrantEdge.material.uniforms.uActive.value = groundActive;
    (tarrantFill.material as MeshBasicMaterial).opacity = 0.07 + groundActive * 0.08;
    if (tarrantLabel) (tarrantLabel.material as MeshBasicMaterial).opacity = 0.75 + groundActive * 0.25;
    dotsMaterial.uniforms.uOpacity.value = 0.6 + groundActive * 0.35;
    borderMaterial.opacity = 0.85 + groundActive * 0.15;
    linkMaterial.opacity = 0.6 + groundActive * 0.4;
    (rootRing.material as MeshBasicMaterial).opacity = 0.45 + Math.max(coreActive, groundActive) * 0.4;
    updateSprouts();
    updateRipples();

    planets.forEach((planet, i) => {
      project(planet.group.getWorldPosition(worldPos), SOLAR.planetRadius, projected[i]);
    });
    project(worldPos.copy(sunPosition), SOLAR.sunRadius, sunProjected);
    placeLabels();
  }

  function render(dt: number) {
    update(dt);
    renderer.render(scene, camera);
  }

  // --- Loop & lifecycle ----------------------------------------------------
  let frame = 0;
  let last = 0;
  let inView = true;
  let contextLost = false;

  const tick = (now: number) => {
    frame = 0;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    render(dt);
    schedule();
  };
  const schedule = () => {
    if (reducedMotion || frame || !inView || document.hidden || contextLost) return;
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  };
  const renderStill = () => {
    if (reducedMotion && !contextLost) render(0);
  };

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (reducedMotion) renderStill();
  });
  resizeObserver.observe(stage);

  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) schedule();
    else stop();
  });
  intersection.observe(stage);

  const onVisibility = () => (document.hidden ? stop() : schedule());
  document.addEventListener("visibilitychange", onVisibility);

  const hitTest = (event: PointerEvent) => {
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let hit: number | null = null;
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      if (Math.hypot(p.x - x, p.y - y) < Math.max(p.r * 2.4, 22)) hit = i;
    }
    if (hit === null && Math.hypot(sunProjected.x - x, sunProjected.y - y) < sunProjected.r * 1.2) hit = -1;
    return { hit, x: x / rect.width - 0.5, y: y / rect.height - 0.5 };
  };
  const onPointerMove = (event: PointerEvent) => {
    const { hit, x, y } = hitTest(event);
    pointer.tx = x;
    pointer.ty = y;
    if (event.pointerType === "mouse" && hit !== hovered) {
      hovered = hit;
      stage.style.cursor = hit === null ? "" : "pointer";
      renderStill();
    }
  };
  const onPointerLeave = () => {
    pointer.tx = 0;
    pointer.ty = 0;
    if (hovered !== null) {
      hovered = null;
      stage.style.cursor = "";
      renderStill();
    }
  };
  const onClick = (event: MouseEvent) => {
    const { hit } = hitTest(event as PointerEvent);
    if (hit !== null) opts.onSelect(hit);
  };
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("click", onClick);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    stop();
    stage.dataset.webgl = "lost";
    [...labels, coreLabel].forEach((label) => (label.style.transform = ""));
  };
  const onContextRestored = () => {
    contextLost = false;
    stage.dataset.webgl = "ready";
    schedule();
    renderStill();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  resize();
  render(0);
  schedule();

  return {
    setPinned(index) {
      if (index !== null && index >= 0) cycleTime = index * LEG + DWELL * 0.5;
      pinned = index;
      if (index !== null && index >= 0) lastArrival = index;
      if (!reducedMotion && index !== null && index >= 0) {
        planets[index].flare = 1;
        rippleQuadrant(index);
      }
      renderStill();
    },
    dispose() {
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
