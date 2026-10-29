import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieList = { name: string; value: string; options: CookieOptions }[];
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: "health" },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: CookieList) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component; middleware refreshes the session
          }
        },
      },
    }
  );
}
