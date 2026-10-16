import type { CSSProperties, ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { SHEET } from '../city/layout';

// A fixed 1440x900 drawing sheet, scaled to fit its box. Everything inside uses sheet coordinates.
export function Sheet({ children, label, style }: { children: ReactNode; label: string; style?: CSSProperties }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / SHEET.w, el.clientHeight / SHEET.h));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className="sheet-box" style={style}>
      <div
        className="sheet"
        role="region"
        aria-label={label}
        style={{ width: SHEET.w, height: SHEET.h, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
