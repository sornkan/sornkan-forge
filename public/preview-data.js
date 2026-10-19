// Lobby preview tables. Pure data — no DOM, no imports — so the audit script and
// the unit tests can load this module directly in Node.
//
// Every image path here must resolve to a real file in public/looks/.
// Rule kept by test/paths.test.ts and scripts/audit-looks.mjs: within one system,
// no look repeats an image inside its own set, and no two looks share a set.

// Keyed by the value sent on the wire as `start`, so there is exactly one
// vocabulary and no UI-id -> wire-id mapping that could drift. "blank" is the
// system labelled "Conjure" in the picker.
export const SYSTEMS = ["store", "cafe", "book", "learn", "blank"];
export const LOOKS = ["simple", "playful", "elegant", "brutalist"];

export const SYSTEM_META = {
  store: { label: "Store", sub: "Shop", brief: "An online store with a cart, live stock in the database, and product photos in storage." },
  cafe: { label: "Cafe", sub: "Queue", brief: "A cafe order queue. Baristas move tickets from New to Making to Ready." },
  book: { label: "Book", sub: "Rooms", brief: "A room booking page with time slots, a host, and today's reservations." },
  learn: { label: "Learn", sub: "Course", brief: "A course page with lessons, progress, and a completion badge." },
  blank: { label: "Conjure", sub: "Blank", brief: "Conjure a site from this brief. Start from a blank page." },
};

export const LOOK_META = {
  simple: { label: "Simple", note: "Clean, minimal, no clutter." },
  playful: { label: "Playful", note: "Bright pink, rounded shapes, confident type." },
  elegant: { label: "Elegant", note: "Cream and serif, quiet and unhurried." },
  brutalist: { label: "Brutalist", note: "Hard shadows, mono type, no apologies." },
};

// ---- store ----------------------------------------------------------------
export const STORE = {
  simple: { img: "w3.jpg", name: "Everyday V-Neck Tee", price: "$45.00", stock: "In stock · 12 left", buy: "Buy now", add: "Add to bag" },
  playful: { img: "kid-girl.jpg", name: "Rainbow Zip Hoodie", price: "฿890", stock: "In stock · 8 left", buy: "Buy now", add: "Add to bag" },
  elegant: { img: "shopw.jpg", name: "Wool Trench Coat", price: "฿4,200", stock: "In stock · 3 left", buy: "Buy now", add: "Add to bag" },
  brutalist: { img: "jacket2.jpg", name: "BIKER JACKET", price: "$220", stock: "IN STOCK · 5 LEFT", buy: "BUY NOW", add: "ADD" },
};

export const STORE_SIZES = ["XS", "S", "M", "L", "XL"];

// ---- cafe -----------------------------------------------------------------
// [image, name, status, elapsed]
export const CAFE_TICKETS = {
  simple: [
    ["coffee2.jpg", "#41 Oat latte", "Preparing", "2m"],
    ["coffee.jpg", "#42 Mocha", "Ready", "now"],
    ["iced-latte.jpg", "#43 Iced latte", "Queued", "6m"],
  ],
  playful: [
    ["coffee.jpg", "#12 Three Cheers", "Preparing", "1m"],
    ["iced-latte.jpg", "#13 Iced latte", "Ready", "now"],
    ["cafepe.jpg", "#14 House blend", "Queued", "4m"],
  ],
  elegant: [
    ["cafepe.jpg", "#07 Flat white", "Preparing", "3m"],
    ["espresso.jpg", "#08 Espresso", "Ready", "now"],
    ["coffee2.jpg", "#09 Oat latte", "Queued", "5m"],
  ],
  brutalist: [
    ["espresso.jpg", "#88 BLACK COFFEE", "PREPARING", "1m"],
    ["coffee2.jpg", "#87 OAT LATTE", "READY", "now"],
    ["coffee.jpg", "#86 MOCHA", "QUEUED", "7m"],
  ],
};

// Back-of-house board. Cafe only — no other system reuses this component.
export const CAFE_BOARD = {
  simple: [["New", "#44 Oat latte"], ["Making", "#43 Mocha"], ["Ready", "#41 Espresso"]],
  playful: [["New", "#15 Cold brew"], ["Making", "#14 House blend"], ["Ready", "#12 Three Cheers"]],
  elegant: [["New", "#10 Cortado"], ["Making", "#09 Oat latte"], ["Ready", "#07 Flat white"]],
  brutalist: [["NEW", "#89 DRIP"], ["MAKING", "#88 BLACK COFFEE"], ["READY", "#86 MOCHA"]],
};

// ---- book -----------------------------------------------------------------
// Each room carries two photo states; the look decides which state is used.
export const LOOK_GROUP = { simple: "calm", elegant: "calm", playful: "bold", brutalist: "bold" };

export const ROOMS = [
  { id: "a", name: "Studio A", imgs: { calm: "studio.jpg", bold: "meeting-bright.jpg" }, seats: "6 seats · glass + garden", price: "฿450/hr" },
  { id: "b", name: "Focus Room", imgs: { calm: "desk.jpg", bold: "meeting-loft.jpg" }, seats: "2 seats · quiet corner", price: "฿250/hr" },
  { id: "c", name: "Garden Room", imgs: { calm: "room.jpg", bold: "meeting-industrial.jpg" }, seats: "10 seats · long table", price: "฿650/hr" },
];

// Default room per look. Combined with LOOK_GROUP this must land on four
// different files — see scripts/audit-looks.mjs, which re-derives it.
export const LOOK_ROOM = { simple: "b", elegant: "a", playful: "a", brutalist: "c" };

export const HOST = {
  simple: { img: "w6.jpg", name: "Mint" },
  playful: { img: "w2.jpg", name: "Prim" },
  elegant: { img: "w1.jpg", name: "Aran" },
  brutalist: { img: "w4.jpg", name: "Fah" },
};

export const BOOK_DAYS = ["Fri", "Sat", "Sun"];
export const BOOK_TIMES = ["10:00", "11:30", "14:00", "16:00"];
export const BOOK_TODAY = [
  { time: "10:00", who: "Ann", state: "confirmed", dot: "ok" },
  { time: "11:30", who: "Team focus", state: "pending", dot: "pend" },
  { time: "14:00", who: "—", state: "open", dot: "open" },
];

export function roomImg(room, look) {
  return room.imgs[LOOK_GROUP[look] || "calm"];
}

export function defaultRoom(look) {
  const id = LOOK_ROOM[look] || "a";
  return ROOMS.find((r) => r.id === id) || ROOMS[0];
}

// ---- learn ----------------------------------------------------------------
export const LEARN_IMG = {
  simple: "w5.jpg",
  playful: "learn-playful.jpg",
  elegant: "notebook.jpg",
  brutalist: "class.jpg",
};

export const LEARN_LESSONS = [
  { name: "Light", state: "done" },
  { name: "Camera", state: "done" },
  { name: "Exposure", state: "current" },
  { name: "Prints", state: "todo" },
];

// ---- taglines: one distinct line per (system, look) — 20 in total ----------
export const TAGLINE = {
  store: {
    simple: "Product, not props. Nothing you don’t need.",
    playful: "Say it loud — keep the checkout dead simple.",
    elegant: "Priced like it deserves a second look.",
    brutalist: "NO PROPS. NO FILTER. JUST THE JACKET.",
  },
  cafe: {
    simple: "Ticket in, ticket out — nobody guesses what’s next.",
    playful: "Every order gets a little confetti.",
    elegant: "Poured the same way, every single time.",
    brutalist: "NO OAT. NO FOAM. NO APOLOGY.",
  },
  book: {
    simple: "Pick a slot. Show up. That’s it.",
    playful: "Your studio, your rules, your playlist.",
    elegant: "Held quietly, for exactly you.",
    brutalist: "SLOT’S YOURS. DON’T BE LATE.",
  },
  learn: {
    simple: "Three lessons in, five to go — keep moving.",
    playful: "Streaks, badges, and a tiny happy dance.",
    elegant: "Mastery, one unhurried lesson at a time.",
    brutalist: "FINISH THE MODULE. NO SHORTCUTS.",
  },
  blank: {
    simple: "A page with nothing on it — yet.",
    playful: "Blank, but not for long.",
    elegant: "Quiet margins. Infinite possibility.",
    brutalist: "BLANK. RAW. YOURS.",
  },
};

export const CUSTOM_TAGLINE = "Describe it yourself — your agent reads both fields, then builds.";

// ---- custom builder quick-fill chips --------------------------------------
export const BUILD_CHIPS = [
  { label: "Cafe queue", value: "A queue board where baristas mark orders New → Making → Ready." },
  { label: "Room booking", value: "A room booking calendar with time slots and a host's day view." },
  { label: "Course / LMS", value: "A course page with lessons, progress, and a completion badge." },
  { label: "Start blank", value: "" },
];

export const STYLE_CHIPS = LOOKS.map((look) => ({
  label: LOOK_META[look].label,
  value: `${LOOK_META[look].label} — ${LOOK_META[look].note.replace(/\.$/, "").toLowerCase()}.`,
}));

// Every image this module can put on screen, for the on-disk existence test.
export function allImages() {
  const out = new Set();
  for (const look of LOOKS) {
    out.add(STORE[look].img);
    out.add(LEARN_IMG[look]);
    out.add(HOST[look].img);
    for (const t of CAFE_TICKETS[look]) out.add(t[0]);
    for (const r of ROOMS) out.add(roomImg(r, look));
  }
  return [...out];
}
