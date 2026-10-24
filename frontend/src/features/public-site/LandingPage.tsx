import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="landing-hero min-h-screen">
      <header className="landing-nav sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-[var(--accent)] to-[#0369a1] flex items-center justify-center">
              <span className="text-white text-xs font-bold">ML</span>
            </div>
            <span className="font-bold text-[var(--ink)] tracking-tight">Metallurgy Lab</span>
          </div>
          <div className="flex gap-3">
            <Link to="/login" className="btn btn-ghost">
              Sign In
            </Link>
            <Link to="/register" className="btn btn-primary">
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <p className="text-xs tracking-[0.12em] text-[var(--accent)] font-bold mb-4">
          Laboratory Image Analysis Platform
        </p>
        <h1 className="max-w-3xl text-5xl md:text-6xl font-extrabold text-[var(--ink)] leading-[1.05]">
          Metallurgy Lab
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">
          Capture or Upload Microscope Images, Run Standards-Aligned Software
          Analysis, and Cross-Check Results With AI — Built for Multi-Tenant Labs
          With RBAC.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/register" className="btn btn-primary">
            Create Your Lab Workspace
          </Link>
          <Link to="/login" className="btn btn-ghost">
            Sign In to Existing Org
          </Link>
        </div>

        <section className="mt-20 grid md:grid-cols-3 gap-5">
          {[
            {
              title: "Grain Size · ISO 643",
              body: "Intercept and Planimetric Estimates With Overlays.",
            },
            {
              title: "Inclusion · ISO 4967",
              body: "Type A/B/C/D/DS Heuristics With Severity Indices.",
            },
            {
              title: "Decarb · ISO 3887",
              body: "Metallographic Depth From Edge Transition Analysis.",
            },
          ].map((item) => (
            <article key={item.title} className="feature-card">
              <h2>{item.title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
