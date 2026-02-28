/**
 * Generates smooth seed data for charts when localStorage history is empty or sparse.
 * Uses a seeded PRNG for deterministic "random" variation so charts don't jump on reload.
 */

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface SeedOptions {
  /** Number of data points to generate */
  count: number;
  /** Time span in ms (how far back from now) */
  spanMs: number;
  /** Current (end) value */
  endValue: number;
  /** Starting value (defaults to endValue) */
  startValue?: number;
  /** Max random variation as fraction of range (0-1, default 0.05) */
  noise?: number;
  /** Seed for deterministic randomness */
  seed?: number;
}

export function generateSeedData(opts: SeedOptions): { timestamp: number; value: number }[] {
  const {
    count,
    spanMs,
    endValue,
    startValue = endValue,
    noise = 0.05,
    seed = 42,
  } = opts;

  const now = Date.now();
  const rand = seededRandom(seed);
  const range = Math.abs(endValue - startValue) || Math.abs(endValue) || 1;
  const points: { timestamp: number; value: number }[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0..1
    const timestamp = now - spanMs + t * spanMs;
    // Smooth interpolation with slight easing
    const base = startValue + (endValue - startValue) * (t * t * (3 - 2 * t));
    // Add small deterministic noise
    const jitter = (rand() - 0.5) * 2 * noise * range;
    points.push({ timestamp, value: Math.max(0, base + jitter) });
  }

  // Ensure the last point is exactly the current value
  if (points.length > 0) {
    points[points.length - 1].value = endValue;
  }

  return points;
}

/** Minimum number of snapshots before we skip seed generation */
export const MIN_SNAPSHOTS_FOR_CHART = 10;

/** Default seed span per period */
export const SEED_SPANS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: 30 * 24 * 60 * 60 * 1000,
};

export const SEED_COUNTS: Record<string, number> = {
  "24h": 24,
  "7d": 28,
  "30d": 60,
  all: 60,
};
