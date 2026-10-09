// Shared layout for the hero "solar cycle" visual. Both the server-rendered
// fallback (SVG poster + label positions) and the three.js scene read from
// here, so the static frame and the first WebGL frame line up exactly.

export type Vec3 = [number, number, number];

const DEG = Math.PI / 180;

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

export const GROUND = {
  title: "Grassroots Ecosystem",
  description:
    "Builders, meetups, and labs across Fort Worth and North Texas sprout and link up peer to peer, growing the tech ecosystem from the ground up.",
  color: "#A3E635",
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
  aspect: 1,
  fov: 24,
  camera: [0, 8.4, 15.5] as Vec3,
  target: [0, -1.35, 0] as Vec3,
  orbitRadius: 3.35,
  sunRadius: 0.78,
  planetRadius: 0.27,
  sunColor: "#FBBF24",
  /** Label offset from a planet's center, in planet radii plus a fixed gap. */
  labelGap: 1.6,
};

// --- City ---------------------------------------------------------------
// The system floats over a map of Fort Worth: downtown sits directly under
// the core, north points away from the camera, and every place below is a
// real lat/lng projected onto the ground plane.

export const CITY = {
  y: -2.1,
  origin: { lat: 32.7555, lng: -97.3308 },
  /** Miles per world unit. */
  scale: 2.5,
  /**
   * Ground detail fades out toward these distances from downtown. The near
   * side fades sooner so the map is gone before it reaches the frame edge.
   */
  extent: { x: 4, near: 3.8, far: 4.8 },
  coordinates: "32.7555° N · 97.3308° W",
};

const MILES_PER_DEG_LAT = 69;
const MILES_PER_DEG_LNG = MILES_PER_DEG_LAT * Math.cos(CITY.origin.lat * DEG);

/** How much ground detail shows at a point: 1 around downtown, 0 at the edge. */
export function groundFade(x: number, z: number) {
  const { extent } = CITY;
  const r = Math.hypot(x / extent.x, z / (z > 0 ? extent.near : extent.far));
  const t = Math.min(1, Math.max(0, (r - 0.7) / 0.3));
  return 1 - t * t * (3 - 2 * t);
}

/** Projects a lat/lng onto the ground plane as [x, z]. */
export function geo(lat: number, lng: number): [number, number] {
  return [
    ((lng - CITY.origin.lng) * MILES_PER_DEG_LNG) / CITY.scale,
    (-(lat - CITY.origin.lat) * MILES_PER_DEG_LAT) / CITY.scale,
  ];
}

const geoPath = (points: [number, number][]) => points.map(([lat, lng]) => geo(lat, lng));

export const ROADS = {
  loop820: geoPath([
    [32.84, -97.43],
    [32.845, -97.35],
    [32.83, -97.235],
    [32.75, -97.21],
    [32.675, -97.22],
    [32.665, -97.33],
    [32.67, -97.43],
    [32.75, -97.465],
  ]),
  i35w: geoPath([
    [33.0, -97.318],
    [32.5, -97.322],
  ]),
  i30: geoPath([
    [32.726, -97.62],
    [32.742, -97.33],
    [32.755, -97.04],
  ]),
};

// The Trinity's two forks meet just northwest of downtown, then the West
// Fork carries on east toward Dallas.
const CONFLUENCE: [number, number] = [32.765, -97.337];
export const RIVER = {
  westFork: geoPath([
    [32.83, -97.5],
    [32.79, -97.42],
    [32.785, -97.395],
    [32.78, -97.37],
    [32.774, -97.35],
    CONFLUENCE,
    [32.77, -97.325],
    [32.769, -97.31],
    [32.76, -97.29],
    [32.77, -97.27],
    [32.785, -97.24],
    [32.79, -97.2],
    [32.8, -97.15],
    [32.79, -97.1],
    [32.78, -97.02],
  ]),
  clearFork: geoPath([
    [32.62, -97.5],
    [32.66, -97.45],
    [32.69, -97.42],
    [32.715, -97.395],
    [32.735, -97.37],
    [32.75, -97.355],
    CONFLUENCE,
  ]),
};

export interface CityNode {
  x: number;
  z: number;
  /** Index of the pillar standing over this part of the city; -1 for the downtown root. */
  pillar: number;
}

const nearestPillar = (x: number, z: number) => {
  const angle = Math.atan2(-z, x) / DEG;
  let best = 0;
  let bestDistance = Infinity;
  PILLARS.forEach((pillar, i) => {
    const d = Math.abs(((angle - pillar.angle + 540) % 360) - 180);
    if (d < bestDistance) [best, bestDistance] = [i, d];
  });
  return best;
};

// Grassroots nodes: builders, meetups, and labs across the metro. The first
// one is downtown, the root under the core.
export const NODES: CityNode[] = geoPath([
  [32.7555, -97.3308], // Downtown
  [32.789, -97.347], // Stockyards
  [32.735, -97.327], // Near Southside
  [32.749, -97.367], // Cultural District
  [32.709, -97.363], // TCU
  [32.725, -97.272], // Polytechnic
  [32.805, -97.445], // Lake Worth
  [32.86, -97.364], // Saginaw
  [32.8, -97.27], // Haltom City
  [32.834, -97.229], // North Richland Hills
  [32.673, -97.461], // Benbrook
  [32.69, -97.27], // Forest Hill
  [32.759, -97.458], // White Settlement
  [32.735, -97.2], // Handley
  [32.89, -97.29], // Far North
  [32.84, -97.16], // Hurst
]).map(([x, z], i) => ({ x, z, pillar: i === 0 ? -1 : nearestPillar(x, z) }));

// A peer-to-peer mesh rather than hub-and-spoke: each node links to its two
// nearest neighbors.
export const LINKS: [number, number][] = (() => {
  const seen = new Set<string>();
  const links: [number, number][] = [];
  NODES.forEach((a, i) => {
    NODES.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.z - b.z) }))
      .filter(({ j }) => j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
      .forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        links.push([i, j]);
      });
  });
  return links;
})();

/**
 * Smooths a polyline into a Catmull-Rom curve, sampled roughly every `step`
 * world units so faded lines interpolate evenly.
 */
export function smoothPath(points: [number, number][], closed = false, step = 0.12): [number, number][] {
  const n = points.length;
  const at = (i: number) => (closed ? points[(i + n) % n] : points[Math.min(Math.max(i, 0), n - 1)]);
  const out: [number, number][] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const samples = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const curve = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (p2[k] - p0[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
          (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t * t * t);
      out.push([curve(0), curve(1)]);
    }
  }
  out.push(closed ? out[0] : points[n - 1]);
  return out;
}

/** Where the ground label sits: on the south side of Loop 820. */
export const GROUND_LABEL: Vec3 = [0, CITY.y, 3.2];

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
