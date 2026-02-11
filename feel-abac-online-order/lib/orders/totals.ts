const VAT_PERCENT = 7;

function toNonNegativeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function toRoundedBaht(value: number | null | undefined) {
  return Math.round(toNonNegativeNumber(value));
}

export function calculateVatAmount(foodSubtotal: number) {
  const safeSubtotal = toNonNegativeNumber(foodSubtotal);
  return Math.floor((safeSubtotal * VAT_PERCENT) / 100);
}

export type OrderTotalsInput = {
  foodSubtotal: number;
  vatAmount?: number | null;
  deliveryFee?: number | null;
  discountTotal?: number | null;
};

export type OrderTotals = {
  foodSubtotal: number;
  vatAmount: number;
  foodTotal: number;
  deliveryFee: number;
  discountTotal: number;
  totalAmount: number;
};

export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const foodSubtotal = toNonNegativeNumber(input.foodSubtotal);
  const vatAmount =
    input.vatAmount == null
      ? calculateVatAmount(foodSubtotal)
      : Math.floor(toNonNegativeNumber(input.vatAmount));
  const deliveryFee = toRoundedBaht(input.deliveryFee);
  const discountTotal = toNonNegativeNumber(input.discountTotal);
  const foodTotal = foodSubtotal + vatAmount;
  const totalAmount = Math.max(0, foodTotal + deliveryFee - discountTotal);

  return {
    foodSubtotal,
    vatAmount,
    foodTotal,
    deliveryFee,
    discountTotal,
    totalAmount,
  };
}

export const ORDER_VAT_PERCENT_LABEL = `${VAT_PERCENT}%`;
