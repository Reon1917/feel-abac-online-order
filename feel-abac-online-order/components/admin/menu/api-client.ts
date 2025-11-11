"use client";

import type { MenuReorderPayload } from "@/lib/menu/validators";

const defaultHeaders = {
  "Content-Type": "application/json",
};

export { defaultHeaders };

export async function fetchJSON<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      if (data?.error && typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // ignore parse errors
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function applyMenuReorder(payload: MenuReorderPayload) {
  return fetchJSON<{ success: boolean; updated: number }>(
    "/api/admin/menu/reorder",
    {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify(payload),
    }
  );
}
