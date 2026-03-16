import { generate } from "promptparse";

type BuildPromptPayPayloadInput = {
  phoneNumber: string;
  amount: number;
};

type BuildBillPaymentPayloadInput = {
  billerId: string;
  ref1: string;
  ref2?: string;
  amount: number;
};

export type PromptPayAccountLike = {
  accountType: string;
  phoneNumber?: string | null;
  billerId?: string | null;
  ref1?: string | null;
  ref2?: string | null;
};

export function normalizePromptPayPhone(phoneNumber: string): string | null {
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  if (digitsOnly.startsWith("66") && digitsOnly.length === 11) {
    return `0${digitsOnly.slice(2)}`;
  }
  if (digitsOnly.length === 10 && digitsOnly.startsWith("0")) {
    return digitsOnly;
  }
  return null;
}

export function formatPromptPayPhoneForDisplay(phoneNumber: string | null | undefined) {
  const normalized = phoneNumber ? normalizePromptPayPhone(phoneNumber) : null;
  if (!normalized) return "";
  return normalized.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
}

function clampAmount(amount: number): number {
  const safe = Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
  return safe < 0 ? 0 : safe;
}

export function buildPromptPayPayload({
  phoneNumber,
  amount,
}: BuildPromptPayPayloadInput) {
  const normalizedPhone = normalizePromptPayPhone(phoneNumber);
  if (!normalizedPhone) {
    throw new Error("Invalid PromptPay phone number");
  }

  const boundedAmount = clampAmount(amount);

  const payload = generate.anyId({
    type: "MSISDN",
    target: normalizedPhone,
    amount: boundedAmount,
  });

  return {
    payload,
    normalizedPhone,
    amount: boundedAmount,
  };
}

export function buildBillPaymentPayload({
  billerId,
  ref1,
  ref2,
  amount,
}: BuildBillPaymentPayloadInput) {
  if (!billerId || !ref1) {
    throw new Error("Biller ID and Reference 1 are required for bill payment");
  }

  const boundedAmount = clampAmount(amount);

  const payload = generate.billPayment({
    billerId,
    ref1,
    ref2,
    ref3: ref2,
    amount: boundedAmount,
  });

  return { payload, amount: boundedAmount };
}

export function buildPayloadForAccount(
  account: PromptPayAccountLike,
  amount: number,
) {
  if (account.accountType === "billpayment") {
    const { payload, amount: bounded } = buildBillPaymentPayload({
      billerId: account.billerId!,
      ref1: account.ref1!,
      ref2: account.ref2 ?? undefined,
      amount,
    });
    return { payload, amount: bounded };
  }

  const { payload, amount: bounded } = buildPromptPayPayload({
    phoneNumber: account.phoneNumber!,
    amount,
  });
  return { payload, amount: bounded };
}
