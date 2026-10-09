// Shared layout for the hero "solar cycle" visual. Both the server-rendered
// fallback (SVG poster + label positions) and the three.js scene read from
// here, so the static frame and the first WebGL frame line up exactly.

import { BORDERS, COUNTIES, TARRANT_FIPS } from "./north-texas-counties";

export type Vec3 = [number, number, number];

const DEG = Math.PI / 180;

export interface Pillar {
  id: string;
  title: string;
  /** Fits the narrow labels on phones. */
  short: string;
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
    "Builders, meetups, and labs across Tarrant County and North Texas sprout and link up peer to peer, growing the tech ecosystem from the ground up.",
  color: "#A3E635",
};

// Listed in cycle order. Energy flows clockwise on screen, each pillar
// feeding the next: inclusion → collective decisions → open information →
// new ideas → wider inclusion.
export const PILLARS: Pillar[] = [
  {
    id: "inclusion",
    title: "Democratic Inclusion",
    short: "Inclusion",
    description: "Promotes equal participation and representation.",
    color: "#22D3EE",
    angle: 135,
    labelSide: "above",
  },
  {
    id: "community",
    title: "Community-Driven Approach",
    short: "Community",
    description: "Emphasizes collective decision-making and participation.",
    color: "#A78BFA",
    angle: 45,
    labelSide: "above",
  },
  {
    id: "transparency",
    title: "Transparency",
    short: "Transparency",
    description: "Ensures open and accessible information for all stakeholders.",
    color: "#34D399",
    angle: -45,
    labelSide: "below",
  },
  {
    id: "innovation",
    title: "Innovation",
    short: "Innovation",
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

// --- Map ----------------------------------------------------------------
// The system floats over North Texas, centered on Tarrant County: county
// lines come from Census boundary data, north points away from the camera,
// and every place below is a real lat/lng projected onto the ground plane.

const TARRANT = COUNTIES.find((county) => county.fips === TARRANT_FIPS)!;

export const MAP = {
  y: -2.1,
  origin: { lng: TARRANT.center[0], lat: TARRANT.center[1] },
  /** Miles per world unit. */
  scale: 10.5,
  /**
   * Ground detail fades out toward these distances from the center. The
   * near side fades sooner so the map is gone before it reaches the frame.
   */
  extent: { x: 4, near: 3.8, far: 4.8 },
  coordinates: "32.77° N · 97.29° W",
};

const MILES_PER_DEG_LAT = 69;
const MILES_PER_DEG_LNG = MILES_PER_DEG_LAT * Math.cos(MAP.origin.lat * DEG);

const fadeRadius = (x: number, z: number) =>
  Math.hypot(x / MAP.extent.x, z / (z > 0 ? MAP.extent.near : MAP.extent.far));

/** How much ground detail shows at a point: 1 near the center, 0 at the edge. */
export function groundFade(x: number, z: number) {
  const t = Math.min(1, Math.max(0, (fadeRadius(x, z) - 0.7) / 0.3));
  return 1 - t * t * (3 - 2 * t);
}

/** Projects a lat/lng onto the ground plane as [x, z]. */
export function geo(lat: number, lng: number): [number, number] {
  return [
    ((lng - MAP.origin.lng) * MILES_PER_DEG_LNG) / MAP.scale,
    (-(lat - MAP.origin.lat) * MILES_PER_DEG_LAT) / MAP.scale,
  ];
}

export function insidePolygon([x, z]: [number, number], ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Splits a polyline so no segment is longer than `step`, for smooth fades. */
export function densify(points: [number, number][], step = 0.12) {
  const out: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i - 1];
    const [x1, z1] = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step));
    for (let s = 1; s <= n; s++) out.push([x0 + ((x1 - x0) * s) / n, z0 + ((z1 - z0) * s) / n]);
  }
  return out;
}

export interface MapCounty {
  name: string;
  isTarrant: boolean;
  rings: [number, number][][];
  /** Where the county's name sits on the ground, or null when it's off the map. */
  label: [number, number] | null;
}

// Labels sit at each county's center, pulled toward Tarrant when the center
// is too far out to read, as long as they stay inside the county. A few are
// placed by hand ([lng, lat]) to stay clear of the pillars and the core.
const LABEL_RADIUS = 0.8;
const LABEL_AT: Record<string, [number, number]> = {
  Tarrant: [-97.29, 32.64],
  Parker: [-97.76, 32.585],
  Dallas: [-96.76, 32.585],
  Denton: [-96.97, 33.11],
};
export const COUNTY_SHAPES: MapCounty[] = COUNTIES.map((county) => {
  const rings = county.rings.map((ring) => ring.map(([lng, lat]) => geo(lat, lng)));
  const isTarrant = county.fips === TARRANT_FIPS;
  const [lng, lat] = LABEL_AT[county.name] ?? county.center;
  let label: [number, number] | null = geo(lat, lng);
  const r = fadeRadius(...label);
  if (r > LABEL_RADIUS) label = [(label[0] * LABEL_RADIUS) / r, (label[1] * LABEL_RADIUS) / r];
  if (!rings.some((ring) => insidePolygon(label!, ring)) || groundFade(...label) < 0.5) label = null;
  return { name: county.name, isTarrant, rings, label };
});

export const TARRANT_OUTLINE = COUNTY_SHAPES.find((county) => county.isTarrant)!.rings[0];

export const BORDER_LINES = BORDERS.map((line) => line.map(([lng, lat]) => geo(lat, lng)));

export interface MapNode {
  x: number;
  z: number;
  /** Index of the pillar standing over this part of the map; -1 for the Fort Worth root. */
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

// Grassroots nodes: builders, meetups, and labs across North Texas. The
// first is Fort Worth, the root under the core.
export const NODES: MapNode[] = (
  [
    [32.7555, -97.3308], // Fort Worth
    [32.7357, -97.1081], // Arlington
    [32.9746, -97.3478], // Alliance
    [32.9346, -97.2292], // Keller
    [32.9343, -97.0781], // Grapevine
    [32.5632, -97.1417], // Mansfield
    [32.5421, -97.3208], // Burleson
    [32.8951, -97.5456], // Azle
    [32.7767, -96.797], // Dallas
    [32.814, -96.9489], // Irving
    [32.7459, -96.9978], // Grand Prairie
    [33.0462, -96.9942], // Lewisville
    [33.2148, -97.1331], // Denton
    [33.1507, -96.8236], // Frisco
    [32.7593, -97.7973], // Weatherford
    [32.4421, -97.7942], // Granbury
    [32.3476, -97.3867], // Cleburne
    [32.4824, -96.9945], // Midlothian
    [32.3866, -96.8483], // Waxahachie
    [33.2343, -97.5861], // Decatur
  ] as [number, number][]
)
  .map(([lat, lng]) => geo(lat, lng))
  .map(([x, z], i) => ({ x, z, pillar: i === 0 ? -1 : nearestPillar(x, z) }));

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
