import Image from "next/image";
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

const MENU_IMAGE_ITEMS = [
  {
    id: "kyay-oh",
    src: "https://cdn.feelabac.com/menu/8105ce7a-626f-45de-a6f5-0fe8134dcb7f/c4e9c2e5-45f1-428b-aae7-92ba745cf65f.webp",
  },
  {
    id: "mala-mao-cai",
    src: "https://cdn.feelabac.com/menu/1fca6567-4dee-4b7d-8b9a-2d5b8c53eb94/4168761f-de02-4861-b9c3-745730f39e33.webp",
  },
  {
    id: "chicken-curry-rice-salad-bowl",
    src: "https://cdn.feelabac.com/menu/80170d1a-49f9-4f92-bfbf-324a25e7a3d4/6788179b-c7c4-4454-a1ff-d99c3497c8db.webp",
  },
  {
    id: "nann-gyi-thoke",
    src: "https://cdn.feelabac.com/menu/ef6500cc-6749-4f1c-9344-17c411cff4d1/cab0b17e-c51e-4f47-9050-b61df0bc90a1.webp",
  },
  {
    id: "pickled-tea-leaves-rice-salad",
    src: "https://cdn.feelabac.com/menu/d3d81675-7e67-4977-ab94-d5f19e950301/72fe1469-f879-4c72-ad7f-72a2c1c9d714.webp",
  },
  {
    id: "mok-hin-khar",
    src: "https://cdn.feelabac.com/menu/c7997058-25ff-4180-8943-f9a46d346cd8/c133bcfa-e4e0-46a4-b160-85d97df0bc1e.webp",
  },
] as const;

const SHOWCASE_ASPECT_CLASSES = [
  "aspect-[4/5]",
  "aspect-[5/4]",
  "aspect-[4/4.5]",
  "aspect-[5/4]",
  "aspect-[4/4.8]",
  "aspect-[4/3.8]",
] as const;

export default async function Home({ params }: PageProps) {
  const { lang } = await params;
  const locale = lang as Locale;
  const dict = getDictionary(locale, "landing");
  const common = getDictionary(locale, "common");
  const menuCards = MENU_IMAGE_ITEMS.map((item, index) => ({
    ...item,
    label: dict.gallery.cards[index] ?? `Menu item ${index + 1}`,
  }));

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-white text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),transparent_70%)]" />
      <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-emerald-100/75 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-20 h-72 w-72 rounded-full bg-lime-100/75 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-10 pt-6 sm:px-8 lg:px-12">
        <div className="flex justify-end">
          <Suspense fallback={<div className="w-40" />}>
            <UiLanguageSwitcher locale={locale} labels={common.languageSwitcher} />
          </Suspense>
        </div>

        <section className="relative mt-6 grid flex-1 gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-10">
          <header className="space-y-7">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {dict.hero.eyebrow}
            </span>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold leading-tight text-emerald-950 sm:text-5xl">
                {dict.hero.headline}
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {dict.hero.subheadline}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <LoginModal
                locale={locale}
                defaultView="sign-in"
                ctaLabel={dict.hero.primaryCta}
                ctaVariant="default"
                ctaClassName="h-11 w-full rounded-full bg-emerald-600 px-6 text-white hover:bg-emerald-700 sm:w-auto"
              />
              <LoginModal
                locale={locale}
                defaultView="sign-up"
                ctaLabel={dict.hero.secondaryCta}
                ctaVariant="outline"
                ctaClassName="h-11 w-full rounded-full border-emerald-300 bg-white px-6 text-emerald-700 hover:bg-emerald-50 sm:w-auto"
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {dict.hero.kicker}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {dict.hero.pills.map((pill) => (
                <div
                  key={pill}
                  className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                >
                  {pill}
                </div>
              ))}
            </div>
          </header>

          <aside className="rounded-3xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/60 via-white to-white p-4 shadow-[0_30px_70px_-52px_rgba(6,95,70,0.4)] sm:p-5">
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold text-emerald-950 sm:text-xl">
                {dict.gallery.title}
              </h2>
              <p className="text-sm text-slate-600">{dict.gallery.subtitle}</p>
            </div>
            <div className="columns-2 gap-3 sm:columns-3">
              {menuCards.map((item, index) => (
                <figure
                  key={item.id}
                  className="group relative mb-3 break-inside-avoid overflow-hidden rounded-2xl"
                >
                  <div className={`relative ${SHOWCASE_ASPECT_CLASSES[index % SHOWCASE_ASPECT_CLASSES.length]}`}>
                    <Image
                      src={item.src}
                      alt={`${dict.gallery.imageAlt}: ${item.label}`}
                      fill
                      sizes="(max-width: 639px) 46vw, (max-width: 1023px) 30vw, 22vw"
                      quality={82}
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                      priority={index < 3}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/52 via-emerald-900/8 to-transparent" />
                    <figcaption className="absolute inset-x-2.5 bottom-2.5">
                      <span className="line-clamp-2 text-xs font-semibold uppercase tracking-[0.12em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] sm:text-[0.68rem]">
                        {item.label}
                      </span>
                    </figcaption>
                  </div>
                </figure>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-7">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-emerald-950">{dict.flow.title}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {dict.flow.items.map((item, index) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"
                >
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-100 px-2 text-xs font-semibold text-emerald-700">
                    {index + 1}
                  </span>
                  <h4 className="mt-3 text-sm font-semibold text-emerald-950">{item.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
