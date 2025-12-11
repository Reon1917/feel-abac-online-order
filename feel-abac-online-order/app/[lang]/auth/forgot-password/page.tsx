import { unstable_noStore as noStore } from "next/cache";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

export default async function ForgotPasswordPage({ params }: PageProps) {
  noStore();

  const { lang } = await params;
  const locale = lang as Locale;
  const dictionary = getDictionary(locale, "auth");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white px-6 py-8 shadow-md">
        <h1 className="text-xl font-semibold text-slate-900">
          {dictionary.forgotPassword.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {dictionary.forgotPassword.subtitle}
        </p>

        <ForgotPasswordForm
          locale={locale}
          labels={dictionary.forgotPassword}
        />
      </div>
    </main>
  );
}

