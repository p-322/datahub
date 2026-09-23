// A server component may render a client component, but it may not READ a
// value out of a 'use client' module. Next turns every export of such a
// module into a client reference, so an enum member or a plain object comes
// back as an unresolvable reference and the page dies on first request —
// with nothing wrong at build time. That is how the search page went down
// with:
//
//   Could not find the module
//   ".../use-searchable-facet.tsx#FacetSortBy#chronological"
//   in the React Client Manifest
//
// `next build` does not catch it, because a dynamic page is never
// prerendered. So this runs in CI instead. Run: npm run check:rsc
import fs from 'node:fs';
import path from 'node:path';

const packages = {
  '@p-322/list-store': 'packages/list-store/src',
  '@p-322/ui': 'packages/ui',
};

const isUseClient = source =>
  /^\s*['"]use client['"]/.test(source.split('\n').slice(0, 3).join('\n'));

// Components are rendered by the server, never read, so they are fine. A
// value is anything else: an enum, a lowercase function, a plain constant.
function exportsOf(source) {
  const values = new Map();
  for (const match of source.matchAll(
    /^export\s+(const|function|class|enum|let|var)\s+(\w+)/gm
  )) {
    const [, kind, name] = match;
    const isComponent =
      /^[A-Z]/.test(name) && (kind === 'function' || kind === 'const');
    if (kind === 'enum' || !isComponent) {
      values.set(name, kind);
    }
  }
  return values;
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        walk(full, visit);
      }
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      visit(full);
    }
  }
}

const clientValues = {};
for (const [name, dir] of Object.entries(packages)) {
  const map = new Map();
  walk(dir, file => {
    const source = fs.readFileSync(file, 'utf8');
    if (!isUseClient(source)) return;
    for (const [exported, kind] of exportsOf(source)) {
      map.set(exported, {file, kind});
    }
  });
  clientValues[name] = map;
}

const problems = [];
walk('apps/researcher/src', file => {
  const source = fs.readFileSync(file, 'utf8');
  if (isUseClient(source)) return;
  for (const match of source.matchAll(
    /import\s+(type\s+)?\{([^}]+)\}\s+from\s+'(@p-322\/[^']+)'/g
  )) {
    if (match[1]) continue; // `import type` is erased before it can matter
    const pkg = match[3].replace(/\/list$/, '');
    for (const raw of match[2].split(',')) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)[0]
        .replace(/^type\s+/, '');
      if (!name || /^type\s/.test(raw.trim())) continue;
      const hit = clientValues[pkg]?.get(name);
      if (hit) {
        problems.push(
          `${file}\n    reads ${hit.kind} ${name} from ${hit.file} ('use client')`
        );
      }
    }
  }
});

if (problems.length) {
  console.error(
    'Server components reading values out of client modules:\n  ' +
      problems.join('\n  ') +
      "\n\nMove the value to a module without 'use client' (for list-store, " +
      'that is src/definitions.ts).'
  );
  // Not process.exit: that would cut off the write above if stderr is a pipe.
  process.exitCode = 1;
} else {
  console.log(
    'RSC boundary: no server component reads a value from a client module.'
  );
}
