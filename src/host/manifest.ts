import type { Campaign } from '../engine/schema';
import type { Messages } from '../i18n/messages';
import type { Capability } from './protocol';
import { PROTOCOL_VERSION } from './protocol';

export const COURSE_ID = 'it-depends';
export const COURSE_VERSION = '0.1.0';

export const REQUIRED_CAPABILITIES: Capability[] = ['progress'];
// Requested but optional: the course is fully usable without an LLM.
export const OPTIONAL_CAPABILITIES: Capability[] = ['llm'];

export interface CourseManifest {
  id: string;
  version: string;
  protocol: number;
  entry: string;
  locales: string[];
  title: Record<string, string>;
  description: Record<string, string>;
  programmingLanguages: string[];
  units: { id: string; title: Record<string, string> }[];
  capabilities: Capability[];
  // Extension fields; the Dojo manifest schema ignores unknown keys.
  requiredCapabilities: Capability[];
  optionalCapabilities: Capability[];
}

export function buildManifest(campaign: Campaign, locales: Record<string, Messages>): CourseManifest {
  const tags = Object.keys(locales);
  const per = (key: string) => Object.fromEntries(tags.map((l) => [l, locales[l]?.[key] ?? '']));
  return {
    id: COURSE_ID,
    version: COURSE_VERSION,
    protocol: PROTOCOL_VERSION,
    entry: './index.html',
    locales: tags,
    title: per('ui.meta.title'),
    description: per('ui.meta.description'),
    programmingLanguages: [],
    units: campaign.chapters.map((c) => ({ id: c.id, title: per(`chapters.${c.id}.title`) })),
    capabilities: [...REQUIRED_CAPABILITIES, ...OPTIONAL_CAPABILITIES],
    requiredCapabilities: REQUIRED_CAPABILITIES,
    optionalCapabilities: OPTIONAL_CAPABILITIES,
  };
}
