import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--hero-grad)" }}>
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
          Metallurgy Lab
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/register" className="btn btn-primary">
            Start free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--accent)] mb-4">
          Laboratory Image Analysis Platform
        </p>
        <h1 className="max-w-3xl text-5xl md:text-6xl font-semibold text-[var(--ink)] leading-[1.05]">
          Metallurgy Lab
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">
          Capture or upload microscope images, run standards-aligned software
          analysis, and cross-check results with AI — built for multi-tenant labs
          with RBAC.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="btn btn-primary">
            Create your lab workspace
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Sign in to existing org
          </Link>
        </div>

        <section className="mt-20 grid md:grid-cols-3 gap-5">
          {[
            {
              title: "Grain Size · ISO 643",
              body: "Intercept and planimetric estimates with overlays.",
            },
            {
              title: "Inclusion · ISO 4967",
              body: "Type A/B/C/D/DS heuristics with severity indices.",
            },
            {
              title: "Decarb · ISO 3887",
              body: "Metallographic depth from edge transition analysis.",
            },
          ].map((item) => (
            <article key={item.title} className="card p-5">
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
