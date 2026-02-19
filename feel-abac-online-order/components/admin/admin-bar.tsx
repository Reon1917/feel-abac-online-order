import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AdminBar() {
  return (
    <div className="sticky top-0 z-50 border-b bg-emerald-900 px-4 py-2 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        <span className="shrink-0 text-sm font-medium">Admin View</span>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-w-0 shrink justify-end whitespace-normal px-2 text-right text-white hover:bg-emerald-800"
        >
          <Link href="/admin/dashboard">
            <span className="sm:hidden">← Admin Dashboard</span>
            <span className="hidden sm:inline">← Back to Admin Dashboard</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
