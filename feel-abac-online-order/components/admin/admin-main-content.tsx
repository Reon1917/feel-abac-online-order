"use client";

import clsx from "clsx";
import { useSidebar } from "./admin-sidebar-context";

type AdminMainContentProps = {
  children: React.ReactNode;
};

export function AdminMainContent({ children }: AdminMainContentProps) {
  const { isCollapsed } = useSidebar();

  return (
    <main
      className={clsx(
        "min-h-screen transition-all duration-300",
        isCollapsed ? "ml-[72px]" : "ml-64"
      )}
    >
      {children}
    </main>
  );
}
