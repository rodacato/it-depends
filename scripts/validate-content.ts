import { ChapterSchema } from '../src/engine/schema';
import { checkCampaign, ContentError, parseCampaign } from '../src/content/validate';
import { readLocales, readRawContent } from './load-fs';

// --lenient skips chapter files that do not parse yet, so authors working in parallel can check their own.
const lenient = process.argv.includes('--lenient');

try {
  const raw = readRawContent();
  if (lenient) {
    raw.chapters = raw.chapters.filter((c, i) => {
      const ok = ChapterSchema.safeParse(c).success;
      if (!ok) console.warn(`skipping chapter[${i}] (${(c as { id?: string }).id ?? '?'}): does not parse yet`);
      return ok;
    });
  }
  const campaign = parseCampaign(raw);
  const problems = checkCampaign(campaign, readLocales());
  if (problems.length) throw new ContentError(problems);
  console.log(`content ok: ${campaign.chapters.length} chapters, ${campaign.sources.length} sources`);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
