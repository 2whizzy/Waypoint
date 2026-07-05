"use client";

import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    await supabase.rpc("accept_my_invites");
    router.push(params.get("next") ?? "/workspaces");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Email</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <Label>Password</Label>
        <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      {error && <p className="text-sm text-clay-600">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-pine-600">Waypoint</p>
      <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
      <p className="mb-8 mt-2 text-sm text-ink-soft">Sign in to your workspaces.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-sm text-ink-soft">
        No account?{" "}
        <Link href="/signup" className="font-medium text-pine-600 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
