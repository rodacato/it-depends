import { useEffect, useRef, useState } from 'react';
import type { Camera, CityFrame } from '../city/CityRenderer';
import { CityRenderer } from '../city/CityRenderer';
import { useI18n } from './i18n';

// Hosts the PixiJS renderer and hands it frames. The renderer only ever sees engine-derived models.
export function CityCanvas({ frame, camera, reducedMotion, onReady }: { frame: CityFrame; camera: Camera; reducedMotion: boolean; onReady?: (r: CityRenderer) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<CityRenderer | null>(null);
  const latest = useRef(frame);
  const latestCamera = useRef(camera);
  latestCamera.current = camera;
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();
  latest.current = frame;

  useEffect(() => {
    let cancelled = false;
    let created: CityRenderer | null = null;
    const el = host.current;
    if (!el) return;
    CityRenderer.create(el, { reducedMotion })
      .then((r) => {
        if (cancelled) {
          r.destroy();
          return;
        }
        created = r;
        renderer.current = r;
        r.setFrame(latest.current);
        r.setCamera(latestCamera.current);
        onReady?.(r);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      created?.destroy();
      renderer.current = null;
    };
    // The renderer lives as long as the canvas; frames arrive through setFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  useEffect(() => {
    renderer.current?.setFrame(frame);
  }, [frame]);

  useEffect(() => {
    renderer.current?.setCamera(camera);
  }, [camera]);

  return (
    <div ref={host} className="city-canvas" data-testid="city-canvas">
      {failed && <p className="city-failed mono">{t('ui.errors.webgl')}</p>}
    </div>
  );
}
