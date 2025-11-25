import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente para componentes (browser) que sincroniza la sesión en cookies.
export const supabaseClient = createClientComponentClient({
  supabaseUrl,
  supabaseKey: supabaseAnonKey,
});
