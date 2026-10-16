import { checkCampaign, ContentError, parseCampaign } from '../src/content/validate';
import { readLocales, readRawContent } from './load-fs';

try {
  const campaign = parseCampaign(readRawContent());
  const problems = checkCampaign(campaign, readLocales());
  if (problems.length) throw new ContentError(problems);
  console.log(`content ok: ${campaign.chapters.length} chapters, ${campaign.sources.length} sources`);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
