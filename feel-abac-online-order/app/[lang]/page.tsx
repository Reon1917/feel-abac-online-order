import Link from "next/link";
import { LoginModal } from "@/components/auth/login-modal";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";
import { UiLanguageSwitcher } from "@/components/i18n/ui-language-switcher";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function Home({ params }: PageProps) {
  const { lang } = await params;
  const locale = lang as Locale;
  const dict = getDictionary(locale, "landing");
  const common = getDictionary(locale, "common");

  return (
    <>
      <nav className="flex items-center justify-end px-6 py-4 md:px-10 lg:px-12">
        <UiLanguageSwitcher
          locale={locale}
          labels={common.languageSwitcher}
        />
      </nav>
      <main className="min-h-screen w-full bg-white text-slate-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16 md:px-10 lg:px-12">
          <header className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {dict.hero.eyebrow}
              </span>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              {dict.hero.headline}
            </h1>
            <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
              {dict.hero.subheadline}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <LoginModal />
            <Link
              href={withLocalePath(locale, "/onboarding")}
              className="inline-flex items-center justify-center rounded-md border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              {dict.hero.createAccountCta}
            </Link>
          </div>
        </header>

        <section className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">{dict.quickFacts.title}</h2>
            <ul className="space-y-3 text-sm text-slate-600">
              {dict.quickFacts.items.map((fact) => (
                <li key={fact} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-emerald-500" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-500">
              {dict.quickFacts.footnote}
            </p>
          </div>

          <div className="space-y-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6">
            <h3 className="text-base font-semibold text-slate-900">{dict.pwa.title}</h3>
            <div className="space-y-4 text-sm text-slate-600">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  {dict.pwa.iosLabel}
                </p>
                <ol className="mt-2 space-y-1 pl-5">
                  {dict.pwa.iosSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  {dict.pwa.androidLabel}
                </p>
                <ol className="mt-2 space-y-1 pl-5">
                  {dict.pwa.androidSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
    </>
  );
}
