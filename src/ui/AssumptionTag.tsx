import { motion } from 'framer-motion';
import { deltaTone } from '../engine/queries';
import type { AppliedEffect } from '../engine/simulate';
import { sourceById } from '../content';
import type { I18n } from './i18n';
import { useI18n } from './i18n';

export function targetLabel(i18n: I18n, e: Pick<AppliedEffect, 'target'>): string {
  return 'force' in e.target ? i18n.t(`ui.forces.${e.target.force}`) : i18n.t(`ui.context.${e.target.context}`);
}

export function originLabel(i18n: I18n, e: AppliedEffect): string {
  const o = e.origin;
  if (o.kind === 'option') return i18n.t(`ui.timing.${e.timing}`, { rev: o.revision });
  return i18n.t(`ui.timing.${o.kind}`);
}

export function formatDelta(i18n: I18n, e: AppliedEffect): string {
  const sign = e.delta > 0 ? '+' : '';
  const value = 'context' in e.target && e.target.context === 'ordersPerDay' ? i18n.number(Math.round(e.delta)) : String(e.delta);
  return `${sign}${value}`;
}

interface Props {
  x: number;
  y: number;
  title: string;
  effects: AppliedEffect[];
  empty?: string;
  hint?: string;
  testId?: string;
}

// Every number on the sheet traces to a written assumption and a source.
export function AssumptionTag({ x, y, title, effects, empty, hint, testId }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const left = Math.min(Math.max(48, x), 1440 - 420);
  const top = Math.min(Math.max(48, y), 900 - 60 - Math.min(5, effects.length) * 80);
  return (
    <motion.aside
      className="vellum tag"
      style={{ left, top }}
      initial={{ rotate: 2.5, clipPath: 'inset(0 100% 0 0)' }}
      animate={{ rotate: 1.4, clipPath: 'inset(0 0% 0 0)' }}
      transition={{ duration: 0.22, ease: 'linear' }}
      data-testid={testId ?? 'assumption-tag'}
      role="note"
    >
      <h4 className="lbl">{title}</h4>
      {effects.length === 0 && <p className="mono">{empty}</p>}
      <ul>
        {effects.slice(0, 5).map((e, i) => {
          const tone = deltaTone(e.target, e.delta);
          return (
            <li key={`${e.effectId}-${e.quarter}-${i}`}>
              <div className="mono row">
                <b className={tone}>
                  {formatDelta(i18n, e)} {targetLabel(i18n, e)}
                  {tone !== 'neutral' && ` (${t(`ui.tag.${tone}`)})`}
                </b>
                <span>· {originLabel(i18n, e)}</span>
              </div>
              <p className="mono">
                <span className="k">{t('ui.tag.assumption')}</span> {t(e.assumption)}
              </p>
              <p className="mono src">
                {t('ui.tag.source')} {e.sources.map((s) => sourceById(s)?.title ?? s).join(' · ')}
              </p>
            </li>
          );
        })}
      </ul>
      {effects.length > 5 && <p className="mono more">{t('ui.tag.more', { n: effects.length - 5 })}</p>}
      {hint && <p className="mono hint">{hint}</p>}
    </motion.aside>
  );
}
