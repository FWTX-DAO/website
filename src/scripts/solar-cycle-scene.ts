import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  ColorManagement,
  DoubleSide,
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
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { PILLARS, SOLAR, orbitPoint } from "@lib/solar-cycle";

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
  onActiveChange: (index: number) => void;
  /** A planet (or the core, -1) was clicked or tapped on the canvas. */
  onSelect: (index: number) => void;
}

export interface SolarCycle {
  /** Holds the cycle on a pillar (or -1 for the core); null resumes it. */
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
  const softPointsMaterial = (opacity: number) =>
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
        fragmentShader: SOFT_POINT_FRAGMENT,
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
  const dustCount = 650;
  const dust = { position: [] as number[], aSize: [] as number[], aColor: [] as number[], aAlpha: [] as number[] };
  const warm = new Color("#FDE68A");
  const cool = new Color("#93C5FD");
  for (let i = 0; i < dustCount; i++) {
    const r = 1.1 + Math.sqrt(Math.random()) * 4.6;
    const a = Math.random() * TAU;
    const spread = (Math.random() + Math.random() + Math.random() - 1.5) * (0.04 + r * 0.02);
    dust.position.push(Math.cos(a) * r, spread, -Math.sin(a) * r);
    dust.aSize.push(0.018 + Math.random() * 0.03);
    const c = warm.clone().lerp(cool, Math.min(1, (r - 1.1) / 2.6));
    dust.aColor.push(c.r, c.g, c.b);
    dust.aAlpha.push(0.25 + Math.random() * 0.55);
  }
  const dustGeometry = track(new BufferGeometry());
  dustGeometry.setAttribute("position", new Float32BufferAttribute(dust.position, 3));
  dustGeometry.setAttribute("aSize", new Float32BufferAttribute(dust.aSize, 1));
  dustGeometry.setAttribute("aColor", new Float32BufferAttribute(dust.aColor, 3));
  dustGeometry.setAttribute("aAlpha", new Float32BufferAttribute(dust.aAlpha, 1));
  const dustPoints = new Points(dustGeometry, softPointsMaterial(0.5));
  system.add(dustPoints);

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
  const flowGeometry = track(new BufferGeometry());
  for (const [name, values] of Object.entries(flow)) {
    flowGeometry.setAttribute(name, new Float32BufferAttribute(values, name === "position" ? 3 : 1));
  }
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
    const spokeGeometry = track(new BufferGeometry());
    spokeGeometry.setAttribute(
      "position",
      new Float32BufferAttribute([x * SOLAR.sunRadius * 1.1, 0, z * SOLAR.sunRadius * 1.1, x * (R - SOLAR.planetRadius * 1.8), 0, z * (R - SOLAR.planetRadius * 1.8)], 3),
    );
    spokeGeometry.setAttribute("aT", new Float32BufferAttribute([0, 1], 1));
    const spokeMaterial = track(
      new ShaderMaterial({
        uniforms: { uColorA: { value: new Color(SOLAR.sunColor) }, uColorB: { value: color }, uTime: { value: 0 }, uActive: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aT;
          varying float vT;
          void main() {
            vT = aT;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uTime;
          uniform float uActive;
          varying float vT;
          void main() {
            float f = fract(vT * 5.0 - uTime * 0.45);
            float dash = smoothstep(0.0, 0.3, f) * (1.0 - smoothstep(0.3, 0.45, f));
            float fade = smoothstep(0.0, 0.1, vT) * smoothstep(1.0, 0.86, vT);
            gl_FragColor = vec4(mix(uColorA, uColorB, vT), fade * (0.1 + dash * (0.22 + uActive * 0.6)));
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    system.add(new Line(spokeGeometry, spokeMaterial));

    return { group, body, material, ring, ringMaterial, halo, haloMaterial, spokeMaterial, active: 0, flare: 0 };
  });

  // --- State ---------------------------------------------------------------
  let width = 0;
  let height = 0;
  let labelWidths: number[] = labels.map(() => 0);
  let time = 0;
  let flowOffset = 0;
  let cycleTime = DWELL * 0.5;
  let pinned: number | null = null;
  let hovered: number | null = null;
  let displayed = -2;
  let lastArrival = -1;
  let coreActive = 0;
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
    }
    camera.updateMatrixWorld();

    const state = cycleState();
    const focus = hovered ?? pinned;
    const active = focus ?? state.leg;
    if (state.leg !== lastArrival && !holding) {
      lastArrival = state.leg;
      if (!reducedMotion) planets[state.leg].flare = 1;
    }
    if (active !== displayed) {
      displayed = active;
      opts.onActiveChange(active);
    }

    sunMaterial.uniforms.uTime.value = time;
    const k = reducedMotion ? 1 : Math.min(1, dt * 6);
    coreActive += ((active === -1 ? 1 : 0) - coreActive) * k;
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
    });

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
      if (!reducedMotion && index !== null && index >= 0) planets[index].flare = 1;
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
