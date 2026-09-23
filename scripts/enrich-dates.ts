// Sawubona: add the date facets to a Tabulous delivery, on the way in.
//
//   jq -cn --stream 'fromstream(1|truncate_stream(inputs))' objects.json \
//     | npx tsx scripts/enrich-dates.ts \
//     | ../devops/scripts/es-bulk-load.py http://<voyager>:9200 sawubona-objects-v2 -
//
// Reads newline-delimited documents on stdin, writes them back with the date
// facets added, and leaves everything else untouched.
//
// Tabulous ships `object.dateCreated.edtf` inside the payload, which the
// index mapping stores but does not index. This derives the fields the
// search page needs: a year range with open bounds where the date is open,
// the precision and certainty the notation states, and the centuries and
// decades the date touches. The derivation is packages/api/src/edtf.ts — the
// same function that formats the date on the page, so a facet and a label
// can never disagree.
//
// `jq` does the array splitting (the loader already requires it); this only
// transforms one line at a time, so neither file is held in memory.
import {toDateFacets} from '@colonial-collections/api';
import {createInterface} from 'node:readline';
import {stderr, stdin, stdout} from 'node:process';

interface Document {
  facets?: Record<string, unknown>;
  object?: {dateCreated?: {edtf?: string}};
}

let total = 0;
let dated = 0;
const started = Date.now();

function report() {
  const seconds = Math.max((Date.now() - started) / 1000, 0.001);
  stderr.write(
    `\r  ${total.toLocaleString()} documents, ${dated.toLocaleString()} dated, ` +
      `${Math.round(total / seconds).toLocaleString()}/s`
  );
}

const lines = createInterface({input: stdin, crlfDelay: Infinity});

for await (const line of lines) {
  if (line.trim() === '') {
    continue;
  }

  const document: Document = JSON.parse(line);
  const facets = toDateFacets(document.object?.dateCreated?.edtf);

  if (Object.keys(facets).length > 0) {
    document.facets = {...document.facets, ...facets};
    dated++;
  }
  total++;
  if (total % 20000 === 0) {
    report();
  }

  if (!stdout.write(JSON.stringify(document) + '\n')) {
    // The loader is slower than we are; wait for it to drain.
    await new Promise(resolve => stdout.once('drain', resolve));
  }
}

report();
stderr.write('\n');
