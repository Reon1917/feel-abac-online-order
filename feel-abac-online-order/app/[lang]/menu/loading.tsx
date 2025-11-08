export default function Loading() {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-white px-6 text-center"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-slate-800">Loading menu</p>
        <p className="text-sm text-slate-500">Give us a sec while we prep your dishes</p>
      </div>
    </div>
  );
}
