import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AdminBar() {
  return (
    <div className="sticky top-0 z-50 border-b bg-emerald-900 px-4 py-2 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <span className="text-sm font-medium">Admin View</span>
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-emerald-800">
          <Link href="/admin/dashboard">← Back to Admin Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

