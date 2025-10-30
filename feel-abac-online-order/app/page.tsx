import Link from "next/link";
import { LoginModal } from "@/components/auth/login-modal";

const quickFacts = [
  "Today\'s menu in one view",
  "Reserve pickup slots ahead of time",
  "Admins control availability instantly",
];

const pwaSteps = {
  ios: [
    "Open Feel ABAC in Safari",
    "Tap share → Add to Home Screen",
    "Confirm name, then add",
  ],
  others: [
    "Open in Chrome",
    "Use Install prompt in menu",
    "Launch from home screen",
  ],
};

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-white text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16 md:px-10 lg:px-12">
        <header className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Feel ABAC online ordering
            </span>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Streamline how students order Feel Restaurant meals.
            </h1>
            <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
              Sign in to track the daily lineup, secure a pickup window, and keep the kitchen in sync across every device. The interface stays quiet until you need it—no distractions, just fast ordering.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <LoginModal />
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-md border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Create account
            </Link>
          </div>
        </header>

        <section className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">What to expect</h2>
            <ul className="space-y-3 text-sm text-slate-600">
              {quickFacts.map((fact) => (
                <li key={fact} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-emerald-500" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-500">
              Built mobile-first with responsive spacing, so the experience feels native on phones, tablets, and desktop kiosks.
            </p>
          </div>

          <div className="space-y-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6">
            <h3 className="text-base font-semibold text-slate-900">Install as an app</h3>
            <div className="space-y-4 text-sm text-slate-600">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">For iOS</p>
                <ol className="mt-2 space-y-1 pl-5">
                  {pwaSteps.ios.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Android & desktop</p>
                <ol className="mt-2 space-y-1 pl-5">
                  {pwaSteps.others.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
