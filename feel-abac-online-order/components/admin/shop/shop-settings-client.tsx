"use client";

import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ShopStatus } from "@/lib/shop/queries";

export type ShopSettingsClientProps = {
  initialStatus: ShopStatus;
  fallbackMessages: {
    en: string;
    mm: string;
  };
};

export function ShopSettingsClient({ initialStatus, fallbackMessages }: ShopSettingsClientProps) {
  const [isOpen, setIsOpen] = useState<boolean>(initialStatus.isOpen);
  const [messageEn, setMessageEn] = useState<string>(initialStatus.closedMessageEn ?? "");
  const [messageMm, setMessageMm] = useState<string>(initialStatus.closedMessageMm ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const effectiveMessages = useMemo(() => {
    return {
      en: messageEn.trim() || fallbackMessages.en,
      mm: messageMm.trim() || fallbackMessages.mm,
    };
  }, [messageEn, messageMm, fallbackMessages]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/settings/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isOpen,
          closedMessageEn: messageEn.trim() || null,
          closedMessageMm: messageMm.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save settings");
      }

      const data = (await res.json()) as ShopStatus;
      setIsOpen(data.isOpen);
      setMessageEn(data.closedMessageEn ?? "");
      setMessageMm(data.closedMessageMm ?? "");
      setSuccess("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">Shop status</p>
          <p className="text-sm text-slate-600">Toggle to open/close ordering</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-sm font-semibold", isOpen ? "text-emerald-600" : "text-rose-600")}>{
            isOpen ? "Open" : "Closed"
          }</span>
          <Switch checked={isOpen} onCheckedChange={(checked) => setIsOpen(checked)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900" htmlFor="closedMessageEn">
            Closed message (English)
          </label>
          <Input
            id="closedMessageEn"
            placeholder={fallbackMessages.en}
            value={messageEn}
            onChange={(e) => setMessageEn(e.target.value)}
          />
          <p className="text-xs text-slate-500">Shown when the shop is closed.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900" htmlFor="closedMessageMm">
            Closed message (Burmese)
          </label>
          <Input
            id="closedMessageMm"
            placeholder={fallbackMessages.mm}
            value={messageMm}
            onChange={(e) => setMessageMm(e.target.value)}
          />
          <p className="text-xs text-slate-500">Localized Burmese fallback.</p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Preview</p>
        <p className="text-slate-800">{effectiveMessages.en}</p>
        <p>{effectiveMessages.mm}</p>
        <p className="text-xs text-slate-500">Cached for 60s; saved changes invalidate cache immediately.</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        {success && <span className="text-sm text-emerald-600">{success}</span>}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
    </div>
  );
}
