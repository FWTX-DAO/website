// Shared layout for the hero "solar cycle" visual. Both the server-rendered
// fallback (SVG poster + label positions) and the three.js scene read from
// here, so the static frame and the first WebGL frame line up exactly.

export type Vec3 = [number, number, number];

export interface Pillar {
  id: string;
  title: string;
  description: string;
  color: string;
  /** Position on the orbit in degrees (0 = right, 90 = far side). */
  angle: number;
  /** Which side of the planet the floating label sits on. */
  labelSide: "above" | "below";
}

export const CORE = {
  title: "Decentralized Governance",
  description: "Members steer the DAO together under a public constitution.",
};

// Listed in cycle order. Energy flows clockwise on screen, each pillar
// feeding the next: inclusion → collective decisions → open information →
// new ideas → wider inclusion.
export const PILLARS: Pillar[] = [
  {
    id: "inclusion",
    title: "Democratic Inclusion",
    description: "Promotes equal participation and representation.",
    color: "#22D3EE",
    angle: 135,
    labelSide: "above",
  },
  {
    id: "community",
    title: "Community-Driven Approach",
    description: "Emphasizes collective decision-making and participation.",
    color: "#A78BFA",
    angle: 45,
    labelSide: "above",
  },
  {
    id: "transparency",
    title: "Transparency",
    description: "Ensures open and accessible information for all stakeholders.",
    color: "#34D399",
    angle: -45,
    labelSide: "below",
  },
  {
    id: "innovation",
    title: "Innovation",
    description: "Fosters new ideas and technological advancements.",
    color: "#60A5FA",
    angle: -135,
    labelSide: "below",
  },
];

export const SOLAR = {
  /** Width / height of the frame. The container uses the same aspect ratio. */
  aspect: 4 / 3,
  fov: 19.5,
  camera: [0, 7.8, 14.8] as Vec3,
  target: [0, -0.35, 0] as Vec3,
  orbitRadius: 3.35,
  sunRadius: 0.78,
  planetRadius: 0.27,
  sunColor: "#FBBF24",
  /** Label offset from a planet's center, in planet radii plus a fixed gap. */
  labelGap: 1.6,
};

const DEG = Math.PI / 180;

export function orbitPoint(angleDeg: number, radius = SOLAR.orbitRadius, y = 0): Vec3 {
  const a = angleDeg * DEG;
  return [Math.cos(a) * radius, y, -Math.sin(a) * radius];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Projects a world point the same way THREE.PerspectiveCamera + lookAt does,
 * returning its position as a percentage of the frame plus its view depth.
 */
export function projectToFrame(point: Vec3) {
  const forward = normalize(sub(SOLAR.target, SOLAR.camera));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const d = sub(point, SOLAR.camera);
  const depth = dot(d, forward);
  const t = Math.tan((SOLAR.fov * DEG) / 2);
  const ndcX = dot(d, right) / (depth * t * SOLAR.aspect);
  const ndcY = dot(d, up) / (depth * t);
  return { x: (ndcX + 1) * 50, y: (1 - ndcY) * 50, depth };
}

/** Approximate on-screen radius of a sphere, as a percentage of frame height. */
export function projectedRadius(radius: number, depth: number) {
  return (radius / (depth * Math.tan((SOLAR.fov * DEG) / 2))) * 50;
}
