import { useState } from 'react';
import { useI18n } from './i18n';
import { Vellum } from './Vellum';

interface Props {
  continueSheet: number | null;
  damaged: boolean;
  onBegin: () => void;
  onNewCampaign: () => void;
}

export function CoverPanel({ continueSheet, damaged, onBegin, onNewCampaign }: Props) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  return (
    <Vellum x={870} y={60} w={534} rotate={-1.6} className="cover" label={t('ui.meta.title')} testId="cover">
      <div className="kicker mono">{t('ui.cover.kicker')}</div>
      <h1 className="lbl">{t('ui.cover.title')}</h1>
      <p className="subtitle lbl">{t('ui.cover.subtitle')}</p>
      <p className="mono">{t('company.pitch')}</p>
      <p className="mono">{t('company.role')}</p>
      <p className="mono voice">{t('ui.cover.opening')}</p>
      <p className="mono dim">{t('ui.cover.howTo')}</p>
      {damaged && <p className="mono red">{t('ui.errors.damaged')}</p>}
      <div className="actions">
        {continueSheet !== null && !confirming && (
          <button type="button" className="link mono" onClick={() => setConfirming(true)} data-testid="new-campaign">
            {t('ui.cover.newCampaign')}
          </button>
        )}
        <button type="button" className="ink-button lbl" onClick={onBegin} data-testid="begin">
          {continueSheet !== null ? t('ui.cover.continue', { n: continueSheet }) : t('ui.cover.begin')}
        </button>
      </div>
      {confirming && <ConfirmReset onYes={onNewCampaign} onNo={() => setConfirming(false)} />}
    </Vellum>
  );
}

export function ConfirmReset({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const { t } = useI18n();
  return (
    <div className="confirm" role="alertdialog" aria-label={t('ui.cover.confirmReset')}>
      <p className="mono red">{t('ui.cover.confirmReset')}</p>
      <div className="actions">
        <button type="button" className="link mono" onClick={onNo} autoFocus>
          {t('ui.cover.confirmNo')}
        </button>
        <button type="button" className="ink-button lbl danger" onClick={onYes} data-testid="confirm-reset">
          {t('ui.cover.confirmYes')}
        </button>
      </div>
    </div>
  );
}
