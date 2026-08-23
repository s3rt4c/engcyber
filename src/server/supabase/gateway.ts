import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** M0 database boundary. Repositories are introduced with the first persisted workflow. */
export interface SupabaseGateway { readonly client: SupabaseClient; }
