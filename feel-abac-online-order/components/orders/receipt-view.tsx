"use client";

import { useRef, useState } from "react";
import type orderDictionary from "@/dictionaries/en/order.json";
import type { OrderRecord } from "@/lib/orders/types";
import { computeOrderTotals, ORDER_VAT_PERCENT_LABEL } from "@/lib/orders/totals";

type OrderDictionary = typeof orderDictionary;

type Props = {
  order: OrderRecord;
  deliveryAddress: string;
  dictionaryEn: OrderDictionary;
  dictionaryMy: OrderDictionary;
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

type ReceiptContentProps = {
  order: OrderRecord;
  deliveryAddress: string;
  dictionary: OrderDictionary;
  useBurmeseName?: boolean;
};

type ReceiptItemChoice = OrderRecord["items"][number]["choices"][number];

// Use inline styles with hex colors for html2canvas compatibility (avoids lab() color parsing errors)
const styles = {
  paper: {
    maxWidth: "24rem",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    fontFamily: "ui-monospace, monospace",
    fontSize: "12px",
    lineHeight: "1.25",
    color: "#1e293b", // slate-800 - dark for good contrast
  },
  header: {
    textAlign: "center" as const,
    padding: "16px",
    borderBottom: "1px dashed #94a3b8",
  },
  headerTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    letterSpacing: "0.05em",
    color: "#0f172a", // slate-900
  },
  headerSubtitle: {
    fontSize: "10px",
    color: "#475569", // slate-600
    marginTop: "4px",
  },
  section: {
    padding: "12px",
    borderBottom: "1px dashed #94a3b8",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  label: {
    color: "#475569", // slate-600 - darker than before
  },
  value: {
    color: "#1e293b", // slate-800
  },
  itemsHeader: {
    padding: "8px 12px",
    borderBottom: "1px solid #cbd5e1",
    backgroundColor: "#f8fafc",
  },
  itemsHeaderRow: {
    display: "flex",
    fontSize: "10px",
    fontWeight: "bold",
    color: "#334155", // slate-700
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  itemsContainer: {
    padding: "8px 12px",
  },
  itemRow: {
    padding: "6px 0",
    borderBottom: "1px dotted #e2e8f0",
  },
  itemName: {
    fontWeight: 600,
    color: "#1e293b",
  },
  menuCode: {
    color: "#64748b", // slate-500
  },
  extras: {
    fontSize: "10px",
    color: "#475569",
    marginTop: "2px",
    paddingLeft: "8px",
  },
  totalsSection: {
    padding: "12px",
    borderTop: "1px dashed #94a3b8",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
    color: "#334155",
  },
  grandTotal: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: "bold",
    fontSize: "14px",
    paddingTop: "4px",
    marginTop: "4px",
    borderTop: "1px solid #cbd5e1",
    color: "#0f172a",
  },
  footer: {
    textAlign: "center" as const,
    padding: "16px",
    borderTop: "1px dashed #94a3b8",
  },
  footerText: {
    fontWeight: 600,
    color: "#1e293b",
  },
};

function ReceiptContent({ order, deliveryAddress, dictionary, useBurmeseName }: ReceiptContentProps) {
  const safeDeliveryAddress =
    deliveryAddress || dictionary.receiptDeliveryFallback || "See order for details";
  const baseLabel = dictionary.receiptBase ?? "Base";
  const formatChoiceName = (choice: ReceiptItemChoice) =>
    useBurmeseName ? (choice.optionNameMm || choice.optionName) : choice.optionName;
  const totals = computeOrderTotals({
    foodSubtotal: order.subtotal,
    vatAmount: order.vatAmount,
    deliveryFee: order.deliveryFee,
    discountTotal: order.discountTotal,
  });

  return (
    <div style={styles.paper}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Feel ABAC</h1>
        <p style={styles.headerSubtitle}>Order #{order.displayId}</p>
      </div>

      {/* Customer & Date */}
      <div style={styles.section}>
        <div style={styles.row}>
          <span style={styles.label}>{dictionary.receiptDate ?? "Date"}:</span>
          <span style={styles.value}>{formatDate(order.createdAt)}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>{dictionary.receiptCustomer ?? "Customer"}:</span>
          <span style={styles.value}>{order.customerName}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>{dictionary.receiptPhone ?? "Phone"}:</span>
          <span style={styles.value}>{order.customerPhone}</span>
        </div>
        <div style={{ ...styles.row, gap: "8px" }}>
          <span style={{ ...styles.label, flexShrink: 0 }}>{dictionary.receiptAddress ?? "Address"}:</span>
          <span style={{ ...styles.value, textAlign: "right" }}>{safeDeliveryAddress}</span>
        </div>
      </div>

      {/* Items header */}
      <div style={styles.itemsHeader}>
        <div style={styles.itemsHeaderRow}>
          <span style={{ flex: 1 }}>{dictionary.receiptItemHeader ?? "Item"}</span>
          <span style={{ width: "32px", textAlign: "center" }}>{dictionary.receiptQtyHeader ?? "Qty"}</span>
          <span style={{ width: "64px", textAlign: "right" }}>{dictionary.receiptPriceHeader ?? "Price"}</span>
        </div>
      </div>

      {/* Items */}
      <div style={styles.itemsContainer}>
        {order.items.length === 0 ? (
          <p style={{ color: "#64748b", padding: "8px 0" }}>{dictionary.receiptNoItems ?? "No items"}</p>
        ) : (
          order.items.map((item, idx) => {
            const baseChoices = item.choices.filter(
              (choice) => choice.selectionRole === "base"
            );
            const addonChoices = item.choices.filter(
              (choice) => choice.selectionRole === "addon"
            );
            const neutralChoices = item.choices.filter(
              (choice) => choice.selectionRole == null
            );

            const itemName = useBurmeseName
              ? (item.menuItemNameMm || item.menuItemName)
              : item.menuItemName;
            const menuCode = item.menuCode || "";

            return (
              <div
                key={item.id}
                style={{
                  ...styles.itemRow,
                  borderBottom: idx === order.items.length - 1 ? "none" : "1px dotted #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={styles.itemName}>
                      {menuCode && <span style={styles.menuCode}>{menuCode} </span>}
                      {itemName}
                    </span>
                    {baseChoices.length > 0 && (
                      <div style={styles.extras}>
                        └ {baseLabel}:{" "}
                        {baseChoices
                          .map((choice) =>
                            `${choice.menuCode ? `[${choice.menuCode}] ` : ""}${formatChoiceName(choice)}`
                          )
                          .join(", ")}
                      </div>
                    )}
                    {addonChoices.length > 0 && (
                      addonChoices.map((choice) => (
                        <div key={choice.id} style={styles.extras}>
                          └ + {choice.menuCode ? `[${choice.menuCode}] ` : ""}
                          {formatChoiceName(choice)}
                        </div>
                      ))
                    )}
                    {neutralChoices.length > 0 && (
                      <div style={styles.extras}>
                        └{" "}
                        {neutralChoices
                          .map((choice) =>
                            `${choice.menuCode ? `[${choice.menuCode}] ` : ""}${formatChoiceName(choice)}`
                          )
                          .join(", ")}
                      </div>
                    )}
                    {item.note && (
                      <div style={styles.extras}>
                        └ &quot;{item.note}&quot;
                      </div>
                    )}
                  </div>
                  <span style={{ width: "32px", textAlign: "center", color: "#334155" }}>{item.quantity}</span>
                  <span style={{ width: "64px", textAlign: "right", color: "#334155" }}>{formatAmount(item.totalPrice)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Totals */}
      <div style={styles.totalsSection}>
        <div style={styles.totalRow}>
          <span>{dictionary.receiptSubtotal ?? "Subtotal"}</span>
          <span>{formatAmount(totals.foodSubtotal)}</span>
        </div>
        <div style={styles.totalRow}>
          <span>{dictionary.receiptVat ?? `VAT (${ORDER_VAT_PERCENT_LABEL})`}</span>
          <span>{formatAmount(totals.vatAmount)}</span>
        </div>
        <div style={styles.totalRow}>
          <span>{dictionary.receiptFoodTotal ?? "Food Total"}</span>
          <span>{formatAmount(totals.foodTotal)}</span>
        </div>
        <div style={styles.totalRow}>
          <span>{dictionary.receiptDelivery ?? "Delivery"}</span>
          <span>{formatAmount(totals.deliveryFee)}</span>
        </div>
        {order.discountTotal > 0 && (
          <div style={styles.totalRow}>
            <span>{dictionary.receiptDiscount ?? "Discount"}</span>
            <span>-{formatAmount(order.discountTotal)}</span>
          </div>
        )}
        <div style={styles.grandTotal}>
          <span>{dictionary.receiptTotal ?? "TOTAL"}</span>
          <span>฿{formatAmount(totals.totalAmount)}</span>
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <p style={styles.footerText}>{dictionary.receiptThankYou ?? "Thank you!"}</p>
      </div>
    </div>
  );
}

export function ReceiptView({ order, deliveryAddress, dictionaryEn, dictionaryMy }: Props) {
  const receiptEnRef = useRef<HTMLDivElement>(null);
  const receiptMyRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState<"en" | "my" | null>(null);

  const handleDownload = async (lang: "en" | "my") => {
    const ref = lang === "en" ? receiptEnRef : receiptMyRef;
    const element = ref.current;
    if (!element) return;

    setDownloading(lang);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:absolute;left:-9999px;top:0;width:400px;height:800px;border:none;";
    document.body.appendChild(iframe);

    try {
      // Dynamic import html2pdf.js
      const html2pdf = (await import("html2pdf.js")).default;

      // Create isolated iframe to avoid Tailwind's lab() colors
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error("Could not access iframe document");
      }

      // Write clean HTML without Tailwind - just the receipt with inline styles
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              background: white;
              color: #1e293b;
            }
          </style>
        </head>
        <body>${element.innerHTML}</body>
        </html>
      `);
      iframeDoc.close();

      // Wait for iframe to render
      await new Promise((resolve) => setTimeout(resolve, 100));

      const target = iframeDoc.body.firstElementChild as HTMLElement;
      if (!target) {
        throw new Error("No content in iframe");
      }

      await html2pdf()
        .set({
          margin: 2,
          filename: `receipt-${order.displayId}-${lang}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            onclone: (doc: Document) => {
              // Strip Tailwind/oklch styles to avoid html2canvas lab() parsing errors.
              doc.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
                node.parentNode?.removeChild(node);
              });
              doc.documentElement.style.backgroundColor = "#ffffff";
              doc.body.style.backgroundColor = "#ffffff";
              doc.body.style.color = "#1e293b";
              doc.body.style.margin = "0";
              doc.body.style.padding = "0";
              doc.body.style.fontFamily =
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            },
          },
          jsPDF: { unit: "mm", format: [80, 200], orientation: "portrait" },
        })
        .from(target)
        .save();
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      setDownloading(null);
    }
  };

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "8px",
    backgroundColor: "#059669", // emerald-600
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#ffffff",
    border: "none",
    cursor: "pointer",
  };

  const buttonDisabledStyle = {
    ...buttonStyle,
    opacity: 0.6,
    cursor: "not-allowed",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#e2e8f0", padding: "24px 16px" }}>
      {/* Download buttons */}
      <div style={{ maxWidth: "24rem", margin: "0 auto 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <p style={{ fontSize: "14px", fontWeight: 500, color: "#334155", textAlign: "center" }}>
          Download Receipt / ပြေစာ ဒေါင်းလုပ်
        </p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => void handleDownload("en")}
            disabled={downloading !== null}
            style={downloading !== null ? buttonDisabledStyle : buttonStyle}
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            {downloading === "en" ? "Downloading..." : "English"}
          </button>
          <button
            type="button"
            onClick={() => void handleDownload("my")}
            disabled={downloading !== null}
            style={downloading !== null ? buttonDisabledStyle : buttonStyle}
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            {downloading === "my" ? "Downloading..." : "မြန်မာ"}
          </button>
        </div>
      </div>

      {/* Visible English receipt */}
      <div ref={receiptEnRef}>
        <ReceiptContent
          order={order}
          deliveryAddress={deliveryAddress}
          dictionary={dictionaryEn}
          useBurmeseName={false}
        />
      </div>

      {/* Hidden Burmese receipt for PDF generation */}
      <div
        ref={receiptMyRef}
        style={{ position: "absolute", left: "-9999px", top: 0 }}
        aria-hidden="true"
      >
        <ReceiptContent
          order={order}
          deliveryAddress={deliveryAddress}
          dictionary={dictionaryMy}
          useBurmeseName={true}
        />
      </div>
    </div>
  );
}
