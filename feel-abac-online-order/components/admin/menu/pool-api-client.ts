"use client";

import { defaultHeaders, fetchJSON } from "./api-client";
import type {
  ChoicePool,
  ChoicePoolOption,
  ChoicePoolWithOptions,
} from "@/lib/menu/pool-types";

export type CreatePoolPayload = {
  nameEn: string;
  nameMm?: string;
  isActive?: boolean;
};

export type UpdatePoolPayload = Partial<CreatePoolPayload>;
export type DuplicatePoolPayload = Partial<CreatePoolPayload>;

export type CreatePoolOptionPayload = {
  menuCode?: string | null;
  nameEn: string;
  nameMm?: string | null;
  price?: number;
  isAvailable?: boolean;
};

export type UpdatePoolOptionPayload = Partial<CreatePoolOptionPayload>;

export async function createPool(data: CreatePoolPayload): Promise<ChoicePool> {
  const response = await fetchJSON<{ pool: ChoicePool }>(
    "/api/admin/menu/pools",
    {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify(data),
    }
  );

  return response.pool;
}

export async function updatePool(
  poolId: string,
  data: UpdatePoolPayload
): Promise<ChoicePool> {
  const response = await fetchJSON<{ pool: ChoicePool }>(
    `/api/admin/menu/pools/${poolId}`,
    {
      method: "PATCH",
      headers: defaultHeaders,
      body: JSON.stringify(data),
    }
  );

  return response.pool;
}

export async function deletePool(poolId: string): Promise<void> {
  await fetchJSON<{ success: boolean }>(`/api/admin/menu/pools/${poolId}`, {
    method: "DELETE",
    headers: defaultHeaders,
  });
}

export async function duplicatePool(
  poolId: string,
  data: DuplicatePoolPayload = {}
): Promise<ChoicePoolWithOptions> {
  const response = await fetchJSON<{ pool: ChoicePoolWithOptions }>(
    `/api/admin/menu/pools/${poolId}/duplicate`,
    {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify(data),
    }
  );

  return response.pool;
}

export async function createPoolOption(
  poolId: string,
  data: CreatePoolOptionPayload
): Promise<ChoicePoolOption> {
  const response = await fetchJSON<{ option: ChoicePoolOption }>(
    `/api/admin/menu/pools/${poolId}/options`,
    {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify(data),
    }
  );

  return response.option;
}

export async function updatePoolOption(
  poolId: string,
  optionId: string,
  data: UpdatePoolOptionPayload
): Promise<ChoicePoolOption> {
  const response = await fetchJSON<{ option: ChoicePoolOption }>(
    `/api/admin/menu/pools/${poolId}/options/${optionId}`,
    {
      method: "PATCH",
      headers: defaultHeaders,
      body: JSON.stringify(data),
    }
  );

  return response.option;
}

export async function deletePoolOption(
  poolId: string,
  optionId: string
): Promise<void> {
  await fetchJSON<{ success: boolean }>(
    `/api/admin/menu/pools/${poolId}/options/${optionId}`,
    {
      method: "DELETE",
      headers: defaultHeaders,
    }
  );
}
