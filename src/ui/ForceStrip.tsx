import type { ForceId, Forces } from '../engine/schema';
import { FORCE_IDS } from '../engine/schema';
import { useI18n } from './i18n';

const X0 = 64;
const Y0 = 800;
const STEP = 184;
const W = 158;

export function gaugeAnchor(force: ForceId): [number, number] {
  return [X0 + FORCE_IDS.indexOf(force) * STEP, Y0 - 24];
}

interface Props {
  forces: Forces;
  from: Forces | null;
  preview: Forces | null;
  hovered: ForceId | null;
  onHover: (force: ForceId | null) => void;
}

// Drafting-scale gauges. Relative 0-100, never a measurement; every move traces to an assumption.
export function ForceStrip({ forces, from, preview, hovered, onHover }: Props) {
  const { t } = useI18n();
  return (
    <svg className="force-strip" viewBox="0 0 1440 900" width={1440} height={900}>
      <text x={X0} y={Y0 - 22} className="mono dim" fontSize={10}>
        {t('ui.forces.caption')}
      </text>
      {FORCE_IDS.map((f, i) => {
        const x = X0 + i * STEP;
        const v = forces[f];
        const vx = x + (W * v) / 100;
        const prev = from?.[f];
        const ghost = preview?.[f];
        const delta = prev === undefined ? null : v - prev;
        return (
          <g
            key={f}
            className={`gauge ${hovered === f ? 'on' : ''}`}
            data-testid={`gauge-${f}`}
            tabIndex={0}
            role="button"
            aria-label={t('ui.forces.inspect', { name: t(`ui.forces.${f}`), value: Math.round(v) })}
            onPointerEnter={() => onHover(f)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(f)}
            onBlur={() => onHover(null)}
          >
            <rect x={x - 6} y={Y0 - 12} width={W + 12} height={56} className="hit" />
            <text x={x} y={Y0} className="mono" fontSize={10.5} letterSpacing="0.04em">
              {t(`ui.forces.${f}`)}
            </text>
            {delta !== null && Math.round(delta) !== 0 && (
              <text x={x + W} y={Y0} textAnchor="end" className="mono red" fontSize={11}>
                {delta > 0 ? '+' : ''}
                {Math.round(delta)}
              </text>
            )}
            <line x1={x} y1={Y0 + 20} x2={x + W} y2={Y0 + 20} className="rule" />
            {Array.from({ length: 21 }, (_, k) => (
              <line key={k} x1={x + (W / 20) * k} y1={Y0 + 20} x2={x + (W / 20) * k} y2={Y0 + 20 - (k % 10 === 0 ? 9 : k % 2 === 0 ? 5 : 3)} className="rule thin" />
            ))}
            {prev !== undefined && (
              <>
                <path d={`M${x + (W * prev) / 100},${Y0 + 22} l-4,7 h8 z`} className="ghost" />
                {Math.round(delta ?? 0) !== 0 && (
                  <line x1={x + (W * prev) / 100} y1={Y0 + 36} x2={vx} y2={Y0 + 36} className="delta-line" markerEnd="url(#gauge-arrow)" />
                )}
              </>
            )}
            {ghost !== undefined && <path d={`M${x + (W * ghost) / 100},${Y0 + 22} l-4.5,8 h9 z`} className="preview" />}
            <path d={`M${vx},${Y0 + 22} l-4.5,8 h9 z`} className="solid" />
            <text x={vx} y={Y0 + 9} textAnchor="middle" className="mono" fontSize={10.5}>
              {Math.round(v)}
            </text>
          </g>
        );
      })}
      <defs>
        <marker id="gauge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9" fill="none" stroke="var(--red)" strokeWidth="1.6" />
        </marker>
      </defs>
    </svg>
  );
}
