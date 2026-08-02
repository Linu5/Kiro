// Independent DOCX extraction via the zip central directory (robust to data
// descriptors and streamed entries). No dependency on the app's parser.
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

function readZip(buffer) {
  // End of central directory: signature 0x06054b50, scan backwards.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("no end-of-central-directory record: not a zip");

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let n = 0; n < count; n += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    // Local header: recompute the data start from its own name/extra lengths.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    try {
      entries.set(name, method === 0 ? data : inflateRawSync(data));
    } catch (error) {
      console.log(`  (could not inflate ${name}: ${error.message})`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const xmlToText = (xml) =>
  xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n");

const path = "test_cases/test_cases/blind_test_fall_detection.docx";
const buffer = readFileSync(path);
const entries = readZip(buffer);
console.log(`zip entries (${entries.size}): ${[...entries.keys()].slice(0, 12).join(", ")}`);

const xml = entries.get("word/document.xml");
if (!xml) {
  console.log("FAIL word/document.xml not found");
  process.exit(1);
}
const text = xmlToText(xml.toString("utf8"));
writeFileSync("tmp/blind.txt", text, "utf8");

const words = (text.match(/\S+/g) ?? []).length;
console.log(`\nbytes on disk: ${buffer.length}`);
console.log(`extracted chars: ${text.length}, words: ${words}, non-empty lines: ${text.split("\n").filter((l) => l.trim()).length}`);

const refHeadings = [...text.matchAll(/^[ \t]*References[ \t]*$/gm)].length;
const refEntries = [...text.matchAll(/(?:^|\n)\s*\[(\d{1,3})\]\s+/g)].map((m) => Number(m[1]));
const markers = new Set([...text.matchAll(/\[(\d{1,3})\]/g)].map((m) => m[1]));
const parenYears = [...text.matchAll(/\((?:19|20)\d{2}[a-z]?\)/g)].length;
const quoted = [...text.matchAll(/["“][^"”\n]{12,}["”]/g)].length;

console.log(`\n-- neutral structural metadata --`);
console.log(`"References" headings: ${refHeadings}`);
console.log(`numbered reference entries: ${refEntries.length}${refEntries.length ? ` (${Math.min(...refEntries)}-${Math.max(...refEntries)})` : ""}`);
console.log(`distinct bracketed markers in the file: ${markers.size}`);
console.log(`parenthetical year forms: ${parenYears}`);
console.log(`double-quoted fragments (>=12 chars): ${quoted}`);
