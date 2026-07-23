/**
 * saveSession — write one completed game round to Supabase.
 *
 * Called from the game's end sequence, which must never break on a failed save:
 * this function NEVER throws. Every failure path (unconfigured client, DB error,
 * network error) logs clearly and resolves to a result object the caller can log.
 *
 * Flow: insert the `sessions` row, read back its id, then batch-insert all
 * `interactions` rows referencing it.
 *
 * The database has CHECK constraints on ended_by, category, choice, and floor —
 * any value outside those exact strings is REJECTED. The payload types below use
 * literal unions matching them exactly so mismatches fail at compile time.
 */
import { supabase } from "./supabase";
import type { Floor, StoreCategory } from "../data/storeCatalog";

/** DB CHECK constraint: sessions.ended_by */
export type EndedBy = "timer" | "went_outside";
/** DB CHECK constraint: interactions.choice */
export type InteractionChoice = "low" | "mid" | "high" | "wouldnt_shop";

export interface InteractionPayload {
  storeSlug: string; // frozen slug from src/data/storeCatalog.ts
  floor: Floor; // 1 | 2 (CHECK constraint)
  category: StoreCategory; // 'shop' | 'food' (CHECK constraint)
  choice: InteractionChoice;
  spend: number; // USD; 0 for wouldnt_shop
}

export interface SessionPayload {
  choseShop: boolean;
  choseGrabABite: boolean;
  choseRestroom: boolean;
  choseGoOutside: boolean;
  endedBy: EndedBy;
  elapsedSeconds: number; // integer column — rounded defensively before insert
  usedRestroom: boolean;
  outsideDestination: string | null;
  totalSpend: number;
  interactions: InteractionPayload[];
}

export type SaveSessionResult =
  | { ok: true; sessionId: string; interactionCount: number }
  | { ok: false; stage: "not-configured" | "session" | "interactions" | "unexpected"; message: string };

export async function saveSession(payload: SessionPayload): Promise<SaveSessionResult> {
  if (!supabase) {
    console.warn("Supabase not configured — session not saved");
    return { ok: false, stage: "not-configured", message: "Supabase not configured" };
  }

  try {
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        chose_shop: payload.choseShop,
        chose_grab_a_bite: payload.choseGrabABite,
        chose_restroom: payload.choseRestroom,
        chose_go_outside: payload.choseGoOutside,
        ended_by: payload.endedBy,
        elapsed_seconds: Math.round(payload.elapsedSeconds),
        used_restroom: payload.usedRestroom,
        outside_destination: payload.outsideDestination,
        total_spend: payload.totalSpend,
      })
      .select("id")
      .single();

    if (error || !data) {
      const message = error?.message ?? "insert returned no row";
      console.error("saveSession: sessions insert failed —", message, error);
      return { ok: false, stage: "session", message };
    }

    const sessionId = String((data as { id: string }).id);

    if (payload.interactions.length > 0) {
      const rows = payload.interactions.map((i) => ({
        session_id: sessionId,
        store_slug: i.storeSlug,
        floor: i.floor,
        category: i.category,
        choice: i.choice,
        spend: i.spend,
      }));
      const { error: interactionsError } = await supabase.from("interactions").insert(rows);
      if (interactionsError) {
        // the session row exists but its interactions don't — flag it for the log
        console.error(
          `saveSession: interactions insert failed (session ${sessionId} saved without them) —`,
          interactionsError.message,
          interactionsError,
        );
        return { ok: false, stage: "interactions", message: interactionsError.message };
      }
    }

    return { ok: true, sessionId, interactionCount: payload.interactions.length };
  } catch (err) {
    // network failure or anything else unexpected — swallow, log, report
    const message = err instanceof Error ? err.message : String(err);
    console.error("saveSession: unexpected error —", message, err);
    return { ok: false, stage: "unexpected", message };
  }
}
