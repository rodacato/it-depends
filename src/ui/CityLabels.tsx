import type { Camera } from '../city/CityRenderer';
import { CITY_VIEW } from '../city/CityRenderer';
import type { CityModel } from '../city/layout';
import { CLIENT_GATE, SHEET } from '../city/layout';
import type { CloudMark } from './scene';
import { useI18n } from './i18n';

interface Props {
  preview: CityModel | null;
  base: CityModel;
  target: CityModel;
  growth: number;
  clouds: CloudMark[];
  cloudProgress: number[];
  hovered: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  interactive: boolean;
  camera: Camera;
}

// Lettering and hit areas over the canvas. Real software names, never a city vocabulary to translate.
export function CityLabels({ preview, base, target, growth, clouds, cloudProgress, hovered, onHover, onSelect, interactive, camera }: Props) {
  const { t, has } = useI18n();
  const name = (id: string) => (has(`components.${id}.name`) ? t(`components.${id}.name`) : id);
  const clip = (s: string) => (s.length > 30 ? `${s.slice(0, 29)}…` : s);
  const role = (id: string, kind: string) => clip(has(`components.${id}.role`) ? t(`components.${id}.role`) : t(`kinds.${kind}`));
  const isNew = (id: string) => !(id in base.bounds);
  const shown = (id: string) => !isNew(id) || growth > 0.45;

  return (
    <svg className="city-labels" viewBox={`0 0 ${SHEET.w} ${SHEET.h}`} width={SHEET.w} height={SHEET.h}>
      <defs>
        <clipPath id="city-view">
          <rect x={CITY_VIEW.x} y={CITY_VIEW.y} width={CITY_VIEW.w} height={CITY_VIEW.h} />
        </clipPath>
      </defs>
      <g clipPath={camera.scale !== 1 ? 'url(#city-view)' : undefined}>
      <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}>
      <text x={CLIENT_GATE[0] + 8} y={CLIENT_GATE[1] - 16} className="lbl" fontSize={13}>
        {name('clients')}
      </text>
      <text x={CLIENT_GATE[0] + 8} y={CLIENT_GATE[1] + 26} className="mono dim" fontSize={9.5}>
        {t('ui.city.publicRoad')}
      </text>
      {target.districts.map((d) => (
        <text key={d.id} x={d.rect.x + 12} y={d.rect.y + 18} className={`lbl spaced dim ${isNew(d.id) && growth < 0.4 ? 'lettering' : ''}`} fontSize={12}>
          {t('ui.city.district', { name: has(`districts.${d.id}`) ? t(`districts.${d.id}`) : d.id })}
        </text>
      ))}
      {target.vendors.map((v) => (
        <text key={v.id} x={v.lot.x} y={v.lot.y - 7} className="mono dim" fontSize={8.5}>
          {t('ui.city.notOurs')}
        </text>
      ))}
      {preview &&
        Object.entries(preview.anchors)
          .filter(([id]) => !(id in target.anchors))
          .map(([id, [x, y]]) => (
            <g key={`p-${id}`} className="proposed">
              <text x={x} y={y} className="lbl" fontSize={14}>
                {name(id)}
              </text>
              <text x={x} y={y + 13} className="mono" fontSize={9}>
                {t('ui.city.proposed')}
              </text>
            </g>
          ))}
      {Object.entries(target.anchors).map(([id, [x, y]]) =>
        shown(id) ? (
          <g key={id} className={isNew(id) && growth < 0.75 ? 'lettering' : ''}>
            <text x={x} y={y} className="lbl name" fontSize={15}>
              {name(id)}
            </text>
            <text x={x} y={y + 13} className="mono dim" fontSize={9.5}>
              {role(id, target.kinds[id] ?? 'service')}
            </text>
            {(target.stress[id] ?? 0) >= 1 && (
              <text x={x} y={y + 26} className="mono red" fontSize={9.5}>
                {t('ui.city.atCapacity')}
              </text>
            )}
          </g>
        ) : null,
      )}
      {clouds.map((c, i) =>
        (cloudProgress[i] ?? 0) >= 1 ? (
          <g key={c.id} className="delta" transform={`translate(${c.rect.x + c.rect.w + 14}, ${c.rect.y - 8})`}>
            <path d="M0,-12 L11,8 L-11,8 Z" />
            <text x={0} y={5} textAnchor="middle" className="lbl" fontSize={12}>
              {c.letter}
            </text>
          </g>
        ) : null,
      )}
      {interactive &&
        Object.entries(target.bounds).map(([id, r]) => (
          <rect
            key={id}
            data-testid={`hit-${id}`}
            x={r.x - 8}
            y={r.y - 8}
            width={r.w + 16}
            height={r.h + 16}
            className={`hit ${hovered === id ? 'on' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={t('ui.city.inspect', { name: name(id) })}
            onPointerEnter={() => onHover(id)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(id)}
            onBlur={() => onHover(null)}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(id);
            }}
          />
        ))}
      </g>
      </g>
    </svg>
  );
}
