import { useEffect, useRef, useState } from 'react';
import type { Camera } from '../city/CityRenderer';
import { CITY_VIEW, IDENTITY_CAMERA } from '../city/CityRenderer';
import type { Rect } from '../city/geometry';
import { easeOutCubic, lerp } from '../city/geometry';

export function cameraFor(rect: Rect, pad = 46): Camera {
  const r = { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 };
  const scale = Math.min(CITY_VIEW.w / r.w, CITY_VIEW.h / r.h, 2.6);
  return {
    scale,
    x: CITY_VIEW.x + (CITY_VIEW.w - r.w * scale) / 2 - r.x * scale,
    y: CITY_VIEW.y + (CITY_VIEW.h - r.h * scale) / 2 - r.y * scale,
  };
}

const DURATION = 650;

// Eases the camera toward its target; returns the current camera and whether it has arrived.
export function useCamera(target: Camera, reduced: boolean): { camera: Camera; arrived: boolean } {
  const [camera, setCamera] = useState<Camera>(IDENTITY_CAMERA);
  const from = useRef<Camera>(IDENTITY_CAMERA);
  const current = useRef<Camera>(IDENTITY_CAMERA);
  useEffect(() => {
    if (reduced) {
      current.current = target;
      setCamera(target);
      return;
    }
    from.current = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const k = easeOutCubic((now - start) / DURATION);
      const next = { x: lerp(from.current.x, target.x, k), y: lerp(from.current.y, target.y, k), scale: lerp(from.current.scale, target.scale, k) };
      current.current = next;
      setCamera(next);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);
  const arrived = Math.abs(camera.scale - target.scale) < 1e-3 && Math.abs(camera.x - target.x) < 0.5 && Math.abs(camera.y - target.y) < 0.5;
  return { camera, arrived };
}
