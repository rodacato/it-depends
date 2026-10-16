import type { Campaign, Chapter } from '../engine/schema';
import type { Incident, InspectionNote } from '../engine/simulate';
import type { ChapterScene } from './scene';
import { useI18n } from './i18n';
import { Vellum } from './Vellum';

interface Props {
  campaign: Campaign;
  chapter: Chapter;
  optionId: string;
  rationale: string;
  letter: string;
  months: number;
  scene: ChapterScene;
  incidents: Incident[];
  inspections: InspectionNote[];
  onWriteAdr: () => void;
}

export function IssuedPanel({ campaign, chapter, optionId, rationale, letter, months, scene, incidents, inspections, onWriteAdr }: Props) {
  const { t, has } = useI18n();
  const name = (id: string) => (has(`components.${id}.name`) ? t(`components.${id}.name`) : id);
  const eventText = (eventId: string) => {
    const owner = campaign.chapters.find((c) => c.events.some((e) => e.id === eventId));
    return owner ? t(`chapters.${owner.id}.events.${eventId}`) : eventId;
  };
  const clouds = scene.clouds.length;
  return (
    <>
      <Vellum x={1004} y={58} w={398} rotate={-1.3} className="issued" label={t('ui.issued.kicker', { letter, months })} testId="issued">
        <div className="kicker mono">{t('ui.issued.kicker', { letter, months })}</div>
        <h2 className="lbl">{t(`chapters.${chapter.id}.options.${optionId}.title`)}</h2>
        <blockquote className="mono">“{t('ui.briefing.because')} {rationale}”</blockquote>
        <p className="voice mono">{clouds === 1 ? t('ui.issued.cloudsOne') : t('ui.issued.clouds', { n: clouds })}</p>
        {(incidents.length > 0 || scene.late.length > 0) && (
          <div className="log">
            <div className="mono k">{t('ui.issued.news')}</div>
            <ul className="mono">
              {incidents.map((i) => (
                <li key={i.id}>
                  <span className="q">{t('ui.issued.quarterShort', { q: ((i.quarter + 3) % 4) + 1 })}</span>{' '}
                  {i.kind === 'event' && i.eventId ? eventText(i.eventId) : t('ui.issued.congestion', { name: name(i.anchor ?? '') })}
                </li>
              ))}
              {scene.leaders.map((l) => (
                <li key={l.id} className="late">
                  {t('ui.issued.late', { rev: l.revision, name: name(l.componentId) })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="actions">
          <button type="button" className="ink-button lbl" onClick={onWriteAdr} data-testid="write-adr">
            {t('ui.issued.writeAdr')}
          </button>
        </div>
      </Vellum>
      {inspections.map((ins, i) => (
        <Vellum key={ins.id} x={1022} y={430 + i * 70} w={360} rotate={0.9} className="inspection" from="right" testId="inspection">
          <b className="lbl">{t('ui.issued.inspection')}</b>
          <p className="mono">{t(`chapters.${ins.chapterId}.inspections.${ins.id}`)}</p>
        </Vellum>
      ))}
    </>
  );
}
