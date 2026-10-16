import { diffLocales } from '../src/i18n/messages';
import { readLocales } from './load-fs';

const [source, ...others] = readLocales();
if (!source) {
  console.error('no locales found');
  process.exit(1);
}
const problems = diffLocales(source, others);
if (problems.length) {
  console.error(`i18n check failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`i18n ok: ${Object.keys(source.messages).length} keys in ${[source, ...others].map((l) => l.locale).join(', ')}`);
