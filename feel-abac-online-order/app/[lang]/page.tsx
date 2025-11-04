import { Suspense } from "react";
import { LoginModal } from "@/components/auth/login-modal";
import { getDictionary } from "@/lib/i18n/dictionaries";
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
    <main className="min-h-screen w-full bg-white text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-16 md:px-10 lg:px-12">
        <div className="flex justify-end">
          <Suspense fallback={<div className="w-40" />}>
            <UiLanguageSwitcher locale={locale} labels={common.languageSwitcher} />
          </Suspense>
        </div>

        <header className="flex flex-col gap-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            {dict.hero.eyebrow}
          </span>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            {dict.hero.headline}
          </h1>
          <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
            {dict.hero.subheadline}
          </p>
          <LoginModal />
        </header>

        <section className="space-y-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6">
          <h2 className="text-base font-semibold text-slate-900">{dict.instructions.title}</h2>
          <ol className="space-y-3 text-sm text-slate-600">
            {dict.instructions.steps.map((step) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full bg-emerald-500" />
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-5 rounded-2xl border border-emerald-100 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">{dict.pwa.title}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {dict.pwa.iosLabel}
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
                {dict.pwa.iosSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {dict.pwa.androidLabel}
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
                {dict.pwa.androidSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
