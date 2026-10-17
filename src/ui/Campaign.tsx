import { AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { CityModel } from '../city/layout';
import { extendOrder, layoutCity, slotOrder } from '../city/layout';
import { campaign, chapterById } from '../content';
import { chapterWindow, forecastOption, snapshotAt } from '../engine/queries';
import type { Adr } from '../engine/rubric';
import { emptyAdr, evaluateAdr } from '../engine/rubric';
import type { AdrField, Chapter, Decision, Forces } from '../engine/schema';
import { revisionLetter, simulate } from '../engine/simulate';
import type { AdrEvaluation, HostBridge, HostSession } from '../host/HostBridge';
import { AdrPanel } from './AdrPanel';
import { BriefingPanel } from './BriefingPanel';
import { CompareView } from './CompareView';
import { CompletePanel } from './CompletePanel';
import { ConfirmReset, CoverPanel } from './CoverPanel';
import { useI18n } from './i18n';
import { IssuedPanel } from './IssuedPanel';
import type { ChapterPhase, Progress } from './progress';
import { freshProgress } from './progress';
import { quarterLabel } from './quarters';
import { ReviewPanel } from './ReviewPanel';
import { RewindPanel } from './RewindPanel';
import type { Playhead } from './scene';
import { buildScene } from './scene';
import { SiteSheet } from './SiteSheet';
import { finalState, timelapseAt, timelapseDuration } from './timelapse';
import type { RevisionRow } from './TitleBlock';
import { usePrefersReducedMotion, useClock } from './useClock';
import { Vellum } from './Vellum';
import { Walkthrough, walkthroughDisabled } from './Walkthrough';

interface Props {
  bridge: HostBridge;
  session: HostSession;
  progress: Progress;
  setProgress: (update: (p: Progress) => Progress) => void;
  setLocale: (l: string) => void;
  damaged: boolean;
}

interface RewindState {
  chapterId: string;
  letter: string;
  optionId: string | null;
  rationale: string;
  comparing: boolean;
}

export function Campaign({ bridge, session, progress, setProgress, setLocale, damaged }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const reduced = usePrefersReducedMotion();
  const chapters = campaign.chapters;
  // Every visit opens on the cover; "Continue" picks up where the drawing set was left.
  const [opened, setOpened] = useState(false);
  const phase: ChapterPhase | 'cover' = opened && progress.current ? progress.current.phase : 'cover';
  const chapter: Chapter = progress.current ? chapterById(progress.current.chapterId) : chapters[0]!;
  const window = chapterWindow(chapter);
  const decision = progress.decisions.find((d) => d.chapterId === chapter.id);

  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [variant, setVariant] = useState<string | null>(null);
  const [adrDraft, setAdrDraft] = useState<Adr>(emptyAdr());
  const [sensei, setSensei] = useState<AdrEvaluation | null | 'pending'>(null);
  const [rewind, setRewind] = useState<RewindState | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [finished, setFinished] = useState(false);
  const [guideRequested, setGuideRequested] = useState(false);
  const [guideOff] = useState(() => walkthroughDisabled(globalThis.location?.search ?? ''));

  const timeline = useMemo(
    () => simulate(campaign, progress.decisions, { seed: progress.seed, untilQuarter: window.end }),
    [progress.decisions, progress.seed, window.end],
  );
  const order = useMemo(() => slotOrder(timeline.snapshots.map((s) => s.topology)), [timeline]);
  const revisions = snapshotAt(timeline, window.end).revisions;
  const letterIndex = (letter: string) => Math.max(0, revisions.findIndex((r) => r.letter === letter));
  const scene = useMemo(() => buildScene(timeline, window, order, letterIndex), [timeline, window.start, window.end, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const letter = decision ? (revisions.find((r) => r.chapterId === chapter.id)?.letter ?? 'A') : revisionLetter(revisions.length);

  const rows: RevisionRow[] = revisions.map((r) => ({
    letter: r.letter,
    issued: t('ui.quarterShort', { q: (r.quarter % 4) + 1, y: Math.floor(r.quarter / 4) + 1 }),
    description: t(`chapters.${r.chapterId}.options.${r.optionId}.title`),
    chapterId: r.chapterId,
  }));

  // Option previews: what each alternate would draw on the site, and where the forces would land.
  const othersDecisions = progress.decisions.filter((d) => d.chapterId !== chapter.id);
  const forecasts = useMemo(() => {
    if (phase !== 'briefing') return null;
    return Object.fromEntries(
      chapter.dilemma.options.map((o) => [o.id, forecastOption(campaign, othersDecisions, chapter, o.id, progress.seed, variant ?? undefined)]),
    );
  }, [phase, chapter, variant, progress.seed, progress.decisions]); // eslint-disable-line react-hooks/exhaustive-deps
  const previewModels = useMemo(() => {
    if (!forecasts) return {} as Record<string, CityModel>;
    let full = order;
    for (const f of Object.values(forecasts)) full = extendOrder(full, f.after.topology);
    return Object.fromEntries(Object.entries(forecasts).map(([id, f]) => [id, layoutCity(f.after.topology, f.after.loads, f.after.forces, full)]));
  }, [forecasts, order]);
  const previewId = hoveredOption ?? selected;
  const preview = previewId && forecasts?.[previewId] && previewModels[previewId] ? { model: previewModels[previewId]!, forces: forecasts[previewId]!.after.forces } : null;
  const variantSpec = chapter.contextVariants.find((v) => v.id === variant);
  const startSnapshot = snapshotAt(timeline, window.start);
  const startForces: Forces | undefined = variantSpec ? { ...startSnapshot.forces, ...variantSpec.forces } : undefined;
  const startContext = variantSpec ? { ...startSnapshot.context, ...variantSpec.context } : startSnapshot.context;

  // Time-lapse clock.
  const quarters = window.end - window.start;
  const duration = timelapseDuration(scene.clouds.length, scene.leaders.length);
  const playing = phase === 'timelapse' && !reduced;
  const ms = useClock(playing, `${chapter.id}-${progress.decisions.length}-${letter}`, duration);
  const tl = reduced ? finalState(quarters, scene.clouds.length, scene.leaders.length) : timelapseAt(ms, quarters, scene.clouds.length, scene.leaders.length);
  useEffect(() => {
    if (phase === 'timelapse' && (reduced || tl.done)) goPhase('consequences');
  }, [phase, reduced, tl.done]); // eslint-disable-line react-hooks/exhaustive-deps

  const playhead: Playhead =
    phase === 'cover' || phase === 'briefing' ? { kind: 'start' } : phase === 'timelapse' && !reduced ? { kind: 'playing', state: tl } : { kind: 'end' };
  const visibleRows = phase === 'cover' || phase === 'briefing' ? rows.filter((r) => r.chapterId !== chapter.id) : rows;

  function goPhase(next: ChapterPhase, chapterId = chapter.id) {
    setProgress((p) => ({ ...p, started: true, current: { chapterId, phase: next } }));
  }

  function reportStarted(chapterId: string) {
    if (!progress.completed.includes(chapterId)) bridge.unitStarted(chapterId);
  }

  function begin() {
    const target = progress.current?.chapterId ?? chapters[0]!.id;
    const resumed = progress.current?.phase ?? 'briefing';
    reportStarted(target);
    if (resumed === 'adr') {
      const optionId = progress.decisions.find((d) => d.chapterId === target)?.optionId;
      setAdrDraft(progress.adrs[target] ?? prefilledAdr(target, optionId, progress.rationales[target]));
    }
    setOpened(true);
    goPhase(resumed, target);
  }

  function issue() {
    if (!selected) return;
    const d: Decision = { chapterId: chapter.id, optionId: selected };
    setProgress((p) => ({
      ...p,
      decisions: [...p.decisions.filter((x) => x.chapterId !== chapter.id), d],
      rationales: { ...p.rationales, [chapter.id]: draft.trim() },
      current: { chapterId: chapter.id, phase: 'timelapse' },
    }));
    setHoveredOption(null);
    setVariant(null);
  }

  function prefilledAdr(chapterId: string, optionId: string | undefined, rationale: string | undefined): Adr {
    const optionTitle = optionId ? t(`chapters.${chapterId}.options.${optionId}.title`) : '';
    return { ...emptyAdr(), decision: `${optionTitle}. ${rationale ?? ''}`.trim() };
  }

  function openAdr() {
    setAdrDraft(progress.adrs[chapter.id] ?? prefilledAdr(chapter.id, decision?.optionId, progress.rationales[chapter.id]));
    goPhase('adr');
  }

  async function submitAdr() {
    const adr = adrDraft;
    setProgress((p) => ({
      ...p,
      adrs: { ...p.adrs, [chapter.id]: adr },
      completed: p.completed.includes(chapter.id) ? p.completed : [...p.completed, chapter.id],
      current: { chapterId: chapter.id, phase: 'review' },
    }));
    bridge.unitCompleted(chapter.id, { optionId: decision?.optionId, rationale: progress.rationales[chapter.id], adr });
    if (chapter.id === chapters[chapters.length - 1]!.id) bridge.courseCompleted();
    if (session.canEvaluateAdr) {
      setSensei('pending');
      const result = await bridge.evaluateAdr({
        chapterId: chapter.id,
        locale: i18n.locale,
        adr,
        questions: chapter.review.questions.map((q) => ({ id: q.id, text: t(`chapters.${chapter.id}.review.${q.id}`) })),
      });
      setSensei(result);
    }
  }

  function nextSheet() {
    const i = chapters.findIndex((c) => c.id === chapter.id);
    const next = chapters[i + 1];
    if (!next) return;
    setSelected(null);
    setDraft('');
    setSensei(null);
    reportStarted(next.id);
    goPhase('briefing', next.id);
  }

  function newCampaign() {
    setConfirmReset(false);
    setRewind(null);
    setSelected(null);
    setDraft('');
    setFinished(false);
    setSensei(null);
    setOpened(false);
    setProgress((p) => ({ ...freshProgress(p.locale), started: false, walkthroughSeen: p.walkthroughSeen }));
  }

  function startRewind(chapterId: string, revLetter: string) {
    setRewind({ chapterId, letter: revLetter, optionId: null, rationale: '', comparing: false });
  }

  function adoptAlternate() {
    if (!rewind?.optionId) return;
    const { chapterId, optionId, rationale } = rewind;
    setProgress((p) => ({
      ...p,
      decisions: p.decisions.map((d) => (d.chapterId === chapterId ? { ...d, optionId } : d)),
      rationales: { ...p.rationales, [chapterId]: rationale.trim() },
      adrs: Object.fromEntries(Object.entries(p.adrs).filter(([k]) => k !== chapterId)),
      completed: p.completed.filter((c) => c !== chapterId),
      current: { chapterId, phase: 'adr' },
    }));
    setAdrDraft(prefilledAdr(chapterId, optionId, rationale.trim()));
    setRewind(null);
    setFinished(false);
  }

  const showGuide = guideRequested || (phase === 'briefing' && !rewind && !progress.walkthroughSeen && !guideOff);
  function closeGuide() {
    setGuideRequested(false);
    setProgress((p) => ({ ...p, walkthroughSeen: true }));
  }

  const results = useMemo(() => evaluateAdr(progress.adrs[chapter.id] ?? emptyAdr(), chapter.rubric, i18n.terms), [progress.adrs, chapter, i18n]);
  const continueSheet = progress.started && progress.current ? chapterById(progress.current.chapterId).number : null;
  const hasNext = chapters.findIndex((c) => c.id === chapter.id) < chapters.length - 1;

  if (rewind?.comparing && rewind.optionId) {
    const rewindChapter = chapterById(rewind.chapterId);
    const alternate = progress.decisions.map((d) => (d.chapterId === rewind.chapterId ? { ...d, optionId: rewind.optionId! } : d));
    return (
      <CompareView
        chapter={rewindChapter}
        letter={rewind.letter}
        original={progress.decisions}
        alternate={alternate}
        seed={progress.seed}
        untilQuarter={window.end}
        reducedMotion={reduced}
        onLocale={setLocale}
        onKeep={() => setRewind(null)}
        onAdopt={adoptAlternate}
      />
    );
  }

  const caption = t('ui.caption', { n: chapter.number, total: chapters.length, quarter: quarterLabel(i18n, window.start) });
  return (
    <SiteSheet
      label={t('ui.sheetLabel', { n: chapter.number })}
      caption={caption}
      timeline={timeline}
      scene={scene}
      window={window}
      playhead={playhead}
      preview={phase === 'briefing' ? preview : null}
      startForces={phase === 'briefing' ? startForces : undefined}
      rows={visibleRows}
      sheetNumber={chapter.number}
      sheets={chapters.length}
      interactive={phase !== 'cover'}
      reducedMotion={reduced}
      onLocale={setLocale}
      onRestore={phase === 'review' || phase === 'consequences' ? (r) => startRewind(r.chapterId, r.letter) : undefined}
      onNewCampaign={() => setConfirmReset(true)}
      onHelp={phase === 'cover' ? undefined : () => setGuideRequested(true)}
    >
      <AnimatePresence>
        {phase === 'cover' && <CoverPanel key="cover" continueSheet={continueSheet} damaged={damaged} onBegin={begin} onNewCampaign={newCampaign} />}
        {phase === 'briefing' && (
          <BriefingPanel
            key={`brief-${chapter.id}`}
            chapter={chapter}
            totalSheets={chapters.length}
            quarterLabel={quarterLabel(i18n, window.start)}
            context={startContext}
            current={scene.models[0]!}
            previews={previewModels}
            selected={selected}
            hovered={hoveredOption}
            rationale={draft}
            nextLetter={letter}
            variant={variant}
            onVariant={setVariant}
            onHover={setHoveredOption}
            onSelect={setSelected}
            onRationale={setDraft}
            onIssue={issue}
          />
        )}
        {phase === 'consequences' && decision && !rewind && (
          <IssuedPanel
            key={`issued-${chapter.id}`}
            campaign={campaign}
            chapter={chapter}
            optionId={decision.optionId}
            rationale={progress.rationales[chapter.id] ?? ''}
            letter={letter}
            months={quarters * 3}
            scene={scene}
            incidents={timeline.snapshots.slice(window.start + 1, window.end + 1).flatMap((s) => s.incidents)}
            inspections={snapshotAt(timeline, window.end).inspections}
            onWriteAdr={openAdr}
          />
        )}
        {phase === 'adr' && (
          <AdrPanel
            key={`adr-${chapter.id}`}
            chapter={chapter}
            number={chapter.number}
            title={t(`chapters.${chapter.id}.title`)}
            letter={letter}
            quarterLabel={quarterLabel(i18n, window.start)}
            adr={adrDraft}
            onChange={(f: AdrField, v: string) => setAdrDraft((a) => ({ ...a, [f]: v }))}
            onSubmit={submitAdr}
          />
        )}
        {phase === 'review' && !rewind && !finished && (
          <ReviewPanel
            key={`review-${chapter.id}`}
            chapter={chapter}
            letter={letter}
            results={results}
            sensei={sensei}
            hasNext={hasNext}
            onNext={nextSheet}
            onFinish={() => setFinished(true)}
            onRestore={() => startRewind(chapter.id, letter)}
            onEditAdr={openAdr}
          />
        )}
        {finished && phase === 'review' && !rewind && (
          <CompletePanel
            key="complete"
            rows={rows}
            start={campaign.company.initialForces}
            end={snapshotAt(timeline, window.end).forces}
            onClose={() => setFinished(false)}
            onNewCampaign={() => setConfirmReset(true)}
          />
        )}
        {rewind && !rewind.comparing && (
          <RewindPanel
            key="rewind"
            chapter={chapterById(rewind.chapterId)}
            letter={rewind.letter}
            issuedOption={progress.decisions.find((d) => d.chapterId === rewind.chapterId)?.optionId ?? ''}
            optionId={rewind.optionId}
            rationale={rewind.rationale}
            onOption={(id) => setRewind({ ...rewind, optionId: id })}
            onRationale={(s) => setRewind({ ...rewind, rationale: s })}
            onCompare={() => setRewind({ ...rewind, comparing: true })}
            onCancel={() => setRewind(null)}
          />
        )}
        {confirmReset && (
          <Vellum key="reset" x={1010} y={470} w={380} rotate={1} className="reset" testId="reset">
            <ConfirmReset onYes={newCampaign} onNo={() => setConfirmReset(false)} />
          </Vellum>
        )}
      </AnimatePresence>
      {showGuide && <Walkthrough onDone={closeGuide} />}
      {phase === 'timelapse' && !reduced && (
        <button type="button" className="skip mono" onClick={() => goPhase('consequences')} data-testid="skip">
          {t('ui.timelapse.skip')}
        </button>
      )}
    </SiteSheet>
  );
}
