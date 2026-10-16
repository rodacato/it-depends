import { readRawContent } from '../../scripts/load-fs';
import { parseCampaign } from '../content/validate';

// Tests read content from disk, not through import.meta.glob, so a new chapter file is always seen.
export const campaign = parseCampaign(readRawContent());
