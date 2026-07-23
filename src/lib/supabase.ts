/**
 * Supabase client — single shared instance.
 *
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (see .env.example). If either
 * is missing, the exported client is null and isSupabaseConfigured is false —
 * teammates without a .env must still be able to run the app, so nothing here
 * throws. Callers null-check the client (or check isSupabaseConfigured) and
 * degrade gracefully.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// vite-env.d.ts types these as `string`, but at runtime they're undefined
// without a .env (and empty string with an unfilled one) — widen and check.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured: boolean = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;
