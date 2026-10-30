import type { ForceOutcome } from '../engine/queries';
import type { Campaign, Chapter } from '../engine/schema';
import { toneMark } from './AssumptionTag';
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
  outcomes: ForceOutcome[];
  incidents: Incident[];
  inspections: InspectionNote[];
  onWriteAdr: () => void;
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s/)[0] ?? text;
}

function Outcomes({ outcomes }: { outcomes: ForceOutcome[] }) {
  const { t } = useI18n();
  const shown = outcomes.filter((o) => Math.round(o.total) !== 0);
  if (shown.length === 0) return null;
  const part = (o: ForceOutcome, delta: number) => {
    const m = toneMark(o.force, delta);
    return <b className={m.tone}>{m.text}</b>;
  };
  return (
    <div className="outcomes" data-testid="outcomes">
      <div className="mono k">{t('ui.issued.whatHappened')}</div>
      <ul className="mono">
        {shown.map((o) => {
          const total = toneMark(o.force, o.total);
          const both = Math.round(o.decisions) !== 0 && Math.round(o.world) !== 0;
          return (
            <li key={o.force} data-testid={`outcome-${o.force}`}>
              <div className="row">
                <b className={total.tone}>
                  {total.text} {t(`ui.forces.${o.force}`)} · {t(`ui.tag.${total.tone}`)}
                </b>
                <span className="by">
                  {both ? (
                    <>
                      {t('ui.issued.byDecision')} {part(o, o.decisions)} · {t('ui.issued.byWorld')} {part(o, o.world)}
                    </>
                  ) : (
                    t(Math.round(o.decisions) !== 0 ? 'ui.issued.byDecision' : 'ui.issued.byWorld')
                  )}
                </span>
              </div>
              <p className="why">{firstSentence(t(o.cause.assumption))}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function IssuedPanel({ campaign, chapter, optionId, rationale, letter, months, scene, outcomes, incidents, inspections, onWriteAdr }: Props) {
  const { t, has } = useI18n();
  const name = (id: string) => (has(`components.${id}.name`) ? t(`components.${id}.name`) : id);
  const eventText = (eventId: string) => {
    const owner = campaign.chapters.find((c) => c.events.some((e) => e.id === eventId));
    return owner ? t(`chapters.${owner.id}.events.${eventId}`) : eventId;
  };
  return (
    <>
      <Vellum x={924} y={58} w={478} rotate={-1.3} className="issued" label={t('ui.issued.kicker', { letter, months })} testId="issued">
        <div className="kicker mono">{t('ui.issued.kicker', { letter, months })}</div>
        <h2 className="lbl">{t(`chapters.${chapter.id}.options.${optionId}.title`)}</h2>
        <blockquote className="mono">“{t('ui.briefing.because')} {rationale}”</blockquote>
        <Outcomes outcomes={outcomes} />
        {(incidents.length > 0 || scene.late.length > 0) && (
          <div className="log">
            <div className="mono k">{t('ui.issued.news')}</div>
            <ul className="mono">
              {incidents.slice(0, 4).map((i) => (
                <li key={i.id}>
                  <span className="q">{t('ui.issued.quarterShort', { q: ((i.quarter + 3) % 4) + 1 })}</span>{' '}
                  {i.kind === 'event' && i.eventId ? eventText(i.eventId) : t('ui.issued.congestion', { name: name(i.anchor ?? '') })}
                </li>
              ))}
              {scene.lateChanges.map((l) => (
                <li key={l.id} className="late">
                  {t('ui.issued.late', { rev: l.revision, name: name(l.componentId) })}
                </li>
              ))}
              {incidents.length > 4 && <li className="q">{t('ui.issued.more', { n: incidents.length - 4 })}</li>}
            </ul>
          </div>
        )}
        {inspections.map((ins) => (
          <div key={ins.id} className="pinned inspection" data-testid="inspection">
            <b className="lbl">{t('ui.issued.inspection')}</b>
            <p className="mono">{t(`chapters.${ins.chapterId}.inspections.${ins.id}`)}</p>
          </div>
        ))}
        <div className="actions">
          <button type="button" className="ink-button lbl" onClick={onWriteAdr} data-testid="write-adr">
            {t('ui.issued.writeAdr')}
          </button>
        </div>
      </Vellum>
    </>
  );
}
