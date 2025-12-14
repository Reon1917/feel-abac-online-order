import clsx from "clsx";

type StatusBadgeVariant = "active" | "inactive" | "pending" | "success" | "warning" | "error";

type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  label: string;
  showDot?: boolean;
};

const variantStyles: Record<StatusBadgeVariant, { bg: string; text: string; dot: string }> = {
  active: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  inactive: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    dot: "bg-slate-400",
  },
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  success: {
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  warning: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  error: {
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

export function StatusBadge({ variant, label, showDot = true }: StatusBadgeProps) {
  const styles = variantStyles[variant];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        styles.bg,
        styles.text
      )}
    >
      {showDot && <span className={clsx("h-1.5 w-1.5 rounded-full", styles.dot)} />}
      {label}
    </span>
  );
}

type RoleBadgeProps = {
  role: "super_admin" | "admin" | "moderator" | string;
};

const roleConfig: Record<string, { bg: string; text: string; label: string }> = {
  super_admin: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    label: "Super Admin",
  },
  admin: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    label: "Admin",
  },
  moderator: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    label: "Moderator",
  },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role] ?? {
    bg: "bg-slate-100",
    text: "text-slate-600",
    label: role,
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        config.bg,
        config.text
      )}
    >
      {config.label}
    </span>
  );
}
