// Anti-duplication audit for the lobby preview tables.
//   node scripts/audit-looks.mjs
// Re-derives every per-look image set from public/preview-data.js (the same module
// the browser imports) and fails if any look repeats an image inside its own set,
// if two looks of the same system land on an identical image or identical set, or
// if any referenced file is missing from public/looks/.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  LOOKS, STORE, CAFE_TICKETS, ROOMS, LEARN_IMG, HOST, TAGLINE, SYSTEMS,
  roomImg, defaultRoom, allImages,
} from "../public/preview-data.js";

const looksDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "looks");
const fails = [];
const lines = [];
const ok = (m) => lines.push(`  PASS  ${m}`);
const bad = (m) => { fails.push(m); lines.push(`  FAIL  ${m}`); };

// What each look actually shows, re-derived rather than restated.
const sets = {
  store: Object.fromEntries(LOOKS.map((l) => [l, [STORE[l].img]])),
  cafe: Object.fromEntries(LOOKS.map((l) => [l, CAFE_TICKETS[l].map((t) => t[0])])),
  book: Object.fromEntries(LOOKS.map((l) => [l, [roomImg(defaultRoom(l), l)]])),
  learn: Object.fromEntries(LOOKS.map((l) => [l, [LEARN_IMG[l]]])),
  host: Object.fromEntries(LOOKS.map((l) => [l, [HOST[l].img]])),
};

console.log("== 1. no repeat inside a single look's own set ==");
for (const [sys, byLook] of Object.entries(sets)) {
  for (const [look, imgs] of Object.entries(byLook)) {
    if (new Set(imgs).size !== imgs.length) bad(`${sys}/${look} repeats an image: ${imgs.join(", ")}`);
    else ok(`${sys}/${look} — ${imgs.length} distinct (${imgs.join(", ")})`);
  }
}

console.log(lines.splice(0).join("\n"));
console.log("\n== 2. no two looks of a system share an image or a set ==");
for (const [sys, byLook] of Object.entries(sets)) {
  const seen = new Map();
  for (const look of LOOKS) {
    const key = [...byLook[look]].sort().join("|");
    if (seen.has(key)) bad(`${sys}: ${look} and ${seen.get(key)} show the identical set -> ${key}`);
    else seen.set(key, look);
  }
  if (seen.size === LOOKS.length) ok(`${sys} — ${seen.size}/4 distinct sets across looks`);
}

console.log(lines.splice(0).join("\n"));
console.log("\n== 3. every referenced file exists in public/looks/ ==");
for (const img of [...allImages(), "blank.jpg"].sort()) {
  if (existsSync(join(looksDir, img))) ok(`public/looks/${img}`);
  else bad(`missing file public/looks/${img}`);
}

console.log(lines.splice(0).join("\n"));
console.log("\n== 4. taglines: 20 distinct lines over 5 systems x 4 looks ==");
const seenTag = new Map();
for (const sys of SYSTEMS) {
  for (const look of LOOKS) {
    const t = TAGLINE[sys]?.[look];
    if (!t) bad(`tagline missing for ${sys}/${look}`);
    else if (seenTag.has(t)) bad(`tagline for ${sys}/${look} duplicates ${seenTag.get(t)}`);
    else seenTag.set(t, `${sys}/${look}`);
  }
}
if (seenTag.size === 20) ok(`20/20 distinct taglines`);

console.log(lines.splice(0).join("\n"));

// Informational: the room thumbnail strip is shared inside a calm/bold group by
// design (LOOK_GROUP). Only the default hero has to differ across all 4 looks.
console.log("\n-- book detail (default hero per look, must be 4 distinct files) --");
for (const l of LOOKS) console.log(`   ${l.padEnd(10)} ${defaultRoom(l).name.padEnd(12)} ${roomImg(defaultRoom(l), l)}`);
console.log(`   room strip per group: calm=[${ROOMS.map((r) => r.imgs.calm)}] bold=[${ROOMS.map((r) => r.imgs.bold)}]`);

console.log(`\n${fails.length ? `FAILED (${fails.length})\n - ${fails.join("\n - ")}` : "ALL CHECKS PASSED"}`);
process.exit(fails.length ? 1 : 0);
