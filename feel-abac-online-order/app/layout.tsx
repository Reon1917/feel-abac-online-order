import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Feel ABAC | Online food orders made easy",
  description:
    "Order from Feel Restaurant with a simple digital menu, quick pickup scheduling, and live updates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white antialiased text-slate-900">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
