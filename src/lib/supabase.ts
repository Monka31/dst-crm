"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Ces deux valeurs sont publiques par conception : la clé « publishable »
// n'autorise que ce que les règles RLS de la base laissent passer.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://wksfqslzhbijeakrbaal.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_lIKg1G8jfzWboSTEVE2BLg_Ij5Z3Tbf";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}

export const supabase = getSupabase();
