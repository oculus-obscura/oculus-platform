/**
 * synthesisData — the live data source for the Synthesis views.
 *
 * SynthesisData mirrors the prototype's SESSION_DATA object EXACTLY (same key
 * names, same nesting) with ONE sanctioned rename: `primaryChoice` →
 * `activitiesChosen`. The schema stores four unordered booleans per session,
 * so it cannot express a "first activity" — the old name lied. (The ordered
 * first activity for View 1 comes from the in-memory CompletedSession the
 * Simulation hands out, not from the database.)
 *
 * fetchSynthesisData() builds the object from RAW ROWS of both tables,
 * aggregated in TypeScript — no SQL, no views, no RPC. It returns null (and
 * logs) when Supabase isn't configured, and THROWS loudly on data-integrity
 * violations: an orphaned store_slug, a per-store count mismatch, or a
 * destination sum that disagrees with ended_by — those mean the write path is
 * broken, and a silent wrong answer would be worse than a crash.
 */
import { supabase } from "../../lib/supabase";
import { STORE_CATALOG } from "../../data/storeCatalog";

// ---------------- the SESSION_DATA contract ----------------

export interface SynthesisStoreCounts {
  timesOpened: number;
  low: number;
  mid: number;
  high: number;
  wouldntShop: number;
}

export interface SynthesisData {
  meta: { totalUsers: number; periodLabel: string };
  /** Keyed by catalog slug. EVERY catalog store appears, zeros when never
   *  opened — that is what makes "stores never opened" computable. */
  stores: Record<string, SynthesisStoreCounts>;
  /** Sessions where each chose_* boolean is true (unordered — see header). */
  activitiesChosen: { shop: number; grabABite: number; restroom: number; goOutside: number };
  multiActivityUsers: number;
  userMetrics: { openedRetail: number; completedPurchase: number; rejectedAny: number };
  outsideDestinations: { memorialPools: number; brookfieldPlace: number; oculusPlaza: number; oneWTCLobby: number };
  sessionEnd: { timer: number; went_outside: number };
  sessionsZeroSpend: number;
  avgElapsedWentOutside: number;
  /** Part B2 fix, ADDITIVE: every non-refusal interaction's `spend` (refusals
   *  excluded — they are non-purchases, not $0 buys). Median simulated
   *  spending is the median of THIS list; a median cannot be derived from the
   *  per-store counts above, so the raw values must reach the model. */
  purchaseSpends: number[];
  /** Part A (UI overhaul), ADDITIVE — not part of the mirrored prototype
   *  contract above: a small sample of REAL values from the live rows
   *  (truncated session ids, timestamps, elapsed clocks) consumed by the
   *  generated background substrate. The background is literally made of the
   *  record — nothing invented. Empty when there are no sessions. */
  fragments: string[];
}

// ---------------- raw table rows (the columns this layer reads) ----------------

interface SessionRow {
  id: string;
  created_at: string;
  chose_shop: boolean;
  chose_grab_a_bite: boolean;
  chose_restroom: boolean;
  chose_go_outside: boolean;
  ended_by: "timer" | "went_outside";
  elapsed_seconds: number;
  used_restroom: boolean;
  outside_destination: string | null;
  total_spend: number;
}

interface InteractionRow {
  session_id: string;
  store_slug: string;
  floor: number;
  category: string;
  choice: "low" | "mid" | "high" | "wouldnt_shop";
  spend: number;
}

/** The game's stored destination strings → the prototype's camelCase keys.
 *  NOTE: "The 9/11 Memorial" maps to `memorialPools` — not a mechanical rename. */
const DESTINATION_KEY: Record<string, keyof SynthesisData["outsideDestinations"]> = {
  "The Oculus Plaza": "oculusPlaza",
  "The 9/11 Memorial": "memorialPools",
  "Brookfield Place": "brookfieldPlace",
  "One World Trade Center": "oneWTCLobby",
};

/** supabase-js caps a request at 1000 rows — page until a short page. */
const PAGE = 1000;
async function fetchAll<T>(table: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(`[synthesisData] ${table} fetch failed: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const MONTH = (d: Date) => d.toLocaleString("en-US", { month: "long", timeZone: "UTC" }).toUpperCase();

/** "JULY 2026", "JULY – AUGUST 2026", or "DECEMBER 2025 – JANUARY 2026". */
function periodLabel(sessions: SessionRow[]): string {
  const times = sessions.map((s) => Date.parse(s.created_at)).filter((t) => !isNaN(t));
  if (!times.length) return "—";
  const lo = new Date(Math.min(...times)),
    hi = new Date(Math.max(...times));
  const loY = lo.getUTCFullYear(),
    hiY = hi.getUTCFullYear();
  if (loY === hiY && lo.getUTCMonth() === hi.getUTCMonth()) return `${MONTH(lo)} ${loY}`;
  if (loY === hiY) return `${MONTH(lo)} – ${MONTH(hi)} ${loY}`;
  return `${MONTH(lo)} ${loY} – ${MONTH(hi)} ${hiY}`;
}

/**
 * Build the full aggregate from live Supabase data.
 * Returns null (never throws) when Supabase is not configured.
 * Zero sessions produce a valid all-zeros object — no NaN, no Infinity.
 */
export async function fetchSynthesisData(): Promise<SynthesisData | null> {
  if (!supabase) {
    console.warn("[synthesisData] Supabase not configured — synthesis has no live data");
    return null;
  }

  const [sessions, interactions] = await Promise.all([
    fetchAll<SessionRow>("sessions"),
    fetchAll<InteractionRow>("interactions"),
  ]);

  // ---- stores: iterate the CATALOG so unopened stores exist as zeros;
  //      apple-1st and apple-2nd accumulate separately (never merged) ----
  const stores: Record<string, SynthesisStoreCounts> = {};
  for (const s of STORE_CATALOG) {
    stores[s.slug] = { timesOpened: 0, low: 0, mid: 0, high: 0, wouldntShop: 0 };
  }
  for (const row of interactions) {
    const cell = stores[row.store_slug];
    if (!cell) {
      // a plausible-looking wrong answer is worse than a crash
      throw new Error(
        `[synthesisData] ORPHANED SLUG: interactions row references "${row.store_slug}", which is not in the catalog`,
      );
    }
    cell.timesOpened++;
    if (row.choice === "wouldnt_shop") cell.wouldntShop++;
    else if (row.choice === "low") cell.low++;
    else if (row.choice === "mid") cell.mid++;
    else if (row.choice === "high") cell.high++;
    else throw new Error(`[synthesisData] unknown choice "${String(row.choice)}" for "${row.store_slug}"`);
  }
  for (const [slug, c] of Object.entries(stores)) {
    if (c.low + c.mid + c.high + c.wouldntShop !== c.timesOpened) {
      throw new Error(`[synthesisData] INVARIANT VIOLATION for "${slug}": low+mid+high+wouldntShop !== timesOpened`);
    }
  }

  // ---- session-level aggregates ----
  const activitiesChosen = { shop: 0, grabABite: 0, restroom: 0, goOutside: 0 };
  let multiActivityUsers = 0;
  const sessionEnd = { timer: 0, went_outside: 0 };
  const outsideDestinations = { memorialPools: 0, brookfieldPlace: 0, oculusPlaza: 0, oneWTCLobby: 0 };
  let sessionsZeroSpend = 0;
  let elapsedOutsideSum = 0,
    elapsedOutsideN = 0;

  for (const s of sessions) {
    const flags = [s.chose_shop, s.chose_grab_a_bite, s.chose_restroom, s.chose_go_outside];
    if (s.chose_shop) activitiesChosen.shop++;
    if (s.chose_grab_a_bite) activitiesChosen.grabABite++;
    if (s.chose_restroom) activitiesChosen.restroom++;
    if (s.chose_go_outside) activitiesChosen.goOutside++;
    if (flags.filter(Boolean).length > 1) multiActivityUsers++;

    if (s.ended_by === "timer") sessionEnd.timer++;
    else if (s.ended_by === "went_outside") {
      sessionEnd.went_outside++;
      elapsedOutsideSum += s.elapsed_seconds;
      elapsedOutsideN++;
      const key = s.outside_destination === null ? null : DESTINATION_KEY[s.outside_destination];
      if (!key) {
        throw new Error(
          `[synthesisData] UNKNOWN DESTINATION: session ${s.id} went outside to "${String(s.outside_destination)}"`,
        );
      }
      outsideDestinations[key]++;
    } else {
      throw new Error(`[synthesisData] unknown ended_by "${String(s.ended_by)}" on session ${s.id}`);
    }

    if (Number(s.total_spend) === 0) sessionsZeroSpend++;
  }

  // destination counts must reconcile exactly with how sessions ended
  const destSum = Object.values(outsideDestinations).reduce((a, b) => a + b, 0);
  if (destSum !== sessionEnd.went_outside) {
    throw new Error(
      `[synthesisData] DESTINATION MISMATCH: destinations sum to ${destSum} but ${sessionEnd.went_outside} sessions ended went_outside`,
    );
  }

  // ---- background fragments: real values only, never invented (Part A) ----
  const fragments: string[] = [];
  for (const s of sessions.slice(0, 10)) {
    fragments.push(s.id.slice(0, 8));
    const t = Date.parse(s.created_at);
    if (!isNaN(t)) fragments.push(new Date(t).toISOString().slice(0, 16).replace("T", " ") + "Z");
    const el = Math.max(0, Math.round(s.elapsed_seconds));
    fragments.push(`${Math.floor(el / 60)}:${String(el % 60).padStart(2, "0")}`);
  }

  // ---- distinct-session user metrics + purchase spends from interactions ----
  const openedRetail = new Set<string>();
  const completedPurchase = new Set<string>();
  const rejectedAny = new Set<string>();
  const purchaseSpends: number[] = [];
  for (const row of interactions) {
    if (row.category === "shop") openedRetail.add(row.session_id);
    if (row.choice !== "wouldnt_shop") {
      completedPurchase.add(row.session_id);
      purchaseSpends.push(Number(row.spend) || 0); // real spent amount; refusals never reach here
    } else rejectedAny.add(row.session_id);
  }

  return {
    meta: { totalUsers: sessions.length, periodLabel: periodLabel(sessions) },
    stores,
    activitiesChosen,
    multiActivityUsers,
    userMetrics: {
      openedRetail: openedRetail.size,
      completedPurchase: completedPurchase.size,
      rejectedAny: rejectedAny.size,
    },
    outsideDestinations,
    sessionEnd,
    sessionsZeroSpend,
    // guarded mean: zero went_outside sessions -> 0 (Step 2 renders "—")
    avgElapsedWentOutside: elapsedOutsideN ? Math.round(elapsedOutsideSum / elapsedOutsideN) : 0,
    purchaseSpends,
    fragments,
  };
}
