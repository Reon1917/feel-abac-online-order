import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getCurrentSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { withLocalePath } from "@/lib/i18n/path";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { getActiveDeliveryLocations } from "@/lib/delivery/queries";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function OnboardingPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const cartDict = getDictionary(locale, "cart");

  const session = await getCurrentSession();

  if (!session?.user) {
    redirect(withLocalePath(locale, "/"));
  }

  const profile = await getUserProfile(session.user.id);

  if (profile?.phoneNumber && profile?.deliverySelectionMode) {
    redirect(withLocalePath(locale, "/menu"));
  }

  const deliveryLocations = await getActiveDeliveryLocations();

  return (
    <div className="min-h-screen w-full bg-white">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Onboarding
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Finish setting up your profile
            </h1>
          </div>
          <SignOutButton />
        </header>

        <OnboardingWizard
          userName={session.user.name}
          userEmail={session.user.email}
          defaultPhone={profile?.phoneNumber}
          deliveryLocations={deliveryLocations}
          deliveryDictionary={cartDict.delivery}
        />
      </main>
    </div>
  );
}
