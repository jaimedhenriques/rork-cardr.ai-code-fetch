// One-off migration helper: parse the generated Supabase types and emit
// best-effort DDL (tables, PKs, FKs, owner-based RLS) for the new project.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/integrations/supabase/types.ts', import.meta.url), 'utf8');

// Isolate the public.Tables { ... } block.
const tablesStart = src.indexOf('Tables: {');
const funcStart = src.indexOf('Functions: {', tablesStart);
const tablesBlock = src.slice(tablesStart, funcStart);

// Map a TS field type to a Postgres column type.
function pgType(name, tsType) {
  const t = tsType.replace(/\s*\|\s*null/g, '').trim();
  if (name === 'id') return 'uuid';
  if (/_id$/.test(name) && t === 'string') return 'uuid';
  if (t === 'string') {
    if (/_at$/.test(name) || /^(created|updated|deleted|completed|started|expires|sent|scheduled)/.test(name)) {
      return 'timestamptz';
    }
    return 'text';
  }
  if (t === 'number') return 'numeric';
  if (t === 'boolean') return 'boolean';
  if (t === 'Json') return 'jsonb';
  if (t === 'string[]') return 'text[]';
  if (t === 'number[]') return 'numeric[]';
  if (t === 'Json[]') return 'jsonb[]';
  return 'text';
}

// Walk each "tableName: {" entry.
const tableRe = /^ {6}([a-z_]+): \{$/gm;
let m;
const tables = [];
const indices = [];
while ((m = tableRe.exec(tablesBlock))) {
  tables.push({ name: m[1], start: m.index });
}
for (let i = 0; i < tables.length; i++) {
  tables[i].end = i + 1 < tables.length ? tables[i + 1].start : tablesBlock.length;
}

const ddl = [];
const rls = [];

for (const tbl of tables) {
  const block = tablesBlock.slice(tbl.start, tbl.end);
  const rowMatch = block.match(/Row: \{([\s\S]*?)\n {8}\}/);
  const insertMatch = block.match(/Insert: \{([\s\S]*?)\n {8}\}/);
  if (!rowMatch) continue;

  const cols = [];
  const colRe = /^ {10}([a-z_]+): (.+)$/gm;
  let c;
  while ((c = colRe.exec(rowMatch[1]))) {
    cols.push({ name: c[1], tsType: c[2].trim(), nullable: /\| null/.test(c[2]) });
  }

  // Optional (has default) columns come from the Insert block ("name?:").
  const optional = new Set();
  if (insertMatch) {
    const oRe = /^ {10}([a-z_]+)\?:/gm;
    let o;
    while ((o = oRe.exec(insertMatch[1]))) optional.add(o[1]);
  }

  const lines = [];
  for (const col of cols) {
    const type = pgType(col.name, col.tsType);
    let def = '';
    if (col.name === 'id' && type === 'uuid') def = ' primary key default gen_random_uuid()';
    else if (col.name === 'created_at') def = ' default now()';
    else if (col.name === 'updated_at') def = ' default now()';
    else if (optional.has(col.name) && type === 'boolean') def = ' default false';
    else if (optional.has(col.name) && type === 'jsonb') def = " default '{}'::jsonb";
    const notNull = !col.nullable && !optional.has(col.name) && col.name !== 'id' ? ' not null' : '';
    lines.push(`  "${col.name}" ${type}${def}${notNull}`);
  }
  ddl.push(`create table if not exists public."${tbl.name}" (\n${lines.join(',\n')}\n);`);

  // Owner-scoped RLS when a user_id column exists.
  const hasUser = cols.some((x) => x.name === 'user_id');
  rls.push(`alter table public."${tbl.name}" enable row level security;`);
  if (hasUser) {
    rls.push(
      `create policy "own_select_${tbl.name}" on public."${tbl.name}" for select using (auth.uid() = user_id);`,
      `create policy "own_insert_${tbl.name}" on public."${tbl.name}" for insert with check (auth.uid() = user_id);`,
      `create policy "own_update_${tbl.name}" on public."${tbl.name}" for update using (auth.uid() = user_id);`,
      `create policy "own_delete_${tbl.name}" on public."${tbl.name}" for delete using (auth.uid() = user_id);`
    );
  }
}

// Foreign keys, added after all tables exist.
const fkRe = /foreignKeyName: "([^"]+)"\s+columns: \["([^"]+)"\]\s+isOneToOne: \w+\s+referencedRelation: "([^"]+)"\s+referencedColumns: \["([^"]+)"\]/g;
const fks = [];
let f;
// Re-scan with table context.
for (const tbl of tables) {
  const block = tablesBlock.slice(tbl.start, tbl.end);
  let fm;
  const re = new RegExp(fkRe.source, 'g');
  while ((fm = re.exec(block))) {
    fks.push(
      `alter table public."${tbl.name}" add constraint "${fm[1]}" foreign key ("${fm[2]}") references public."${fm[3]}"("${fm[4]}") on delete cascade;`
    );
  }
}

const out = [
  '-- Auto-generated best-effort schema migration',
  'create extension if not exists "pgcrypto";',
  '',
  '-- Tables',
  ...ddl,
  '',
  '-- Foreign keys',
  ...fks,
  '',
  '-- Row Level Security',
  ...rls,
  '',
].join('\n');

writeFileSync(new URL('./schema.sql', import.meta.url), out);
console.log(`Generated ${tables.length} tables, ${fks.length} FKs.`);
