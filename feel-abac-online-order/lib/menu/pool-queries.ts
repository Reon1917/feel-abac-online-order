import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db/client";
import { dbTx } from "@/src/db/tx-client";
import {
  choicePools,
  choicePoolOptions,
  setMenuPoolLinks,
} from "@/src/db/schema";
import {
  ChoicePool,
  ChoicePoolOption,
  ChoicePoolWithOptions,
  SetMenuPoolLink,
  SetMenuPoolLinkWithPool,
} from "./pool-types";
import { numericToNumber } from "@/lib/db/numeric";

// Input types
export type CreatePoolInput = {
  nameEn: string;
  nameMm?: string | null;
  isActive?: boolean;
  displayOrder?: number;
};

export type UpdatePoolInput = Partial<CreatePoolInput>;

export type CreatePoolOptionInput = {
  menuCode?: string | null;
  nameEn: string;
  nameMm?: string | null;
  price?: number;
  isAvailable?: boolean;
  displayOrder?: number;
};

export type UpdatePoolOptionInput = Partial<CreatePoolOptionInput>;

export type CreatePoolLinkInput = {
  menuItemId: string;
  poolId: string;
  isPriceDetermining?: boolean;
  usesOptionPrice?: boolean;
  flatPrice?: number | null;
  isRequired?: boolean;
  minSelect?: number;
  maxSelect?: number;
  labelEn?: string | null;
  labelMm?: string | null;
  displayOrder?: number;
};

export type UpdatePoolLinkInput = Partial<Omit<CreatePoolLinkInput, "menuItemId" | "poolId">>;

// Helper to map option records
function mapPoolOption(
  record: typeof choicePoolOptions.$inferSelect
): ChoicePoolOption {
  return {
    id: record.id,
    poolId: record.poolId,
    menuCode: record.menuCode,
    nameEn: record.nameEn,
    nameMm: record.nameMm,
    price: numericToNumber(record.price),
    isAvailable: record.isAvailable,
    displayOrder: record.displayOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapPool(record: typeof choicePools.$inferSelect): ChoicePool {
  return {
    id: record.id,
    nameEn: record.nameEn,
    nameMm: record.nameMm,
    isActive: record.isActive,
    displayOrder: record.displayOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapPoolLink(
  record: typeof setMenuPoolLinks.$inferSelect
): SetMenuPoolLink {
  return {
    id: record.id,
    menuItemId: record.menuItemId,
    poolId: record.poolId,
    isPriceDetermining: record.isPriceDetermining,
    usesOptionPrice: record.usesOptionPrice,
    flatPrice: record.flatPrice ? numericToNumber(record.flatPrice) : null,
    isRequired: record.isRequired,
    minSelect: record.minSelect,
    maxSelect: record.maxSelect,
    labelEn: record.labelEn,
    labelMm: record.labelMm,
    displayOrder: record.displayOrder,
    createdAt: record.createdAt,
  };
}

// ===== POOL CRUD =====

export async function getAllChoicePools(): Promise<ChoicePoolWithOptions[]> {
  const pools = await db
    .select()
    .from(choicePools)
    .orderBy(asc(choicePools.displayOrder), asc(choicePools.createdAt));

  if (pools.length === 0) {
    return [];
  }

  const poolIds = pools.map((p) => p.id);
  const options = await db
    .select()
    .from(choicePoolOptions)
    .where(inArray(choicePoolOptions.poolId, poolIds))
    .orderBy(
      asc(choicePoolOptions.displayOrder),
      asc(choicePoolOptions.createdAt)
    );

  const optionsByPoolId = new Map<string, ChoicePoolOption[]>();
  for (const option of options) {
    const mapped = mapPoolOption(option);
    const existing = optionsByPoolId.get(option.poolId) ?? [];
    existing.push(mapped);
    optionsByPoolId.set(option.poolId, existing);
  }

  return pools.map((pool) => ({
    ...mapPool(pool),
    options: optionsByPoolId.get(pool.id) ?? [],
  }));
}

export async function getChoicePoolById(
  poolId: string
): Promise<ChoicePoolWithOptions | null> {
  const [pool] = await db
    .select()
    .from(choicePools)
    .where(eq(choicePools.id, poolId))
    .limit(1);

  if (!pool) {
    return null;
  }

  const options = await db
    .select()
    .from(choicePoolOptions)
    .where(eq(choicePoolOptions.poolId, poolId))
    .orderBy(
      asc(choicePoolOptions.displayOrder),
      asc(choicePoolOptions.createdAt)
    );

  return {
    ...mapPool(pool),
    options: options.map(mapPoolOption),
  };
}

export async function createChoicePool(
  data: CreatePoolInput
): Promise<ChoicePool> {
  const [pool] = await db
    .insert(choicePools)
    .values({
      nameEn: data.nameEn,
      nameMm: data.nameMm ?? null,
      isActive: data.isActive ?? true,
      displayOrder: data.displayOrder ?? 0,
    })
    .returning();

  return mapPool(pool);
}

export async function updateChoicePool(
  poolId: string,
  data: UpdatePoolInput
): Promise<ChoicePool | null> {
  const updateData: Record<string, unknown> = {};

  if (data.nameEn !== undefined) updateData.nameEn = data.nameEn;
  if (data.nameMm !== undefined) updateData.nameMm = data.nameMm;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

  if (Object.keys(updateData).length === 0) {
    return getChoicePoolById(poolId).then((p) => (p ? mapPool(p as ChoicePool) : null));
  }

  const [pool] = await db
    .update(choicePools)
    .set(updateData)
    .where(eq(choicePools.id, poolId))
    .returning();

  return pool ? mapPool(pool) : null;
}

export async function deleteChoicePool(poolId: string): Promise<boolean> {
  const result = await db
    .delete(choicePools)
    .where(eq(choicePools.id, poolId))
    .returning({ id: choicePools.id });

  return result.length > 0;
}

export async function reorderPools(
  orderedIds: string[]
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(choicePools)
      .set({ displayOrder: i })
      .where(eq(choicePools.id, orderedIds[i]));
  }
}

// ===== POOL OPTION CRUD =====

export async function addPoolOption(
  poolId: string,
  data: CreatePoolOptionInput
): Promise<ChoicePoolOption> {
  const [option] = await db
    .insert(choicePoolOptions)
    .values({
      poolId,
      menuCode: data.menuCode ?? null,
      nameEn: data.nameEn,
      nameMm: data.nameMm ?? null,
      price: String(data.price ?? 0),
      isAvailable: data.isAvailable ?? true,
      displayOrder: data.displayOrder ?? 0,
    })
    .returning();

  return mapPoolOption(option);
}

export async function updatePoolOption(
  optionId: string,
  data: UpdatePoolOptionInput
): Promise<ChoicePoolOption | null> {
  const updateData: Record<string, unknown> = {};

  if (data.menuCode !== undefined) updateData.menuCode = data.menuCode;
  if (data.nameEn !== undefined) updateData.nameEn = data.nameEn;
  if (data.nameMm !== undefined) updateData.nameMm = data.nameMm;
  if (data.price !== undefined) updateData.price = String(data.price);
  if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable;
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

  if (Object.keys(updateData).length === 0) {
    const [option] = await db
      .select()
      .from(choicePoolOptions)
      .where(eq(choicePoolOptions.id, optionId))
      .limit(1);
    return option ? mapPoolOption(option) : null;
  }

  const [option] = await db
    .update(choicePoolOptions)
    .set(updateData)
    .where(eq(choicePoolOptions.id, optionId))
    .returning();

  return option ? mapPoolOption(option) : null;
}

export async function deletePoolOption(optionId: string): Promise<boolean> {
  const result = await db
    .delete(choicePoolOptions)
    .where(eq(choicePoolOptions.id, optionId))
    .returning({ id: choicePoolOptions.id });

  return result.length > 0;
}

export async function reorderPoolOptions(
  poolId: string,
  orderedIds: string[]
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(choicePoolOptions)
      .set({ displayOrder: i })
      .where(eq(choicePoolOptions.id, orderedIds[i]));
  }
}

// ===== SET MENU POOL LINKS =====

export async function getPoolLinksForMenuItem(
  menuItemId: string
): Promise<SetMenuPoolLinkWithPool[]> {
  const links = await db
    .select()
    .from(setMenuPoolLinks)
    .where(eq(setMenuPoolLinks.menuItemId, menuItemId))
    .orderBy(asc(setMenuPoolLinks.displayOrder), asc(setMenuPoolLinks.createdAt));

  if (links.length === 0) {
    return [];
  }

  const poolIds = [...new Set(links.map((l) => l.poolId))];
  const pools = await db
    .select()
    .from(choicePools)
    .where(inArray(choicePools.id, poolIds));

  const options = await db
    .select()
    .from(choicePoolOptions)
    .where(inArray(choicePoolOptions.poolId, poolIds))
    .orderBy(
      asc(choicePoolOptions.displayOrder),
      asc(choicePoolOptions.createdAt)
    );

  const optionsByPoolId = new Map<string, ChoicePoolOption[]>();
  for (const option of options) {
    const mapped = mapPoolOption(option);
    const existing = optionsByPoolId.get(option.poolId) ?? [];
    existing.push(mapped);
    optionsByPoolId.set(option.poolId, existing);
  }

  const poolsWithOptions = new Map<string, ChoicePoolWithOptions>();
  for (const pool of pools) {
    poolsWithOptions.set(pool.id, {
      ...mapPool(pool),
      options: optionsByPoolId.get(pool.id) ?? [],
    });
  }

  return links.map((link) => ({
    ...mapPoolLink(link),
    pool: poolsWithOptions.get(link.poolId)!,
  }));
}

export async function createPoolLink(
  data: CreatePoolLinkInput
): Promise<SetMenuPoolLink> {
  const [link] = await db
    .insert(setMenuPoolLinks)
    .values({
      menuItemId: data.menuItemId,
      poolId: data.poolId,
      isPriceDetermining: data.isPriceDetermining ?? false,
      usesOptionPrice: data.usesOptionPrice ?? true,
      flatPrice: data.flatPrice != null ? String(data.flatPrice) : null,
      isRequired: data.isRequired ?? true,
      minSelect: data.minSelect ?? 1,
      maxSelect: data.maxSelect ?? 99,
      labelEn: data.labelEn ?? null,
      labelMm: data.labelMm ?? null,
      displayOrder: data.displayOrder ?? 0,
    })
    .returning();

  return mapPoolLink(link);
}

export async function updatePoolLink(
  linkId: string,
  data: UpdatePoolLinkInput
): Promise<SetMenuPoolLink | null> {
  const updateData: Record<string, unknown> = {};

  if (data.isPriceDetermining !== undefined) updateData.isPriceDetermining = data.isPriceDetermining;
  if (data.usesOptionPrice !== undefined) updateData.usesOptionPrice = data.usesOptionPrice;
  if (data.flatPrice !== undefined) updateData.flatPrice = data.flatPrice != null ? String(data.flatPrice) : null;
  if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;
  if (data.minSelect !== undefined) updateData.minSelect = data.minSelect;
  if (data.maxSelect !== undefined) updateData.maxSelect = data.maxSelect;
  if (data.labelEn !== undefined) updateData.labelEn = data.labelEn;
  if (data.labelMm !== undefined) updateData.labelMm = data.labelMm;
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

  if (Object.keys(updateData).length === 0) {
    const [link] = await db
      .select()
      .from(setMenuPoolLinks)
      .where(eq(setMenuPoolLinks.id, linkId))
      .limit(1);
    return link ? mapPoolLink(link) : null;
  }

  const [link] = await db
    .update(setMenuPoolLinks)
    .set(updateData)
    .where(eq(setMenuPoolLinks.id, linkId))
    .returning();

  return link ? mapPoolLink(link) : null;
}

export async function deletePoolLink(linkId: string): Promise<boolean> {
  const result = await db
    .delete(setMenuPoolLinks)
    .where(eq(setMenuPoolLinks.id, linkId))
    .returning({ id: setMenuPoolLinks.id });

  return result.length > 0;
}

export async function deleteAllPoolLinksForMenuItem(
  menuItemId: string
): Promise<void> {
  await db
    .delete(setMenuPoolLinks)
    .where(eq(setMenuPoolLinks.menuItemId, menuItemId));
}

export async function syncPoolLinksForMenuItem(
  menuItemId: string,
  links: CreatePoolLinkInput[]
): Promise<SetMenuPoolLink[]> {
  return dbTx.transaction(async (tx) => {
    // Delete existing links inside the transaction
    await tx
      .delete(setMenuPoolLinks)
      .where(eq(setMenuPoolLinks.menuItemId, menuItemId));

    if (links.length === 0) {
      return [] as SetMenuPoolLink[];
    }

    // Insert new links
    const insertedLinks = await tx
      .insert(setMenuPoolLinks)
      .values(
        links.map((link, index) => ({
          menuItemId,
          poolId: link.poolId,
          isPriceDetermining: link.isPriceDetermining ?? false,
          usesOptionPrice: link.usesOptionPrice ?? true,
          flatPrice: link.flatPrice != null ? String(link.flatPrice) : null,
          isRequired: link.isRequired ?? true,
          minSelect: link.minSelect ?? 1,
          maxSelect: link.maxSelect ?? 99,
          labelEn: link.labelEn ?? null,
          labelMm: link.labelMm ?? null,
          displayOrder: link.displayOrder ?? index,
        }))
      )
      .returning();

    return insertedLinks.map(mapPoolLink);
  });
}

// ===== UTILITY FUNCTIONS =====

export async function getMinimumPriceForSetMenu(
  menuItemId: string
): Promise<number | null> {
  const links = await db
    .select()
    .from(setMenuPoolLinks)
    .where(eq(setMenuPoolLinks.menuItemId, menuItemId));

  const priceDeterminingLink = links.find((l) => l.isPriceDetermining);
  if (!priceDeterminingLink) {
    return null;
  }

  const options = await db
    .select()
    .from(choicePoolOptions)
    .where(eq(choicePoolOptions.poolId, priceDeterminingLink.poolId));

  if (options.length === 0) {
    return null;
  }

  const prices = options
    .filter((o) => o.isAvailable)
    .map((o) => numericToNumber(o.price));

  return prices.length > 0 ? Math.min(...prices) : null;
}
