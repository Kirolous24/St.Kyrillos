import { prisma } from "@/lib/prisma";

const BASE_URL = "https://api.coptic.io/api";
const FETCH_TIMEOUT = 5000; // 5 seconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReadingChapter {
  chapterNum: number;
  verses: { num: number; text: string }[];
}

export interface ReadingBook {
  bookName: string;
  chapters: ReadingChapter[];
}

/** Sections returned by /readings/:date?detailed=true */
export interface ReadingSections {
  Prophecies: ReadingBook[] | null;
  VPsalm: ReadingBook[] | null;
  VGospel: ReadingBook[] | null;
  MPsalm: ReadingBook[] | null;
  MGospel: ReadingBook[] | null;
  Pauline: ReadingBook[] | null;
  Catholic: ReadingBook[] | null;
  Acts: ReadingBook[] | null;
  LPsalm: ReadingBook[] | null;
  LGospel: ReadingBook[] | null;
  EPPsalm: ReadingBook[] | null;
  EPGospel: ReadingBook[] | null;
}

/** A concise reading reference (no verse text) for display */
export interface ReadingRef {
  section: string; // e.g. "Pauline", "Gospel (Liturgy)"
  bookName: string;
  reference: string; // e.g. "Ephesians 4:1-16"
}

export interface SynaxariumEntry {
  name: string;
  url: string;
  id: string;
}

export interface CelebrationEntry {
  id: number;
  name: string;
  type: string; // "feast", "fast", "majorFeast", "minorFeast", "lordlyFeast"
  isMoveable?: boolean;
}

export interface CopticDayData {
  copticDate: string | null; // "Baramhat 2, 1742"
  season: string | null; // "Great Lent"
  seasonDay: string | null; // "Wednesday of the fourth week of Great Lent"
  isFasting: boolean;
  readings: ReadingRef[];
  synaxarium: SynaxariumEntry[];
  feasts: CelebrationEntry[];
}

// ─── Feast → Template Mapping ────────────────────────────────────────────────

export const FEAST_TEMPLATE_MAP: Record<string, string> = {
  "Palm Sunday": "Pascha (Holy) Week",
  "Nativity Feast": "Nativity (Christmas)",
  "Nativity Paramoun": "Nativity (Christmas)",
  "Theophany Feast": "Epiphany (Theophany)",
  "Theophany Paramoun": "Epiphany (Theophany)",
};

export interface TemplateSuggestion {
  templateId: string;
  templateName: string;
  feastName: string;
  suggestedStartDate: string; // YYYY-MM-DD
}

// ─── Section display labels ──────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  Prophecies: "Prophecies",
  VPsalm: "Vespers Psalm",
  VGospel: "Vespers Gospel",
  MPsalm: "Matins Psalm",
  MGospel: "Matins Gospel",
  Pauline: "Pauline Epistle",
  Catholic: "Catholic Epistle",
  Acts: "Acts",
  LPsalm: "Liturgy Psalm",
  LGospel: "Liturgy Gospel",
  EPPsalm: "Evening Psalm",
  EPGospel: "Evening Gospel",
};

// ─── Internal fetch helpers ──────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  timeoutMs = FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch readings for a date. Returns null on failure. */
async function fetchReadingsRaw(
  date: string
): Promise<{
  readings: ReadingRef[];
  synaxarium: SynaxariumEntry[];
  season: string | null;
  seasonDay: string | null;
  copticDate: string | null;
  celebrations: CelebrationEntry[] | null;
} | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/readings/${date}?detailed=true`
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Extract reading references from detailed response
    const readings: ReadingRef[] = [];
    for (const [key, label] of Object.entries(SECTION_LABELS)) {
      const section = data[key];
      if (!section || !Array.isArray(section)) continue;
      for (const book of section) {
        if (!book.bookName || !book.chapters) continue;
        for (const ch of book.chapters) {
          const verses = ch.verses;
          if (!verses || verses.length === 0) continue;
          const first = verses[0].num;
          const last = verses[verses.length - 1].num;
          const ref =
            first === last
              ? `${book.bookName} ${ch.chapterNum}:${first}`
              : `${book.bookName} ${ch.chapterNum}:${first}-${last}`;
          readings.push({ section: label, bookName: book.bookName, reference: ref });
        }
      }
    }

    return {
      readings,
      synaxarium: data.Synaxarium || [],
      season: data.season || null,
      seasonDay: data.seasonDay || null,
      copticDate: data.fullDate?.dateString || null,
      celebrations: data.celebrations || null,
    };
  } catch {
    return null;
  }
}

/** Fetch celebrations for a specific date */
async function fetchCelebrationsForDate(
  date: string
): Promise<CelebrationEntry[]> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/celebrations/${date}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Get coptic day data for a single date (YYYY-MM-DD). Uses DB cache. */
export async function getCopticDayData(date: string): Promise<CopticDayData> {
  const empty: CopticDayData = {
    copticDate: null,
    season: null,
    seasonDay: null,
    isFasting: false,
    readings: [],
    synaxarium: [],
    feasts: [],
  };

  try {
    // Check cache
    const cached = await prisma.copticDayCache.findUnique({ where: { id: date } });
    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      return {
        copticDate: cached.copticDate,
        season: cached.season,
        seasonDay: cached.seasonDay,
        isFasting: cached.isFasting,
        readings: (cached.readings as unknown as ReadingRef[]) || [],
        synaxarium: (cached.synaxarium as unknown as SynaxariumEntry[]) || [],
        feasts: (cached.feasts as unknown as CelebrationEntry[]) || [],
      };
    }

    // Fetch from coptic.io
    const [readingsData, celebrations] = await Promise.all([
      fetchReadingsRaw(date),
      fetchCelebrationsForDate(date),
    ]);

    if (!readingsData) {
      // API failed — return stale cache if available
      if (cached) {
        return {
          copticDate: cached.copticDate,
          season: cached.season,
          seasonDay: cached.seasonDay,
          isFasting: cached.isFasting,
          readings: (cached.readings as unknown as ReadingRef[]) || [],
          synaxarium: (cached.synaxarium as unknown as SynaxariumEntry[]) || [],
          feasts: (cached.feasts as unknown as CelebrationEntry[]) || [],
        };
      }
      return empty;
    }

    // Determine fasting from season or celebrations
    const isFasting =
      readingsData.season?.toLowerCase().includes("lent") ||
      readingsData.season?.toLowerCase().includes("fast") ||
      celebrations.some((c) => c.type === "fast") ||
      false;

    const result: CopticDayData = {
      copticDate: readingsData.copticDate,
      season: readingsData.season,
      seasonDay: readingsData.seasonDay,
      isFasting,
      readings: readingsData.readings,
      synaxarium: readingsData.synaxarium,
      feasts: celebrations,
    };

    // Write to cache
    const dateObj = new Date(date + "T12:00:00Z");
    await prisma.copticDayCache.upsert({
      where: { id: date },
      create: {
        id: date,
        date: dateObj,
        copticDate: result.copticDate,
        season: result.season,
        seasonDay: result.seasonDay,
        isFasting: result.isFasting,
        readings: result.readings as unknown as import("@prisma/client").Prisma.InputJsonValue,
        synaxarium: result.synaxarium as unknown as import("@prisma/client").Prisma.InputJsonValue,
        feasts: result.feasts as unknown as import("@prisma/client").Prisma.InputJsonValue,
        fetchedAt: new Date(),
      },
      update: {
        copticDate: result.copticDate,
        season: result.season,
        seasonDay: result.seasonDay,
        isFasting: result.isFasting,
        readings: result.readings as unknown as import("@prisma/client").Prisma.InputJsonValue,
        synaxarium: result.synaxarium as unknown as import("@prisma/client").Prisma.InputJsonValue,
        feasts: result.feasts as unknown as import("@prisma/client").Prisma.InputJsonValue,
        fetchedAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    console.error(`[coptic-api] Error fetching data for ${date}:`, error);
    return empty;
  }
}

/** Get coptic day data for a date range. Returns map keyed by YYYY-MM-DD. */
export async function getCopticDayDataBatch(
  startDate: string,
  endDate: string
): Promise<Record<string, CopticDayData>> {
  const result: Record<string, CopticDayData> = {};

  // Generate all dates in range
  const dates: string[] = [];
  const current = new Date(startDate + "T12:00:00Z");
  const end = new Date(endDate + "T12:00:00Z");
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Check cache for all dates
  const cached = await prisma.copticDayCache.findMany({
    where: { id: { in: dates } },
  });
  const cachedMap = new Map(cached.map((c) => [c.id, c]));
  const staleDates: string[] = [];

  for (const date of dates) {
    const c = cachedMap.get(date);
    if (c && Date.now() - c.fetchedAt.getTime() < CACHE_TTL_MS) {
      result[date] = {
        copticDate: c.copticDate,
        season: c.season,
        seasonDay: c.seasonDay,
        isFasting: c.isFasting,
        readings: (c.readings as unknown as ReadingRef[]) || [],
        synaxarium: (c.synaxarium as unknown as SynaxariumEntry[]) || [],
        feasts: (c.feasts as unknown as CelebrationEntry[]) || [],
      };
    } else {
      staleDates.push(date);
    }
  }

  // Fetch stale/missing dates in parallel (with concurrency limit)
  const CONCURRENCY = 5;
  for (let i = 0; i < staleDates.length; i += CONCURRENCY) {
    const batch = staleDates.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((date) => getCopticDayData(date))
    );
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        result[batch[j]] = r.value;
      } else {
        // Use stale cache or empty
        const stale = cachedMap.get(batch[j]);
        result[batch[j]] = stale
          ? {
              copticDate: stale.copticDate,
              season: stale.season,
              seasonDay: stale.seasonDay,
              isFasting: stale.isFasting,
              readings: (stale.readings as unknown as ReadingRef[]) || [],
              synaxarium: (stale.synaxarium as unknown as SynaxariumEntry[]) || [],
              feasts: (stale.feasts as unknown as CelebrationEntry[]) || [],
            }
          : {
              copticDate: null,
              season: null,
              seasonDay: null,
              isFasting: false,
              readings: [],
              synaxarium: [],
              feasts: [],
            };
      }
    }
  }

  return result;
}

/** Fetch all celebrations (static list). Used for feast→template mapping. */
export async function fetchAllCelebrations(): Promise<CelebrationEntry[]> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/celebrations`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Find template suggestions by checking each date in a range for feast days
 * that map to known templates.
 */
export async function getTemplateSuggestions(
  copticData: Record<string, CopticDayData>,
  templates: { id: string; name: string }[]
): Promise<TemplateSuggestion[]> {
  const suggestions: TemplateSuggestion[] = [];
  const templateMap = new Map(templates.map((t) => [t.name, t.id]));

  for (const [date, dayData] of Object.entries(copticData)) {
    for (const feast of dayData.feasts) {
      const templateName = FEAST_TEMPLATE_MAP[feast.name];
      if (templateName) {
        const templateId = templateMap.get(templateName);
        if (templateId) {
          // Avoid duplicate suggestions for the same template
          if (!suggestions.some((s) => s.templateId === templateId)) {
            suggestions.push({
              templateId,
              templateName,
              feastName: feast.name,
              suggestedStartDate: date,
            });
          }
        }
      }
    }
  }

  return suggestions;
}
