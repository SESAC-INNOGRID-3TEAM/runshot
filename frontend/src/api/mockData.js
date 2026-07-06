// DB/백엔드 연결 전 화면 확인용 더미 데이터. VITE_USE_MOCK=true일 때만 쓰인다.
// 실제 사진을 인터넷에서 받아올 수 없어(로컬 전용 환경) SVG를 즉석 생성해 썸네일로 쓴다.

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const PALETTES = [
  ["#1f2a1a", "#0a0a08"],
  ["#101820", "#0a0a08"],
  ["#1a1420", "#0a0a08"],
  ["#0f1f16", "#0a0a08"],
  ["#241a10", "#0a0a08"],
  ["#141c24", "#0a0a08"],
];

export function mockImage(label, seed) {
  const [colorA, colorB] = PALETTES[hashStr(seed) % PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colorA}" />
        <stop offset="1" stop-color="${colorB}" />
      </linearGradient>
    </defs>
    <rect width="800" height="800" fill="url(#g)" />
    <text x="50%" y="48%" font-family="sans-serif" font-size="110" font-weight="800" fill="#d4ff3d" text-anchor="middle" dominant-baseline="middle">${label}</text>
    <text x="50%" y="60%" font-family="sans-serif" font-size="24" fill="rgba(245,245,240,0.55)" text-anchor="middle">RUNSHOT SAMPLE</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const MOCK_EVENTS = [
  {
    id: 1,
    name: "2026 섬진강 마라톤",
    event_date: "2026-10-24",
    location: "전남 구례군",
    description: "섬진강을 따라 달리는 가을 마라톤 대회입니다.",
    cover_url: mockImage("2026 섬진강", "cover-1"),
    photo_summary: { total: 128, done: 96, unrecognized: 32 },
    bibs: [102, 233, 457, 981],
  },
  {
    id: 2,
    name: "2026 서울 하프마라톤",
    event_date: "2026-09-12",
    location: "서울 잠실종합운동장",
    description: "도심을 가로지르는 하프마라톤 대회.",
    photo_summary: { total: 245, done: 210, unrecognized: 35 },
    bibs: [1042, 2078, 3391],
  },
  {
    id: 3,
    name: "2026 제주 트레일런",
    event_date: "2026-11-02",
    location: "제주 한라산 둘레길",
    description: "제주 자연을 만끽하는 트레일 러닝 이벤트.",
    cover_url: mockImage("제주", "cover-3"),
    photo_summary: { total: 64, done: 50, unrecognized: 14 },
    bibs: [15, 88, 271],
  },
  {
    id: 4,
    name: "2026 부산 바다마라톤",
    event_date: "2026-08-15",
    location: "부산 해운대",
    description: "바다를 바라보며 달리는 여름 마라톤. (아직 사진 업로드 전)",
    photo_summary: { total: 0, done: 0, unrecognized: 0 },
    bibs: [],
  },
];

export const MOCK_USERS = [
  { id: 1, email: "admin@runshot.dev", role: "admin", created_at: "2026-05-20" },
  { id: 2, email: "organizer@runshot.dev", role: "organizer", created_at: "2026-06-01" },
  { id: 3, email: "photo@runshot.dev", role: "photographer", created_at: "2026-06-05" },
  { id: 4, email: "runner@runshot.dev", role: "participant", created_at: "2026-06-10" },
];

function buildPhotos(event) {
  if (event.bibs.length === 0) return [];
  const photos = [];
  let seq = 0;
  event.bibs.forEach((bib) => {
    const shotCount = 3 + (bib % 4);
    for (let i = 0; i < shotCount; i++) {
      seq += 1;
      const minute = String(10 + seq).padStart(2, "0");
      photos.push({
        id: `${event.id}-${bib}-${i}`,
        bib_number: bib,
        shot_at: `${event.event_date}T08:${minute}:00Z`,
        thumbnail_url: mockImage(`#${bib}`, `${event.id}-${bib}-${i}`),
        image_url: mockImage(`#${bib}`, `${event.id}-${bib}-${i}`),
      });
    }
  });
  return photos;
}

export const MOCK_PHOTOS_BY_EVENT = Object.fromEntries(
  MOCK_EVENTS.map((event) => [event.id, buildPhotos(event)])
);

export const MOCK_UNRECOGNIZED_BY_EVENT = Object.fromEntries(
  MOCK_EVENTS.map((event) => [
    event.id,
    event.photo_summary.unrecognized > 0
      ? Array.from({ length: Math.min(4, event.photo_summary.unrecognized) }, (_, i) => ({
          id: `${event.id}-unrec-${i}`,
          original_filename: `DSC0${4590 + i}.JPG`,
          thumbnail_url: mockImage("?", `${event.id}-unrec-${i}`),
        }))
      : [],
  ])
);

export function delay(ms = 400) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
