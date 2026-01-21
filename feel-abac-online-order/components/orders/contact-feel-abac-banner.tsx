"use client";

import { Phone } from "lucide-react";

type ContactDictionary = {
  contactBannerTitle?: string;
  contactBannerSubtitle?: string;
  contactPhone?: string;
};

type Props = {
  dictionary: ContactDictionary;
};

const defaultDictionary: Required<ContactDictionary> = {
  contactBannerTitle: "Need to cancel?",
  contactBannerSubtitle: "Contact us directly.",
  contactPhone: "09X-XXX-XXXX",
};

export function ContactFeelAbacBanner({ dictionary }: Props) {
  const dict = { ...defaultDictionary, ...dictionary };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Phone className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-amber-800">{dict.contactBannerTitle}</p>
          <p className="text-sm text-amber-700">{dict.contactBannerSubtitle}</p>
          <a
            href={`tel:${dict.contactPhone.replace(/[^0-9+]/g, "")}`}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            <Phone className="h-4 w-4" />
            {dict.contactPhone}
          </a>
        </div>
      </div>
    </div>
  );
}
