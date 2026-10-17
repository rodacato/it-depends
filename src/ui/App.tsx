import type { ReactNode } from 'react';
import { Component, useCallback, useEffect, useState } from 'react';
import { detectLocale, LOCALES } from '../i18n/locales';
import type { HostBridge, HostSession } from '../host';
import { connectHost } from '../host';
import { Campaign } from './Campaign';
import { I18nProvider, makeI18n } from './i18n';
import type { Progress } from './progress';
import { loadProgress, restoreFromHost, safeStorage, saveProgress } from './progress';
import { campaign } from '../content';

const hostChapters = campaign.chapters.map((c) => ({ id: c.id, options: c.dilemma.options.map((o) => o.id) }));

type Boot ={ status: 'loading' } | { status: 'ready'; bridge: HostBridge; session: HostSession };

export function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });
  const [{ progress, damaged }, setLoaded] = useState(() => loadProgress(safeStorage()));
  const [locale, setLocaleState] = useState(() => progress.locale ?? detectLocale(navigator.languages ?? [navigator.language]));

  useEffect(() => {
    connectHost().then(({ bridge, session }) => {
      if (session.locale && LOCALES.length) setLocaleState(detectLocale([session.locale]));
      if (session.mode === 'embedded') {
        setLoaded((prev) => ({ ...prev, progress: restoreFromHost(prev.progress, session.progress, hostChapters) }));
      }
      setBoot({ status: 'ready', bridge, session });
    });
  }, []);

  useEffect(() => {
    if (boot.status !== 'ready') return;
    return boot.bridge.onLocaleChange((l) => setLocaleState(detectLocale([l])));
  }, [boot]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = makeI18n(locale).t('ui.meta.title');
  }, [locale]);

  const setProgress = useCallback((update: (p: Progress) => Progress) => {
    setLoaded((prev) => {
      const next = update(prev.progress);
      saveProgress(safeStorage(), next);
      return { progress: next, damaged: false };
    });
  }, []);

  const setLocale = useCallback(
    (l: string) => {
      setLocaleState(l);
      setProgress((p) => ({ ...p, locale: l }));
    },
    [setProgress],
  );

  return (
    <I18nProvider locale={locale}>
      <SheetErrorBoundary>
        {boot.status === 'loading' ? (
          <Loading />
        ) : (
          <Campaign bridge={boot.bridge} session={boot.session} progress={progress} setProgress={setProgress} setLocale={setLocale} damaged={damaged} />
        )}
      </SheetErrorBoundary>
    </I18nProvider>
  );
}

function Loading() {
  const { t } = makeI18n(document.documentElement.lang || 'en');
  return (
    <div className="state-screen" role="status">
      <svg viewBox="0 0 400 250" width={400} height={250} aria-hidden="true">
        <rect x={10} y={10} width={380} height={230} className="pen-border" pathLength={1} />
      </svg>
      <p className="mono">{t('ui.loading')}</p>
    </div>
  );
}

class SheetErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    const { t } = makeI18n(document.documentElement.lang || 'en');
    return (
      <div className="state-screen torn" role="alert">
        <h1 className="lbl">{t('ui.errors.crash')}</h1>
        <p className="mono">{t('ui.errors.crashBody')}</p>
        <button type="button" className="ink-button lbl light" onClick={() => window.location.reload()}>
          {t('ui.errors.reload')}
        </button>
      </div>
    );
  }
}
