import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/session";

const featureCards = [
  {
    title: "Store-style capture",
    copy: "Photograph clothes from your phone and clean them into sharp white-background wardrobe tiles.",
  },
  {
    title: "Private wardrobe inventory",
    copy: "Keep tops, bottoms, shoes, and accessories organized under your own authenticated account.",
  },
  {
    title: "Fast outfit builder",
    copy: "Mix a look for the day in seconds, with saved combinations ready whenever you open the app.",
  },
];

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="marketing-shell">
      <section className="marketing-hero shell">
        <div className="hero-copy">
          <p className="kicker">Next.js + Better Auth</p>
          <h1>A wardrobe app that finally feels like a premium product.</h1>
          <p className="lede">
            Closet Daily is now structured as a real Next app with authenticated access, a mobile-first wardrobe
            dashboard, and a cleaner visual language built for iPhone use.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/sign-in">
              Sign In
            </Link>
            <Link className="button ghost" href="/sign-in?mode=signup">
              Create Account
            </Link>
          </div>
        </div>

        <div className="hero-showcase">
          <div className="showcase-card tall">
            <span>Outfit Signal</span>
            <strong>Capture, clean, style.</strong>
            <p>Built on Next.js App Router with Better Auth email and password sessions.</p>
          </div>
          <div className="showcase-grid">
            {featureCards.map((card) => (
              <article className="showcase-card" key={card.title}>
                <span>{card.title}</span>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
