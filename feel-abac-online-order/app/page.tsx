import { LoginModal } from "@/components/auth/login-modal";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16 text-slate-900">
      <div className="flex w-full max-w-4xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
            Feel ABAC Online Ordering
          </span>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            Your favourite campus meals, ready when you are.
          </h1>
          <p className="text-base text-slate-600 sm:text-lg">
            Browse the daily menu, schedule pickup, and keep track of orders in
            one place. A streamlined food ordering experience built for Feel
            Restaurant customers.
          </p>
        </div>
        <LoginModal />
        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3 sm:gap-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            Quick ordering with saved favourites
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            Pickup and delivery time slots
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            Live status updates from the kitchen
          </div>
        </div>
      </div>
    </main>
  );
}
