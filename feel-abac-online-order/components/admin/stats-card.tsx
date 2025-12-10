import clsx from "clsx";

type StatsCardProps = {
  title?: string;
  label?: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "success" | "warning" | "info";
};

export function StatsCard({ 
  title, 
  label, 
  value, 
  subtitle,
  variant = "default" 
}: StatsCardProps) {
  const displayLabel = title || label || "";
  
  return (
    <div
      className={clsx(
        "rounded-xl border p-3 md:p-4 lg:p-5",
        variant === "default" && "border-slate-200 bg-white",
        variant === "success" && "border-emerald-100 bg-emerald-50",
        variant === "warning" && "border-amber-100 bg-amber-50",
        variant === "info" && "border-blue-100 bg-blue-50"
      )}
    >
      <p
        className={clsx(
          "text-xs font-semibold uppercase tracking-wide",
          variant === "default" && "text-slate-500",
          variant === "success" && "text-emerald-600",
          variant === "warning" && "text-amber-600",
          variant === "info" && "text-blue-600"
        )}
      >
        {displayLabel}
      </p>
      <p
        className={clsx(
          "mt-1 text-2xl font-bold md:text-3xl",
          variant === "default" && "text-slate-900",
          variant === "success" && "text-emerald-700",
          variant === "warning" && "text-amber-700",
          variant === "info" && "text-blue-700"
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      )}
    </div>
  );
}

type StatsGridProps = {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
};

export function StatsGrid({ children, columns = 3 }: StatsGridProps) {
  return (
    <div
      className={clsx(
        "grid gap-3 md:gap-4",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4"
      )}
    >
      {children}
    </div>
  );
}
