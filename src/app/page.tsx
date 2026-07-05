import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-pine-600">
        <span className="inline-block h-2 w-2 rotate-45 bg-marigold-400" aria-hidden />
        Waypoint
      </p>
      <h1 className="font-display text-5xl font-semibold leading-tight sm:text-6xl">
        Build the application,{" "}
        <em className="not-italic text-pine-600 underline decoration-marigold-300 decoration-4 underline-offset-8">
          together
        </em>
        .
      </h1>
      <p className="mt-6 max-w-xl text-lg text-ink-soft">
        A private workspace where a student and their people — family, counselors, mentors —
        draft essays, shape the activities list, track recommenders and supplementals, and hold
        each other accountable. Every version kept. Every edit attributed.
      </p>
      <div className="mt-10 flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-pine-600 px-6 py-3 font-medium text-white transition-colors hover:bg-pine-700"
        >
          Start a workspace
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-paper-line bg-paper-raised px-6 py-3 font-medium text-ink transition-colors hover:border-pine-300"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-16 text-xs text-ink-faint">
        Nothing is ever lost — every draft, comment, and change is kept in the library.
      </p>
    </main>
  );
}
