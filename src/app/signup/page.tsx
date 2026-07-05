"use client";

import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui";
import { MEMBER_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [color, setColor] = useState<string>(MEMBER_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (!data.session) {
      // email confirmation is enabled on the Supabase project
      setNeedsConfirm(true);
      setBusy(false);
      return;
    }
    await supabase.from("profiles").update({ display_name: name, color }).eq("id", data.user!.id);
    await supabase.rpc("accept_my_invites");
    router.push("/workspaces");
    router.refresh();
  }

  if (needsConfirm) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 text-center">
        <h1 className="font-display text-3xl font-semibold">Check your email</h1>
        <p className="mt-3 text-sm text-ink-soft">
          We sent a confirmation link to <strong>{email}</strong>. Click it, then{" "}
          <Link href="/login" className="text-pine-600 underline">
            sign in
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-pine-600">Waypoint</p>
      <h1 className="font-display text-3xl font-semibold">Create your account</h1>
      <p className="mb-8 mt-2 text-sm text-ink-soft">
        Your name and color appear on every edit, comment, and version you make.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Display name</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fikir M." />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <Label>Password</Label>
          <Input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <Label>Your color</Label>
          <div className="flex gap-2">
            {MEMBER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Pick color ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  "h-8 w-8 rounded-full transition-transform",
                  color === c && "ring-2 ring-ink ring-offset-2 ring-offset-paper scale-110"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-clay-600">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-pine-600 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
