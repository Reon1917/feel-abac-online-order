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

export default async function Home({ params }: PageProps) {
  const { lang } = await params;
  const locale = lang as Locale;
  const dict = getDictionary(locale, "landing");
  const common = getDictionary(locale, "common");
  const menuCards = MENU_IMAGE_ITEMS.map((item, index) => ({
    ...item,
    label: dict.gallery.cards[index] ?? `Menu item ${index + 1}`,
  }));
  const contactHref = `tel:${dict.info.contactValue.replace(/\s+/g, "")}`;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-white text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),transparent_70%)]" />
      <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-emerald-100/75 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-20 h-72 w-72 rounded-full bg-lime-100/75 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-7 pt-4 sm:px-8 sm:pb-10 sm:pt-6 lg:px-12">
        <div className="flex justify-end">
          <Suspense fallback={<div className="w-40" />}>
            <UiLanguageSwitcher
              locale={locale}
              labels={common.languageSwitcher}
              className="origin-top-right scale-[0.92] sm:scale-100 [&>label]:text-[0.62rem] [&>label]:tracking-[0.12em] sm:[&>label]:text-xs sm:[&>label]:tracking-wide [&_[data-slot=select-trigger]]:h-8 [&_[data-slot=select-trigger]]:w-32 [&_[data-slot=select-trigger]]:text-sm sm:[&_[data-slot=select-trigger]]:h-9 sm:[&_[data-slot=select-trigger]]:w-40"
            />
          </Suspense>
        </div>

        <section className="relative mt-4 grid flex-1 gap-5 sm:mt-5 sm:gap-7 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-10">
          <header className="space-y-5 sm:space-y-7">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {dict.hero.eyebrow}
            </span>
            <div className="space-y-4">
              <h1 className="max-w-xl text-[2.15rem] font-semibold leading-[1.15] text-emerald-950 sm:text-5xl sm:leading-tight">
                {dict.hero.headline}
              </h1>
              <p className="max-w-xl text-[1.05rem] leading-relaxed text-slate-600 sm:text-lg">
                {dict.hero.subheadline}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:items-center">
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
          </header>

          <aside className="rounded-3xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/60 via-white to-white p-3.5 shadow-[0_30px_70px_-52px_rgba(6,95,70,0.4)] sm:p-5">
            <div className="mb-4 space-y-1">
              <h2 className="text-base font-semibold text-emerald-950 sm:text-xl">
                {dict.gallery.title}
              </h2>
              <p className="text-xs text-slate-600 sm:text-sm">{dict.gallery.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
              {menuCards.map((item, index) => (
                <figure
                  key={item.id}
                  className="group space-y-1.5 sm:space-y-2"
                >
                  <div className="relative aspect-[5/4] overflow-hidden rounded-2xl bg-white ring-1 ring-emerald-100/80 sm:aspect-[4/3]">
                    <Image
                      src={item.src}
                      alt={`${dict.gallery.imageAlt}: ${item.label}`}
                      fill
                      sizes="(max-width: 639px) 46vw, (max-width: 1023px) 31vw, 22vw"
                      quality={82}
                      className="object-contain transition-transform duration-500 group-hover:scale-[1.015]"
                      priority={index < 3}
                    />
                  </div>
                  <figcaption className="line-clamp-2 px-1 text-xs font-semibold leading-snug text-emerald-950 sm:text-sm">
                    {item.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-5 sm:mt-7">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-3.5 sm:p-6">
            <h3 className="text-base font-semibold text-emerald-950 sm:text-lg">{dict.info.title}</h3>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">{dict.info.subtitle}</p>
            <div className="mt-3.5 grid gap-2.5 sm:mt-4 sm:grid-cols-2 sm:gap-3">
              <article className="rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-sm sm:p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  {dict.info.locationLabel}
                </p>
                <p className="mt-2 text-[1.04rem] font-semibold text-emerald-950 sm:text-base">
                  {dict.info.locationValue}
                </p>
              </article>
              <article className="rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-sm sm:p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  {dict.info.contactLabel}
                </p>
                <a
                  href={contactHref}
                  className="mt-2 inline-block text-[1.04rem] font-semibold text-emerald-950 underline-offset-2 hover:underline sm:text-base"
                >
                  {dict.info.contactValue}
                </a>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm">{dict.info.contactNote}</p>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
