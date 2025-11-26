import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { AdminBar } from "@/components/admin/admin-bar";
import { PromptPayAccountsClient } from "@/components/admin/promptpay/promptpay-accounts-client";
import { listPromptPayAccounts } from "@/lib/payments/queries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import { getSession } from "@/lib/session";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function PromptPaySettingsPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;

  const session = await getSession();
  if (!session?.isAdmin) {
    redirect(withLocalePath(locale, "/"));
  }

  const dictionary = getDictionary(locale, "adminPromptpay");
  const accounts = await listPromptPayAccounts();

  return (
    <>
      <AdminBar />
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 lg:px-10">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">
              {dictionary.pageTitle}
            </h1>
            <p className="text-sm text-slate-600">
              {dictionary.pageSubtitle}
            </p>
          </div>
          <PromptPayAccountsClient
            initialAccounts={accounts}
            dictionary={dictionary}
          />
        </div>
      </main>
    </>
  );
}
