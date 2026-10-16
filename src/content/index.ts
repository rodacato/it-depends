import company from './company.json';
import sources from './sources.json';
import { parseCampaign } from './validate';

// Adding a chapter is adding a JSON file to ./chapters; the engine never changes.
const chapterModules = import.meta.glob<{ default: unknown }>('./chapters/*.json', { eager: true });

export const campaign = parseCampaign({
  company,
  sources,
  chapters: Object.keys(chapterModules)
    .sort()
    .map((path) => chapterModules[path]?.default),
});

export function chapterById(id: string) {
  const chapter = campaign.chapters.find((c) => c.id === id);
  if (!chapter) throw new Error(`unknown chapter ${id}`);
  return chapter;
}

export function sourceById(id: string) {
  return campaign.sources.find((s) => s.id === id);
}
