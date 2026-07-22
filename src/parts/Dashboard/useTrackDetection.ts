/**
 * useTrackDetection — live computer-vision estimate of the teal people-tracks
 * in a playing -tracks video.
 *
 * Pipeline (per analyzed frame): drawImage(video) onto a hidden canvas →
 * getImageData → teal threshold → 3px-cell occupancy grid → flood-fill
 * connected cells into blobs. Blob count = tracks currently detected; pace =
 * mean nearest-neighbour centroid displacement between analyzed frames,
 * normalised 0–1 and EMA-smoothed.
 *
 * IMPORTANT: the canvas reads the video's ORIGINAL pixels. The display grade
 * (CSS filter on the <video>) is paint-time only and never reaches drawImage,
 * so analysis is unaffected by the grade — by construction, not by accident.
 *
 * Everything here is an ESTIMATE — blobs merge, split and drop out. The UI
 * must present it in amber as derived data (DESIGN.md), never as a count of
 * people. Tuning was validated offline against 01-west-tracks @ t=5s:
 * 320×180 finds 11 blobs vs ~12 dots visible by eye; the coarser 192×108
 * merged neighbours down to 7 — hence the higher analysis resolution.
 */
import { useEffect, useRef, useState } from "react";

export const DETECTION_TUNING = {
  /** analysis canvas size — dots are ~1.3px here; 192×108 was too coarse */
  width: 320,
  height: 180,
  /** teal test on original pixels: g > r+gOverR && b > r+bOverR && g > gMin */
  gOverR: 20,
  bOverR: 15,
  gMin: 60,
  /** clustering: cell size (px) and minimum teal pixels for a real blob */
  cell: 3,
  minBlobPixels: 2,
  /** analyse every Nth rAF tick */
  frameStride: 3,
  /** centroid matches farther than this (cells) are treated as appear/vanish */
  matchRadius: 8,
  /** mean displacement (cells/tick) that reads as pace = 1 */
  paceFull: 1.6,
  /** EMA smoothing factor for pace (higher = snappier) */
  paceAlpha: 0.15,
};

export interface DetectionReading {
  /** blobs currently detected (estimate, not people) */
  count: number;
  /** 0–1 relative movement rate, smoothed */
  pace: number;
  /** peak count seen since this activation */
  peak: number;
  /** true once at least one frame has been analysed this activation */
  live: boolean;
}

interface Blob {
  x: number;
  y: number;
  px: number;
}

/** Threshold + cluster one frame. Exported for testability. */
export function analyzeFrame(data: Uint8ClampedArray, W: number, H: number): Blob[] {
  const T = DETECTION_TUNING;
  const gw = Math.ceil(W / T.cell);
  const gh = Math.ceil(H / T.cell);
  const cells = new Uint16Array(gw * gh);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (g > r + T.gOverR && b > r + T.bOverR && g > T.gMin) {
        cells[Math.floor(y / T.cell) * gw + Math.floor(x / T.cell)]++;
      }
    }
  }
  // flood-fill occupied cells (8-connectivity) into blobs
  const seen = new Uint8Array(gw * gh);
  const blobs: Blob[] = [];
  const stack: number[] = [];
  for (let start = 0; start < cells.length; start++) {
    if (!cells[start] || seen[start]) continue;
    let px = 0;
    let sx = 0;
    let sy = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % gw;
      const y = (c - x) / gw;
      px += cells[c];
      sx += x * cells[c];
      sy += y * cells[c];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const n = ny * gw + nx;
          if (cells[n] && !seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }
    if (px >= DETECTION_TUNING.minBlobPixels) blobs.push({ x: sx / px, y: sy / px, px });
  }
  return blobs;
}

const IDLE: DetectionReading = { count: 0, pace: 0, peak: 0, live: false };

/**
 * @param getVideo resolves the tracks <video> to analyse (refs fill after mount)
 * @param active   run the loop only while this station's dwell is on screen
 */
export default function useTrackDetection(
  getVideo: () => HTMLVideoElement | null,
  active: boolean,
): DetectionReading {
  const [reading, setReading] = useState<DetectionReading>(IDLE);
  const lastRef = useRef<DetectionReading>(IDLE);

  useEffect(() => {
    if (!active) return;
    const video = getVideo();
    if (!video) return;

    const T = DETECTION_TUNING;
    const canvas = document.createElement("canvas");
    canvas.width = T.width;
    canvas.height = T.height;
    const c2d = canvas.getContext("2d", { willReadFrequently: true });
    if (!c2d) return;

    let raf = 0;
    let tick = 0;
    let peak = 0;
    let pace = 0;
    let prev: Blob[] = [];

    const publish = (next: DetectionReading) => {
      const last = lastRef.current;
      // throttle renders: only when something visible changes
      if (
        next.count !== last.count ||
        next.peak !== last.peak ||
        next.live !== last.live ||
        Math.abs(next.pace - last.pace) > 0.015
      ) {
        lastRef.current = next;
        setReading(next);
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      tick++;
      if (tick % T.frameStride !== 0) return; // every 3rd frame
      if (video.paused || video.readyState < 2) return; // skip when not playing
      c2d.drawImage(video, 0, 0, T.width, T.height);
      const blobs = analyzeFrame(c2d.getImageData(0, 0, T.width, T.height).data, T.width, T.height);

      // pace: nearest-neighbour displacement vs previous analysed frame
      let sum = 0;
      let n = 0;
      for (const b of blobs) {
        let best = Infinity;
        for (const p of prev) {
          const d = Math.hypot(b.x - p.x, b.y - p.y);
          if (d < best) best = d;
        }
        if (best < T.matchRadius) {
          sum += best;
          n++;
        }
      }
      const raw = n ? Math.min(sum / n / T.paceFull, 1) : 0;
      pace += (raw - pace) * T.paceAlpha; // EMA smoothing
      prev = blobs;
      peak = Math.max(peak, blobs.length);
      publish({ count: blobs.length, pace, peak, live: true });
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      // hold the last numbers on screen; peak resets next activation
      lastRef.current = IDLE;
    };
  }, [active, getVideo]);

  return reading;
}
