import { createHash } from "node:crypto";

import type { AddToCartSelection } from "./types";

export function generateCartItemHash(
  menuItemId: string,
  selections: AddToCartSelection[],
  note: string | null
) {
  const normalizedSelections = selections
    .map((selection) => ({
      groupId: selection.groupId,
      optionIds: [...selection.optionIds].sort(),
    }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId));

  const payload = JSON.stringify({
    menuItemId,
    selections: normalizedSelections,
    note: note?.trim() ?? "",
  });

  return createHash("sha256").update(payload).digest("hex");
}
