import { LOCALES } from '../i18n/locales';
import { useI18n } from './i18n';
import { TITLE_BLOCK } from './scene';

export interface RevisionRow {
  letter: string;
  issued: string;
  description: string;
  chapterId: string;
}

interface Props {
  sheet: number;
  sheets: number;
  quarterLabel: string;
  rows: RevisionRow[];
  // 0..1: the newest row is inked last, left to right.
  inkLast: number;
  onLocale: (locale: string) => void;
  onRestore?: (row: RevisionRow) => void;
  onNewCampaign?: () => void;
  onHelp?: () => void;
  compact?: boolean;
}

// The title block is the ADR log: every issued decision is a revision row.
export function TitleBlock({ sheet, sheets, quarterLabel, rows, inkLast, onLocale, onRestore, onNewCampaign, onHelp, compact }: Props) {
  const { t, locale } = useI18n();
  return (
    <div className="title-block" style={{ left: TITLE_BLOCK.x, top: TITLE_BLOCK.y, width: TITLE_BLOCK.w, height: TITLE_BLOCK.h }} data-testid="title-block">
      <div className="tb-head">
        <div>
          <div className="tb-title lbl">{t('ui.meta.title')}</div>
          <div className="tb-sub mono">{t('ui.titleBlock.project')}</div>
        </div>
        <div className="tb-number lbl">A-{String(sheet).padStart(2, '0')}</div>
      </div>
      <div className="tb-cells">
        <div>
          <span className="mono k">{t('ui.titleBlock.sheet')}</span>
          <span className="lbl v">{t('ui.titleBlock.sheetOf', { n: sheet, total: sheets })}</span>
        </div>
        <div>
          <span className="mono k">{t('ui.titleBlock.quarter')}</span>
          <span className="lbl v" data-testid="tb-quarter">{quarterLabel}</span>
        </div>
        <div>
          <span className="mono k">{t('ui.titleBlock.language')}</span>
          <span className="lbl v locales">
            {LOCALES.map((l) => (
              <button key={l} type="button" className={l === locale ? 'on' : ''} aria-pressed={l === locale} onClick={() => onLocale(l)} disabled={compact}>
                {t(`ui.locales.${l}`)}
              </button>
            ))}
          </span>
        </div>
      </div>
      <div className="tb-table mono">
        <div className="tb-row tb-header">
          <span>{t('ui.titleBlock.rev')}</span>
          <span>{t('ui.titleBlock.issued')}</span>
          <span>{t('ui.titleBlock.description')}</span>
        </div>
        {rows.length === 0 && <div className="tb-empty">{t('ui.titleBlock.empty')}</div>}
        {rows.map((r, i) => {
          const last = i === rows.length - 1;
          const ink = last ? inkLast : 1;
          if (ink <= 0) return null;
          return (
            <button
              key={`${r.letter}-${r.chapterId}`}
              type="button"
              className="tb-row tb-rev"
              style={{ clipPath: `inset(0 ${(1 - ink) * 100}% 0 0)` }}
              onClick={() => onRestore?.(r)}
              disabled={!onRestore}
              title={onRestore ? t('ui.titleBlock.restoreHint', { letter: r.letter }) : undefined}
              data-testid={`rev-${r.letter}`}
            >
              <span className="lbl red">{r.letter}</span>
              <span>{r.issued}</span>
              <span className="desc">{r.description}</span>
            </button>
          );
        })}
      </div>
      <div className="tb-foot mono">
        <span>{t('ui.titleBlock.footer')}</span>
        <span className="tb-actions">
          {onHelp && (
            <button type="button" className="link" onClick={onHelp} data-testid="help">
              {t('ui.titleBlock.help')}
            </button>
          )}
          {onNewCampaign && (
            <button type="button" className="link" onClick={onNewCampaign}>
              {t('ui.titleBlock.newCampaign')}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
