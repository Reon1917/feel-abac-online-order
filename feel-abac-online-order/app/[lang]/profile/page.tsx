import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { withLocalePath } from "@/lib/i18n/path";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { MobileBottomNav } from "@/components/menu/mobile-bottom-nav";
import { ProfileClient } from "@/components/profile/profile-client";
import { hasCredentialAccount } from "@/lib/auth/queries";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function ProfilePage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const dictionary = getDictionary(locale, "profile");
  const common = getDictionary(locale, "common");

  const session = await getCurrentSession();

  if (!session?.user) {
    redirect(withLocalePath(locale, "/"));
  }

  const [profile, hasPassword] = await Promise.all([
    getUserProfile(session.user.id),
    hasCredentialAccount(session.user.id),
  ]);

  // If user hasn't completed onboarding, redirect them there
  if (!profile?.phoneNumber) {
    redirect(withLocalePath(locale, "/onboarding"));
  }

  return (
    <>
      <main className="min-h-screen w-full bg-slate-50 pb-24 sm:pb-10 sm:pl-20 lg:pl-24">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <ProfileClient
            user={{
              id: session.user.id,
              name: session.user.name ?? null,
              email: session.user.email,
            }}
            phone={profile.phoneNumber}
            hasPassword={hasPassword}
            dictionary={dictionary}
            common={common}
            locale={locale}
          />
        </div>
      </main>
      <MobileBottomNav locale={locale} labels={common.mobileNav} />
    </>
  );
}
