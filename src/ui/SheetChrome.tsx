import { SHEET } from '../city/layout';
import { useI18n } from './i18n';

const M = 16;
const GAP = 20;
const COLS = 12;
const ROWS = 8;
const LETTERS = 'ABCDEFGH';

// Border, zone ticks, north arrow and scale bar: the parts of the sheet that never change.
export function SheetChrome({ caption }: { caption: string }) {
  const { t } = useI18n();
  const iw = SHEET.w - 2 * (M + GAP);
  const ih = SHEET.h - 2 * (M + GAP);
  const colX = (i: number) => M + GAP + (iw / COLS) * i;
  const rowY = (i: number) => M + GAP + (ih / ROWS) * i;
  const ticks = [];
  for (let x = M + GAP; x <= SHEET.w - M - GAP; x += 10) ticks.push(x);
  return (
    <svg className="sheet-chrome" viewBox={`0 0 ${SHEET.w} ${SHEET.h}`} width={SHEET.w} height={SHEET.h} aria-hidden="true">
      <rect x={M} y={M} width={SHEET.w - 2 * M} height={SHEET.h - 2 * M} className="hair" />
      <rect x={M + GAP} y={M + GAP} width={iw} height={ih} className="border" />
      {Array.from({ length: COLS - 1 }, (_, i) => (
        <g key={`c${i}`} className="tick">
          <line x1={colX(i + 1)} y1={M} x2={colX(i + 1)} y2={M + GAP} />
          <line x1={colX(i + 1)} y1={SHEET.h - M - GAP} x2={colX(i + 1)} y2={SHEET.h - M} />
        </g>
      ))}
      {Array.from({ length: ROWS - 1 }, (_, i) => (
        <g key={`r${i}`} className="tick">
          <line x1={M} y1={rowY(i + 1)} x2={M + GAP} y2={rowY(i + 1)} />
          <line x1={SHEET.w - M - GAP} y1={rowY(i + 1)} x2={SHEET.w - M} y2={rowY(i + 1)} />
        </g>
      ))}
      {ticks.map((x) => (
        <line key={x} x1={x} y1={M + GAP} x2={x} y2={M + GAP + ((x - M - GAP) % 50 === 0 ? 6 : 3)} className="fine" />
      ))}
      {Array.from({ length: COLS }, (_, i) => (
        <g key={`cn${i}`} className="mono zone">
          <text x={colX(i) + iw / COLS / 2} y={M + GAP / 2 + 3.5} textAnchor="middle">{i + 1}</text>
          <text x={colX(i) + iw / COLS / 2} y={SHEET.h - M - GAP / 2 + 3.5} textAnchor="middle">{i + 1}</text>
        </g>
      ))}
      {Array.from({ length: ROWS }, (_, i) => (
        <g key={`rn${i}`} className="mono zone">
          <text x={M + GAP / 2} y={rowY(i) + ih / ROWS / 2 + 3} textAnchor="middle">{LETTERS[i]}</text>
          <text x={SHEET.w - M - GAP / 2} y={rowY(i) + ih / ROWS / 2 + 3} textAnchor="middle">{LETTERS[i]}</text>
        </g>
      ))}
      <text x={60} y={58} className="mono caption">{caption}</text>
      <g transform="translate(954 716)" className="north">
        <circle r={20} />
        <circle r={16} className="inner" />
        <path d="M0,-18 L7,8 L0,3 Z" className="solid" />
        <path d="M0,-18 L-7,8 L0,3 Z" />
        <text y={-26} textAnchor="middle" className="lbl">N</text>
      </g>
      <g transform="translate(770 736)" className="scale">
        <text y={-8} className="mono">{t('ui.city.scale')}</text>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 32} y={0} width={32} height={6} className={i % 2 ? '' : 'solid'} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <text key={i} x={i * 32} y={18} textAnchor="middle" className="mono">{i * 100}</text>
        ))}
      </g>
    </svg>
  );
}
