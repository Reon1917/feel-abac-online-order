"use client";

import type orderDictionary from "@/dictionaries/en/order.json";
import type { OrderRecord } from "@/lib/orders/types";
import type { Locale } from "@/lib/i18n/config";

type OrderDictionary = typeof orderDictionary;

type Props = {
  order: OrderRecord;
  deliveryAddress: string;
  dictionary: OrderDictionary;
  locale: Locale;
};

const dateFormatter = new Intl.DateTimeFormat("en-TH", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function formatAmount(amount: number | null | undefined) {
  const safe = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString();
}

export function ReceiptView({ order, deliveryAddress, dictionary }: Props) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .receipt-wrapper {
            padding: 0 !important;
            background: white !important;
            min-height: auto !important;
          }
          .receipt-paper {
            box-shadow: none !important;
            max-width: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      <div className="receipt-wrapper min-h-screen bg-slate-200 py-6 px-4">
        {/* Print button - screen only */}
        <div className="no-print mx-auto max-w-sm mb-4 flex justify-end">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect width="12" height="8" x="6" y="14" />
            </svg>
            {dictionary.receiptPrint ?? "Print"}
          </button>
        </div>

        {/* Receipt paper */}
        <div className="receipt-paper mx-auto max-w-sm bg-white shadow-lg font-mono text-xs leading-tight">
          {/* Header */}
          <div className="text-center py-4 border-b border-dashed border-slate-400">
            <h1 className="text-lg font-bold tracking-wide">Feel ABAC</h1>
            <p className="text-[10px] text-slate-500 mt-1">Order #{order.displayId}</p>
          </div>

          {/* Customer & Date */}
          <div className="px-3 py-3 border-b border-dashed border-slate-400 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">{dictionary.receiptDate ?? "Date"}:</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{dictionary.receiptCustomer ?? "Customer"}:</span>
              <span>{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{dictionary.receiptPhone ?? "Phone"}:</span>
              <span>{order.customerPhone}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 shrink-0">{dictionary.receiptAddress ?? "Address"}:</span>
              <span className="text-right">{deliveryAddress}</span>
            </div>
          </div>

          {/* Items header */}
          <div className="px-3 py-2 border-b border-slate-300 bg-slate-50">
            <div className="flex text-[10px] font-bold text-slate-600 uppercase tracking-wide">
              <span className="flex-1">{dictionary.receiptItemHeader ?? "Item"}</span>
              <span className="w-8 text-center">{dictionary.receiptQtyHeader ?? "Qty"}</span>
              <span className="w-16 text-right">{dictionary.receiptPriceHeader ?? "Price"}</span>
            </div>
          </div>

          {/* Items */}
          <div className="px-3 py-2">
            {order.items.length === 0 ? (
              <p className="text-slate-400 py-2">{dictionary.receiptNoItems ?? "No items"}</p>
            ) : (
              order.items.map((item) => {
                // Build choice/note string
                const extras: string[] = [];
                item.choices.forEach((c) => {
                  if (c.selectionRole !== "base") {
                    extras.push(c.optionNameMm || c.optionName);
                  }
                });
                if (item.note) {
                  extras.push(`"${item.note}"`);
                }
                const extrasStr = extras.length > 0 ? extras.join(", ") : null;

                // Use Burmese name if available, fallback to English
                const itemName = item.menuItemNameMm || item.menuItemName;
                const menuCode = item.menuCode || "";

                return (
                  <div key={item.id} className="py-1.5 border-b border-dotted border-slate-200 last:border-0">
                    <div className="flex items-start">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold">
                          {menuCode && <span className="text-slate-500">{menuCode} </span>}
                          {itemName}
                        </span>
                        {extrasStr && (
                          <div className="text-[10px] text-slate-500 mt-0.5 pl-2">
                            └ {extrasStr}
                          </div>
                        )}
                      </div>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <span className="w-16 text-right">{formatAmount(item.totalPrice)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals */}
          <div className="px-3 py-3 border-t border-dashed border-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>{dictionary.receiptSubtotal ?? "Subtotal"}</span>
              <span>{formatAmount(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>{dictionary.receiptDelivery ?? "Delivery"}</span>
              <span>{order.deliveryFee != null ? formatAmount(order.deliveryFee) : "0"}</span>
            </div>
            {order.discountTotal > 0 && (
              <div className="flex justify-between">
                <span>{dictionary.receiptDiscount ?? "Discount"}</span>
                <span>-{formatAmount(order.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-300">
              <span>{dictionary.receiptTotal ?? "TOTAL"}</span>
              <span>฿{formatAmount(order.totalAmount)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-4 border-t border-dashed border-slate-400">
            <p className="font-semibold">{dictionary.receiptThankYou ?? "Thank you!"}</p>
          </div>
        </div>
      </div>
    </>
  );
}
