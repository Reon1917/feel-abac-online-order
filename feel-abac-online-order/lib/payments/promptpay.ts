import { generate } from "promptparse";

type BuildPromptPayPayloadInput = {
  phoneNumber: string;
  amount: number;
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

export function buildPromptPayPayload({
  phoneNumber,
  amount,
}: BuildPromptPayPayloadInput) {
  const normalizedPhone = normalizePromptPayPhone(phoneNumber);
  if (!normalizedPhone) {
    throw new Error("Invalid PromptPay phone number");
  }

  const safeAmount = Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
  const boundedAmount = safeAmount < 0 ? 0 : safeAmount;

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
