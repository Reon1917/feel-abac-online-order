"use client";

import type orderDictionary from "@/dictionaries/en/order.json";
import type { OrderRecord } from "@/lib/orders/types";
import type { Locale } from "@/lib/i18n/config";
import { withLocalePath } from "@/lib/i18n/path";
import Link from "next/link";

type OrderDictionary = typeof orderDictionary;

type Props = {
  order: OrderRecord;
  deliveryAddress: string;
  dictionary: OrderDictionary;
  locale: Locale;
};

const currencyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "long",
  timeStyle: "short",
});

function formatCurrency(amount: number | null | undefined) {
  const safe = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return currencyFormatter.format(safe);
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

export function ReceiptView({ order, deliveryAddress, dictionary, locale }: Props) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-only {
            display: block !important;
          }
          
          .receipt-container {
            padding: 0 !important;
            background: white !important;
            min-height: auto !important;
          }
          
          .receipt-card {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
        }
        
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      <div className="receipt-container min-h-screen bg-slate-100 py-8 px-4 sm:px-6">
        {/* Screen-only header with actions */}
        <div className="no-print mx-auto max-w-2xl mb-6 flex items-center justify-between">
          <Link
            href={withLocalePath(locale, `/orders/${order.displayId}`)}
            className="inline-flex items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            ← {dictionary.backToMenu ?? "Back"}
          </Link>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
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
            {dictionary.receiptPrint ?? "Print / Save PDF"}
          </button>
        </div>

        {/* Receipt card */}
        <div className="receipt-card mx-auto max-w-2xl bg-white shadow-lg rounded-xl overflow-hidden">
          {/* Header */}
          <div className="bg-emerald-600 px-6 py-5 text-center text-white print:bg-emerald-600">
            <h1 className="text-2xl font-bold tracking-tight">Feel ABAC</h1>
            <p className="mt-1 text-emerald-100 text-sm">
              {dictionary.receiptTitle ?? "Order Receipt"}
            </p>
          </div>

          {/* Order info */}
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 font-medium uppercase text-xs tracking-wide">
                  {dictionary.orderIdLabel ?? "Order"}
                </p>
                <p className="mt-1 font-semibold text-slate-900">{order.displayId}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 font-medium uppercase text-xs tracking-wide">
                  {dictionary.receiptDate ?? "Date"}
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatDate(order.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Customer info */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 font-medium uppercase text-xs tracking-wide">
                  {dictionary.receiptCustomer ?? "Customer"}
                </p>
                <p className="mt-1 font-semibold text-slate-900">{order.customerName}</p>
                <p className="text-slate-600">{order.customerPhone}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium uppercase text-xs tracking-wide">
                  {dictionary.receiptDeliveryAddress ?? "Delivery Address"}
                </p>
                <p className="mt-1 font-semibold text-slate-900">{deliveryAddress}</p>
                {order.deliveryNotes && (
                  <p className="text-slate-600 text-xs mt-1 italic">
                    {order.deliveryNotes}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="px-6 py-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
              {dictionary.itemsLabel ?? "Items"}
            </h2>
            <div className="divide-y divide-slate-200">
              {order.items.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">
                  {dictionary.receiptNoItems ?? "No items"}
                </p>
              ) : (
                order.items.map((item) => (
                  <div key={item.id} className="py-3">
                    <div className="flex justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">
                          {item.menuItemName}
                          <span className="ml-2 text-slate-500 font-normal">
                            ×{item.quantity}
                          </span>
                        </p>
                        {item.choices.length > 0 && (
                          <div className="mt-1 text-xs text-slate-600">
                            {item.choices.map((choice) => (
                              <span key={choice.id} className="inline-block mr-2">
                                • {choice.optionName}
                                {choice.extraPrice > 0 && (
                                  <span className="text-slate-400 ml-1">
                                    (+{formatCurrency(choice.extraPrice)})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.note && (
                          <p className="mt-1 text-xs text-slate-500 italic">
                            Note: {item.note}
                          </p>
                        )}
                      </div>
                      <div className="text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(item.totalPrice)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>{dictionary.subtotalLabel ?? "Subtotal"}</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{dictionary.deliveryFeeLabel ?? "Delivery fee"}</span>
                <span>
                  {order.deliveryFee != null
                    ? formatCurrency(order.deliveryFee)
                    : dictionary.receiptFree ?? "Free"}
                </span>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>{dictionary.receiptDiscount ?? "Discount"}</span>
                  <span>-{formatCurrency(order.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-300 text-base font-bold text-slate-900">
                <span>{dictionary.orderTotalLabel ?? "Total"}</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Order note */}
          {order.orderNote && (
            <div className="px-6 py-4 border-t border-slate-200">
              <p className="text-slate-500 font-medium uppercase text-xs tracking-wide">
                {dictionary.orderNoteLabel ?? "Order Note"}
              </p>
              <p className="mt-1 text-sm text-slate-700">{order.orderNote}</p>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-5 bg-slate-900 text-center">
            <p className="text-white font-semibold">
              {dictionary.receiptThankYou ?? "Thank you for your order!"}
            </p>
            <p className="mt-1 text-slate-400 text-sm">
              {dictionary.receiptFooter ?? "Feel ABAC – Delicious food delivered to your door"}
            </p>
          </div>
        </div>

        {/* Print-only footer */}
        <div className="print-only text-center mt-8 text-xs text-slate-500">
          <p>{dictionary.receiptPrintedOn ?? "Printed on"}: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </>
  );
}
