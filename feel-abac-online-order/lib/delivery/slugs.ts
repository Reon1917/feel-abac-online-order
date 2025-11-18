import { db } from "@/src/db/client";
import { deliveryLocations } from "@/src/db/schema";
import { eq } from "drizzle-orm";

const MAX_SLUG_ATTEMPTS = 10;

export class SlugGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlugGenerationError";
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export async function generateUniqueDeliverySlug(name: string) {
  const base = slugify(name);
  if (!base) {
    throw new SlugGenerationError("Unable to derive slug from condo name");
  }

  let attempt = base;
  let counter = 1;

  for (let i = 0; i < MAX_SLUG_ATTEMPTS; i++) {
    const [existing] = await db
      .select({ id: deliveryLocations.id })
      .from(deliveryLocations)
      .where(eq(deliveryLocations.slug, attempt))
      .limit(1);

    if (!existing) {
      return attempt;
    }

    attempt = `${base}-${counter}`;
    counter += 1;
  }

  throw new SlugGenerationError(
    `Unable to generate unique slug after ${MAX_SLUG_ATTEMPTS} attempts. Too many similar condo names exist.`
  );
}
