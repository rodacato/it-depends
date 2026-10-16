export type Messages = Record<string, string>;

type Nested = { [key: string]: string | Nested };

export function flatten(tree: Nested, prefix = ''): Messages {
  const out: Messages = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

export function interpolate(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();
}

export interface LocaleBundle {
  locale: string;
  messages: Messages;
}

// Compares every locale against the source locale: missing keys, extra keys, empty values, mismatched placeholders.
export function diffLocales(source: LocaleBundle, others: LocaleBundle[]): string[] {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(source.messages)) {
    if (!value.trim()) problems.push(`${source.locale}: empty value for ${key}`);
  }
  for (const other of others) {
    for (const [key, value] of Object.entries(source.messages)) {
      const translated = other.messages[key];
      if (translated === undefined) problems.push(`${other.locale}: missing ${key}`);
      else if (!translated.trim()) problems.push(`${other.locale}: empty value for ${key}`);
      else if (placeholders(translated).join() !== placeholders(value).join()) problems.push(`${other.locale}: placeholders differ in ${key}`);
    }
    for (const key of Object.keys(other.messages)) {
      if (!(key in source.messages)) problems.push(`${other.locale}: extra key ${key} not in ${source.locale}`);
    }
  }
  return problems;
}
