"use client";

type OnboardingWelcomeProps = {
  userName?: string | null;
  onStart: () => void;
};

export function OnboardingWelcome({ userName, onStart }: OnboardingWelcomeProps) {
  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-slate-100 bg-white px-6 py-10 shadow-sm sm:px-10">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
          Feel ABAC
        </p>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Let&apos;s get you ready
        </h1>
        <p className="text-base text-slate-600">
          {userName ? `Hi ${userName}, ` : ""}
          just two quick steps to start ordering.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl bg-emerald-50/60 p-4 text-sm text-emerald-900 sm:grid-cols-3 sm:gap-4 sm:p-5">
        <div className="font-semibold text-emerald-800">What we&apos;ll do</div>
        <ul className="col-span-2 space-y-2 text-slate-800">
          <li>Phone number for order updates.</li>
          <li>Default delivery spot for faster checkout.</li>
          <li>Edit anytime in your profile.</li>
        </ul>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">Takes under a minute.</p>
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        >
          Get started
        </button>
      </div>
    </section>
  );
}

