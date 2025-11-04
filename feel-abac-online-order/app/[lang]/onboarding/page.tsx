import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { withLocalePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function OnboardingPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;

  const session = await getCurrentSession();

  if (!session?.user) {
    redirect(withLocalePath(locale, "/"));
  }

  const profile = await getUserProfile(session.user.id);

  if (profile?.phoneNumber) {
    redirect(withLocalePath(locale, "/menu"));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-16 sm:px-10 lg:px-16">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Finish setting up your profile
            </h1>
            <p className="text-sm text-slate-600">
              Hi {session.user.name || session.user.email}, add a phone number
              so the restaurant can confirm orders with you if needed.
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <OnboardingForm defaultPhone={profile?.phoneNumber} />

      <section className="grid gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Why we collect your contact details
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm pickup instructions or delivery adjustments quickly.</li>
          <li>Share updates if an item needs to be substituted.</li>
          <li>Let you know when your order is ready to be collected.</li>
        </ul>
      </section>
    </main>
  );
}
