import { clamp01, easeOutCubic, windowed } from '../city/geometry';

// The time-lapse script, in milliseconds. Growth first, then clouds, then leaders, then the title block is inked.
export const TL = {
  growStart: 500,
  growEnd: 5600,
  crackStart: 4200,
  crackEnd: 6400,
  cloudStart: 5800,
  cloudEach: 700,
  cloudStagger: 380,
  leaderEach: 650,
  inkEach: 900,
} as const;

export interface TimelapseState {
  // Which quarter segment is growing, and how far along it is.
  segment: number;
  growth: number;
  // 0..quarters, for the rolling counter.
  quarterProgress: number;
  trafficSpeed: number;
  crackProgress: number;
  clouds: number[];
  leaders: number[];
  ink: number;
  done: boolean;
}

export function timelapseDuration(clouds: number, leaders: number): number {
  const cloudsEnd = TL.cloudStart + Math.max(0, clouds - 1) * TL.cloudStagger + TL.cloudEach;
  return cloudsEnd + leaders * TL.leaderEach + TL.inkEach + 200;
}

export function timelapseAt(ms: number, quarters: number, clouds: number, leaders: number): TimelapseState {
  const grow = windowed(ms, TL.growStart, TL.growEnd) * quarters;
  const segment = Math.min(quarters - 1, Math.floor(grow));
  const cloudsEnd = TL.cloudStart + Math.max(0, clouds - 1) * TL.cloudStagger + TL.cloudEach;
  const leadersEnd = cloudsEnd + leaders * TL.leaderEach;
  const duration = timelapseDuration(clouds, leaders);
  const fastForward = ms > TL.growStart && ms < TL.growEnd;
  return {
    segment,
    growth: clamp01(grow - segment),
    quarterProgress: grow,
    trafficSpeed: fastForward ? 4 : 1,
    crackProgress: easeOutCubic(windowed(ms, TL.crackStart, TL.crackEnd)),
    clouds: Array.from({ length: clouds }, (_, i) => windowed(ms, TL.cloudStart + i * TL.cloudStagger, TL.cloudStart + i * TL.cloudStagger + TL.cloudEach)),
    leaders: Array.from({ length: leaders }, (_, i) => windowed(ms, cloudsEnd + i * TL.leaderEach, cloudsEnd + (i + 1) * TL.leaderEach)),
    ink: windowed(ms, leadersEnd, leadersEnd + TL.inkEach),
    done: ms >= duration,
  };
}

// prefers-reduced-motion: a before/after with everything drawn statically. Nothing is lost.
export function finalState(quarters: number, clouds: number, leaders: number): TimelapseState {
  return timelapseAt(Number.MAX_SAFE_INTEGER, quarters, clouds, leaders);
}
