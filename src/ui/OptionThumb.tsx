import type { CityModel } from '../city/layout';

// A mini site plan of an alternate, so the dilemma can be read as drawings (borrowed from the Plan Check direction).
export function OptionThumb({ current, after }: { current: CityModel; after: CityModel }) {
  const isNew = (id: string, list: { id: string }[]) => !list.some((x) => x.id === id);
  return (
    <svg className="thumb" viewBox="60 60 930 710" width={92} height={70} aria-hidden="true">
      {after.districts.map((d) => (
        <rect key={d.id} x={d.rect.x} y={d.rect.y} width={d.rect.w} height={d.rect.h} className={`t-district ${isNew(d.id, current.districts) ? 'new' : ''}`} />
      ))}
      {after.links.map((l) => (
        <polyline key={l.id} points={l.points.map((p) => p.join(',')).join(' ')} className={`t-link ${l.kind} ${isNew(l.id, current.links) ? 'new' : ''}`} />
      ))}
      {after.vendors.map((v) => (
        <rect key={v.id} x={v.lot.x} y={v.lot.y} width={v.lot.w} height={v.lot.h} className={`t-vendor ${isNew(v.id, current.vendors) ? 'new' : ''}`} />
      ))}
      {after.reservoirs.map((r) => (
        <ellipse key={r.id} cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} className={`t-res ${isNew(r.id, current.reservoirs) ? 'new' : ''}`} />
      ))}
      {after.buildings.map((b) => (
        <rect key={b.id} x={b.footprint.x} y={b.footprint.y} width={b.footprint.w} height={b.footprint.h} className={`t-bldg ${isNew(b.id, current.buildings) ? 'new' : ''}`} />
      ))}
      {after.depots.map((d) => (
        <rect key={d.id} x={d.rect.x} y={d.rect.y} width={d.rect.w} height={d.rect.h} className={`t-bldg ${isNew(d.id, current.depots) ? 'new' : ''}`} />
      ))}
    </svg>
  );
}
