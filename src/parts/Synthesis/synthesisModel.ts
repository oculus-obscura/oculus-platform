/**
 * synthesisModel — the prototype's data model, ported from
 * design-reference/oculus_synthesis.html with its maths UNCHANGED.
 *
 * Inputs swapped for the real sources:
 *   STORE_DATA            -> src/data/storeCatalog.ts (shape already matches)
 *   SESSION_DATA          -> SynthesisData from synthesisData.ts (live rows)
 *   SESSION_DATA.primaryChoice -> activitiesChosen (Step 1 rename; the four
 *                            flags are unordered booleans, not a first choice)
 *
 * Prices are ALWAYS resolved via priceOf(store, tier) — never by array index;
 * the catalog's price array is HIGH-first, so positional reads would silently
 * invert every figure.
 *
 * Small-n guards (the only sanctioned deviations from the prototype's maths):
 *   - medianSpend stays null (not 0) when nobody bought — renders "—"
 *   - avgElapsedWentOutside renders "—" when nothing qualifies (view layer)
 *   - the refusal-rate takeaway handles 0 or 1 qualifying stores
 */
import { STORE_CATALOG } from "../../data/storeCatalog";
import type { SynthesisData } from "./synthesisData";

export const NA = "—";

// ---------------- catalog-backed store list (prototype STORE_DATA shape) ----------------

export interface SynStore {
  slug: string;
  name: string;
  floor: 1 | 2;
  category: "shop" | "food";
  prices: { tier: "high" | "mid" | "low"; value: number }[];
}

export const STORES: SynStore[] = STORE_CATALOG.map((s) => ({
  slug: s.slug,
  name: s.name,
  floor: s.floor,
  category: s.category,
  prices: s.prices.map((p) => ({ tier: p.tier, value: p.value })),
}));

export const priceOf = (s: SynStore, tier: "high" | "mid" | "low"): number =>
  s.prices.find((p) => p.tier === tier)?.value ?? 0;

/** 49 — Apple counted once (both catalog entries share one price list). */
export const UNIQUE_STORE_COUNT = new Set(STORES.map((s) => s.name)).size;
/** Price-distribution stats count Apple ONCE, matching the denominator. */
const PRICE_STORES = STORES.filter((s) => s.slug !== "apple-2nd");

export const BY_SLUG: Record<string, SynStore> = Object.fromEntries(STORES.map((s) => [s.slug, s]));

// ---------------- formatters (verbatim) ----------------

export function fmtMoney(v: number | null | undefined): string {
  if (v == null) return NA;
  const dec = Number.isInteger(v) ? 0 : 2;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export function fmtPct(x: number | null | undefined, dp = 0): string {
  if (x == null || isNaN(x) || !isFinite(x)) return NA;
  return (x * 100).toFixed(dp) + "%";
}
export function median(arr: number[]): number | null {
  const a = [...arr].sort((x, y) => x - y);
  const n = a.length;
  if (!n) return null;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}
/** 'food' NEVER surfaces in the UI. */
export function catLabel(c: string): string {
  return c === "food" ? "Grab a Bite" : "Shop";
}
export function floorLabel(f: number): string {
  return Number(f) === 1 ? "1ST" : Number(f) === 2 ? "2ND" : NA;
}
export function floorLong(f: number): string {
  return Number(f) === 1 ? "1ST FLOOR" : Number(f) === 2 ? "2ND FLOOR" : NA;
}
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export const PRICE_BANDS = [
  { label: "Below $25", test: (v: number) => v < 25 },
  { label: "$25 – $99", test: (v: number) => v >= 25 && v < 100 },
  { label: "$100 – $499", test: (v: number) => v >= 100 && v < 500 },
  { label: "$500+", test: (v: number) => v >= 500 },
];
function bands(values: number[]) {
  const n = values.length;
  return PRICE_BANDS.map((b) => {
    const c = values.filter(b.test).length;
    return { label: b.label, count: c, pct: n ? c / n : 0 };
  });
}

/** Refusal rate off 1–2 interactions is noise, not signal. */
export const MIN_OPENS = 4;

// ---------------- static presentation tables (verbatim) ----------------

export const CAT_LABEL: Record<string, string> = {
  shop: "SHOP",
  grabABite: "GRAB A BITE",
  restroom: "RESTROOM",
  goOutside: "GO OUTSIDE",
};
export const CAT_ICON: Record<string, string> = { shop: "bag", grabABite: "cup", restroom: "people", goOutside: "exit" };
export const DEST_TYPE: Record<string, string> = {
  memorialPools: "Memorial",
  brookfieldPlace: "Adjacent commercial",
  oculusPlaza: "Outdoor public space",
  oneWTCLobby: "Cultural",
};
export const PRICE_PILL: Record<string, { cls: string; label: string }> = {
  entry: { cls: "entry", label: "LOW POINT" },
  typical: { cls: "typical", label: "MID POINT" },
  high: { cls: "high", label: "HIGH POINT" },
};
/** Static destination meta — View 1 must never wait on the network for these. */
export const OUTSIDE_META = [
  { key: "memorialPools", label: "9/11 Memorial Pools", icon: "pool" },
  { key: "brookfieldPlace", label: "Brookfield Place", icon: "building" },
  { key: "oculusPlaza", label: "Oculus Plaza", icon: "arch" },
  { key: "oneWTCLobby", label: "One WTC Lobby", icon: "tower" },
] as const;

// ---------------- the model ----------------

export interface StoreStat extends SynStore {
  timesOpened: number;
  low: number;
  mid: number;
  high: number;
  wouldntShop: number;
  id: string;
  type: "shop" | "food";
  entryPrice: number;
  typicalPrice: number;
  highPrice: number;
  entrySelected: number;
  typicalSelected: number;
  highSelected: number;
  wontShopHere: number;
  refusalRate: number;
  purchaseRate: number;
}

export interface SynthesisModel {
  totalStores: number;
  medianEntry: number | null;
  medianTypical: number | null;
  entryBands: { label: string; count: number; pct: number }[];
  typicalBands: { label: string; count: number; pct: number }[];
  typicalOver100: number;
  typicalOver100Pct: number;
  typicalOver500: number;
  typicalOver500Pct: number;
  N: number;
  period: string;
  storeStats: StoreStat[];
  byIdStat: Record<string, StoreStat>;
  totalDecisions: number;
  entrySel: number;
  typSel: number;
  highSel: number;
  wontSel: number;
  activities: { key: string; label: string; icon: string; count: number; pct: number }[];
  activitiesMax: number;
  multiPct: number;
  /** Part B1, additive: the raw count behind multiPct — every percentage
   *  shown in the UI must carry its underlying count. */
  multiCount: number;
  goOutsideCount: number;
  goOutsidePct: number;
  outside: { key: string; label: string; icon: string; count: number; pct: number }[];
  rejectAbove500: { c: number; w: number; rate: number };
  rejectAbove100: { c: number; w: number; rate: number };
  refusalBelow100: number;
  refusalAbove500: number;
  refusalMultiple: number;
  lineBands: { label: string; opened: number; bought: number; reject: number; lowShare: number }[];
  userMetrics: SynthesisData["userMetrics"];
  choseShopPct: number;
  openedRetailPct: number;
  purchasePct: number;
  rejectedAnyPct: number;
  medianSpend: number | null;
  restroomPctVal: number;
  zeroSpendCount: number;
  zeroSpendPct: number;
  neverOpened: StoreStat[];
  neverOpenedCount: number;
  avgLeaveSeconds: number;
  wentOutsideCount: number;
}

/** The prototype's buildModel(), pure. Call only when data.meta.totalUsers > 0. */
export function buildModel(data: SynthesisData): SynthesisModel {
  const M = {} as SynthesisModel;
  M.totalStores = UNIQUE_STORE_COUNT; // 50 entries, Apple counted once
  const entryArr = PRICE_STORES.map((s) => priceOf(s, "low"));
  const typArr = PRICE_STORES.map((s) => priceOf(s, "mid"));
  M.medianEntry = median(entryArr);
  M.medianTypical = median(typArr);
  M.entryBands = bands(entryArr);
  M.typicalBands = bands(typArr);
  M.typicalOver100 = PRICE_STORES.filter((s) => priceOf(s, "mid") >= 100).length;
  M.typicalOver100Pct = M.typicalOver100 / M.totalStores;
  M.typicalOver500 = PRICE_STORES.filter((s) => priceOf(s, "mid") >= 500).length;
  M.typicalOver500Pct = M.typicalOver500 / M.totalStores;

  M.N = data.meta.totalUsers;
  M.period = data.meta.periodLabel;
  const sc = data.stores;
  M.storeStats = STORES.map((s) => {
    const e = sc[s.slug] || { timesOpened: 0, low: 0, mid: 0, high: 0, wouldntShop: 0 };
    const purchases = e.low + e.mid + e.high;
    return Object.assign({}, s, e, {
      id: s.slug, // legacy alias used by render code
      type: s.category,
      entryPrice: priceOf(s, "low"), // named aliases, resolved BY TIER
      typicalPrice: priceOf(s, "mid"),
      highPrice: priceOf(s, "high"),
      entrySelected: e.low,
      typicalSelected: e.mid,
      highSelected: e.high,
      wontShopHere: e.wouldntShop,
      refusalRate: e.timesOpened ? e.wouldntShop / e.timesOpened : 0,
      purchaseRate: e.timesOpened ? purchases / e.timesOpened : 0,
    }) as StoreStat;
  });
  M.byIdStat = M.storeStats.reduce((m, s) => ((m[s.slug] = s), m), {} as Record<string, StoreStat>);
  M.totalDecisions = M.storeStats.reduce((a, s) => a + s.timesOpened, 0);
  M.entrySel = M.storeStats.reduce((a, s) => a + s.entrySelected, 0);
  M.typSel = M.storeStats.reduce((a, s) => a + s.typicalSelected, 0);
  M.highSel = M.storeStats.reduce((a, s) => a + s.highSelected, 0);
  M.wontSel = M.storeStats.reduce((a, s) => a + s.wontShopHere, 0);

  // ACTIVITIES CHOSEN — unordered flags; counts may exceed N, never parts of a whole
  const ac = data.activitiesChosen;
  M.activities = [
    { key: "shop", label: "Shop", icon: "bag", count: ac.shop },
    { key: "grabABite", label: "Grab a Bite", icon: "cup", count: ac.grabABite },
    { key: "restroom", label: "Restroom", icon: "people", count: ac.restroom },
    { key: "goOutside", label: "Go Outside", icon: "exit", count: ac.goOutside },
  ].map((p) => Object.assign(p, { pct: M.N ? p.count / M.N : 0 }));
  M.activitiesMax = Math.max(...M.activities.map((p) => p.count));
  M.multiPct = M.N ? data.multiActivityUsers / M.N : 0;
  M.multiCount = data.multiActivityUsers; // Part B1: the count behind multiPct

  M.goOutsideCount = ac.goOutside;
  M.goOutsidePct = M.N ? ac.goOutside / M.N : 0;
  const od = data.outsideDestinations;
  M.outside = OUTSIDE_META.map((d) =>
    Object.assign({}, d, {
      count: od[d.key],
      pct: M.goOutsideCount ? od[d.key] / M.goOutsideCount : 0,
    }),
  );

  // refusal analytics (verbatim)
  const rate = (pred: (s: StoreStat) => boolean) => {
    let c = 0,
      w = 0;
    M.storeStats.forEach((s) => {
      if (pred(s)) {
        c += s.timesOpened;
        w += s.wontShopHere;
      }
    });
    return { c, w, rate: c ? w / c : 0 };
  };
  M.rejectAbove500 = rate((s) => s.entryPrice > 500);
  M.rejectAbove100 = rate((s) => s.entryPrice > 100);
  const avgRefusal = (pred: (s: StoreStat) => boolean) => {
    const a = M.storeStats.filter((s) => pred(s) && s.timesOpened > 0).map((s) => s.refusalRate);
    return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  };
  M.refusalBelow100 = avgRefusal((s) => s.entryPrice < 100);
  M.refusalAbove500 = avgRefusal((s) => s.entryPrice >= 500);
  M.refusalMultiple = M.refusalBelow100 ? M.refusalAbove500 / M.refusalBelow100 : 0;

  // line chart: purchase vs refusal rate per typical-price band (verbatim)
  M.lineBands = PRICE_BANDS.map((b) => {
    const set = M.storeStats.filter((s) => b.test(s.typicalPrice));
    const opened = set.reduce((a, s) => a + s.timesOpened, 0);
    const won = set.reduce((a, s) => a + s.wontShopHere, 0);
    const lowN = set.reduce((a, s) => a + s.entrySelected, 0);
    const bought = set.reduce((a, s) => a + s.entrySelected + s.typicalSelected + s.highSelected, 0);
    return { label: b.label, opened, bought, reject: opened ? won / opened : 0, lowShare: bought ? lowN / bought : 0 };
  });

  const um = data.userMetrics;
  M.userMetrics = um;
  M.choseShopPct = M.N ? ac.shop / M.N : 0;
  M.openedRetailPct = M.N ? um.openedRetail / M.N : 0;
  M.purchasePct = M.N ? um.completedPurchase / M.N : 0;
  M.rejectedAnyPct = M.N ? um.rejectedAny / M.N : 0;

  // median simulated spending — null (renders "—") when nobody bought
  M.medianSpend = median(M.storeStats.filter((s) => s.entrySelected > 0).map((s) => s.entryPrice));
  M.restroomPctVal = M.N ? ac.restroom / M.N : 0;

  // ── stats made possible by the frozen schema ──
  M.zeroSpendCount = data.sessionsZeroSpend;
  M.zeroSpendPct = M.N ? M.zeroSpendCount / M.N : 0;
  M.neverOpened = M.storeStats.filter((s) => !s.timesOpened);
  M.neverOpenedCount = M.neverOpened.length;
  M.avgLeaveSeconds = data.avgElapsedWentOutside;
  M.wentOutsideCount = data.sessionEnd.went_outside;
  return M;
}
