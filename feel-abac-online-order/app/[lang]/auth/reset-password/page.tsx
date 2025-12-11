import { unstable_noStore as noStore } from "next/cache";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
  searchParams: Promise<{
    token?: string;
    error?: string;
  }>;
};

export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps) {
  noStore();

  const [{ lang }, query] = await Promise.all([params, searchParams]);
  const locale = lang as Locale;
  const dictionary = getDictionary(locale, "auth");

  const token = typeof query.token === "string" ? query.token : undefined;
  const errorCode = typeof query.error === "string" ? query.error : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white px-6 py-8 shadow-md">
        <h1 className="text-xl font-semibold text-slate-900">
          {dictionary.resetPassword.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {dictionary.resetPassword.subtitle}
        </p>

        <ResetPasswordForm
          locale={locale}
          labels={dictionary.resetPassword}
          initialToken={token}
          initialErrorCode={errorCode}
        />
      </div>
    </main>
  );
}

