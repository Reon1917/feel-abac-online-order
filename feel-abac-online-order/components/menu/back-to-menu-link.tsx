"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type BackToMenuLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export function BackToMenuLink({
  href,
  className,
  children,
}: BackToMenuLinkProps) {
  return (
    <Link
      href={href}
      className={className}
    >
      {children}
    </Link>
  );
}
