import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Creates the user via the admin API with email_confirm set, so Supabase
// never queues a confirmation email and the project's mailer rate limit
// (shared, very low on the free tier) never comes into play.
export async function POST(request: Request) {
  const { email, password, display_name } = await request.json();

  if (!email || !password || !display_name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ userId: data.user.id });
}
