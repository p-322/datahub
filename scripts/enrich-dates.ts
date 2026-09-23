// Sawubona: add the date facets to a Tabulous delivery, on the way in.
//
//   npm run build:scripts        # once, after changing this or edtf.ts
//   set -o pipefail              # or a broken stage looks like success
//   jq -cn --stream 'fromstream(1|truncate_stream(inputs))' objects.json \
//     | node build-scripts/scripts/enrich-dates.js 2>/tmp/enrich.log \
//     | ../devops/scripts/es-bulk-load.py http://<voyager>:9200 sawubona-objects-v2 - \
//         --expect <the delivery's document count>
//
// Send this script's stderr to a file, as above. Both it and the loader
// report progress by rewriting one terminal line with \r, and on a shared
// terminal they overwrite each other into nonsense. The log still has the
// abort message if a line fails to parse; `tail -f` it to watch.
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
//
// Lines are split here rather than by `readline`. A run over the first
// delivery died after 655,773 documents on a line that ended mid-string,
// which is what a partial line looks like; the document itself, jq's
// streaming of it and this script in isolation all handled it correctly, so
// the truncation came from the reader. Reading chunks and splitting them
// ourselves has no pause/resume behaviour to get wrong.
import {toDateFacets} from '../packages/api/src/edtf.js';
import {exit, stderr, stdin, stdout} from 'node:process';
import {StringDecoder} from 'node:string_decoder';

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

// Refuses to guess. A malformed line means the pipeline lost data, and
// indexing the rest of the delivery as though nothing happened would leave a
// silently incomplete index — so this stops and says where.
function fail(text: string, reason: string): never {
  stderr.write(
    `\n\nenrich-dates: document ${(
      total + 1
    ).toLocaleString()} is not valid JSON` +
      ` (${text.length.toLocaleString()} characters): ${reason}\n` +
      `  begins: ${text.slice(0, 120)}\n` +
      `  ends:   ${text.slice(-80)}\n` +
      '  A line that ends mid-value means the input was truncated upstream,' +
      ' not that the document is bad.\n'
  );
  exit(1);
}

function handle(text: string): boolean {
  if (text.length === 0) {
    return true;
  }

  let document: Document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    fail(text, (error as Error).message);
  }

  const facets = toDateFacets(document.object?.dateCreated?.edtf);
  if (Object.keys(facets).length > 0) {
    document.facets = {...document.facets, ...facets};
    dated++;
  }

  total++;
  if (total % 20000 === 0) {
    report();
  }

  return stdout.write(JSON.stringify(document) + '\n');
}

// StringDecoder holds back a partial multi-byte character at a chunk
// boundary, so a name split across two reads survives.
const decoder = new StringDecoder('utf8');
let carry = '';

for await (const chunk of stdin) {
  const buffer = carry + decoder.write(Buffer.from(chunk as Uint8Array));

  let start = 0;
  let wrote = true;
  for (;;) {
    const end = buffer.indexOf('\n', start);
    if (end === -1) {
      break;
    }
    wrote = handle(buffer.slice(start, end));
    start = end + 1;
  }
  carry = buffer.slice(start);

  if (!wrote) {
    // The loader is slower than we are; wait for it to catch up.
    await new Promise(resolve => stdout.once('drain', resolve));
  }
}

// A delivery that ends without a final newline still has one last document.
handle(carry + decoder.end());

report();
stderr.write('\n');
