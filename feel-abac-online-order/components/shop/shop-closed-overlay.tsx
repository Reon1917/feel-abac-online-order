import { Store } from "lucide-react";

const DEFAULT_EN = "Sorry, we are currently closed. Please check back again when the shop is open.";
const DEFAULT_MM = "ဝမ်းနည်းပါတယ်၊ ဆိုင်ပိတ်ထားပါသည်။ ဆိုင်ဖွင့်ချိန်တွင် ပြန်လည်ဝင်ရောက်ကြည့်ရှုပါ။";

type ShopClosedOverlayProps = {
  messageEn?: string | null;
  messageMm?: string | null;
};

export function ShopClosedOverlay({ messageEn, messageMm }: ShopClosedOverlayProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="max-w-md space-y-4 text-center">
        <Store className="mx-auto h-16 w-16 text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-900">{messageEn?.trim() || DEFAULT_EN}</h1>
        <p className="text-sm text-slate-600">{messageMm?.trim() || DEFAULT_MM}</p>
      </div>
    </div>
  );
}
