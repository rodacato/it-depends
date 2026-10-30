import type { Camera } from '../city/CityRenderer';
import { CITY_VIEW } from '../city/CityRenderer';
import type { CityModel } from '../city/layout';
import { CLIENT_GATE, SHEET } from '../city/layout';
import type { LabelSlot } from '../city/labels';
import { wrapLabel } from '../city/labels';
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
  congested: string[];
}

// Lettering and hit areas over the canvas. Real software names, never a city vocabulary to translate.
export function CityLabels({ preview, base, target, growth, clouds, cloudProgress, hovered, onHover, onSelect, interactive, camera, congested }: Props) {
  const { t, has } = useI18n();
  const name = (id: string) => (has(`components.${id}.name`) ? t(`components.${id}.name`) : id);
  const role = (id: string, kind: string) => (has(`components.${id}.role`) ? t(`components.${id}.role`) : t(`kinds.${kind}`));
  const districtName = (id: string) => (has(`districts.${id}`) ? t(`districts.${id}`) : id);
  // Measured advance of the spaced capitals; a narrow district drops the "district" prefix rather than spill.
  const districtTitle = (id: string, width: number) => {
    const full = t('ui.city.district', { name: districtName(id) });
    return full.length * 8 <= width - 20 ? full : districtName(id);
  };
  const isNew = (id: string) => !(id in base.bounds);
  const shown = (id: string) => !isNew(id) || growth > 0.45;
  const isNewDistrict = (id: string) => !base.districts.some((d) => d.id === id);

  return (
    <svg className="city-labels" viewBox={`0 0 ${SHEET.w} ${SHEET.h}`} width={SHEET.w} height={SHEET.h}>
      <defs>
        <clipPath id="city-view">
          <rect x={CITY_VIEW.x} y={CITY_VIEW.y} width={CITY_VIEW.w} height={CITY_VIEW.h} />
        </clipPath>
      </defs>
      <g clipPath={camera.scale !== 1 ? 'url(#city-view)' : undefined}>
      <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}>
      <text transform={`translate(${CLIENT_GATE[0] + 14} ${CLIENT_GATE[1] - 12}) rotate(-90)`} className="lbl" fontSize={13}>
        {name('clients')}
      </text>
      <text transform={`translate(${CLIENT_GATE[0] + 28} ${CLIENT_GATE[1] - 12}) rotate(-90)`} className="mono dim" fontSize={9.5}>
        {t('ui.city.publicRoad')}
      </text>
      {target.districts.map((d) => (
        <text key={d.id} x={d.rect.x + 12} y={d.rect.y + 18} className={`lbl spaced dim ${isNewDistrict(d.id) && growth < 0.4 ? 'lettering' : ''}`} fontSize={12}>
          {districtTitle(d.id, d.rect.w)}
        </text>
      ))}
      {target.vendors.map((v) => (
        <text key={v.id} x={v.lot.x} y={v.lot.y - 7} className="mono dim" fontSize={8.5}>
          {t('ui.city.notOurs')}
        </text>
      ))}
      {preview &&
        Object.entries(preview.labels)
          .filter(([id]) => !(id in target.labels))
          .map(([id, slot]) => (
            <g key={`p-${id}`} className="proposed">
              <Label slot={slot} name={name(id)} role={t('ui.city.proposed')} />
            </g>
          ))}
      {Object.entries(target.labels).map(([id, slot]) =>
        shown(id) ? (
          <g key={id} className={isNew(id) && growth < 0.75 ? 'lettering' : ''}>
            <Label slot={slot} name={name(id)} role={role(id, target.kinds[id] ?? 'service')} />
          </g>
        ) : null,
      )}
      {Object.entries(target.stamps).map(([id, [x, y]]) =>
        shown(id) && (target.stress[id] ?? 0) >= 1 && congested.includes(id) ? (
          <text key={`cap-${id}`} x={x} y={y} className="mono red stamp" fontSize={9}>
            {t('ui.city.atCapacity')}
          </text>
        ) : null,
      )}
      {clouds.map((c, i) =>
        (cloudProgress[i] ?? 0) >= 1 ? (
          <g key={c.id} className="delta" transform={`translate(${c.rect.x + c.rect.w - 8}, ${c.rect.y - 10})`}>
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

function Label({ slot, name, role }: { slot: LabelSlot; name: string; role: string }) {
  const lines = wrapLabel(name, role, slot);
  return (
    <>
      <text x={slot.x} y={slot.y} className="lbl name" fontSize={15}>
        {lines.name.map((l, i) => (
          <tspan key={i} x={slot.x} dy={i === 0 ? 0 : 16}>
            {l}
          </tspan>
        ))}
      </text>
      <text x={slot.x} y={slot.y} className="mono dim" fontSize={9.5}>
        {lines.role.map((l, i) => (
          <tspan key={i} x={slot.x} y={slot.y + lines.roleOffsets[i]!}>
            {l}
          </tspan>
        ))}
      </text>
    </>
  );
}
