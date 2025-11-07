# AGENTS Guide

## High-Level Structure
- `app/` – App Router entry point with locale segment `[lang]`. Admin surfaces live under `app/[lang]/admin`, diner-facing flows under `app/[lang]/menu`, public landing in `app/[lang]/page.tsx`, and onboarding in `app/[lang]/onboarding`.
- `components/` – Feature components. Admin builder pieces sit in `components/admin/menu`, diner browsers (desktop + mobile) and the new detail UI live in `components/menu`. Shared UI primitives and i18n toggles are colocated here as well.
- `lib/` – Cross-cutting helpers: menu queries (`lib/menu/queries.ts`), data validators, storage helpers, session and auth utilities, and locale plumbing (`lib/i18n/*`).
- `src/db/schema.ts` – Drizzle table definitions; SQL migrations in `drizzle/`. Static assets (including `public/menu-placeholders/`) sit under `public/`. Copy dictionaries live in `dictionaries/`.

## Key App Routes
- `app/[lang]/layout.tsx` and `app/[lang]/page.tsx` – bootstrap locale-aware landing plus shared shells (admin bar, language controls).
- `app/[lang]/menu/page.tsx` – Authenticated diner browser that renders `ResponsiveMenuBrowser`, language toggle, and phone-edit modal once a user finishes onboarding.
- `app/[lang]/menu/items/[itemId]/page.tsx` – **New detail page**. Fetches a single item via `getPublicMenuItemById`, keeps locale-aware copy via `getDictionary`, and renders `MenuItemDetail` with category context and sticky totals.
- `app/[lang]/admin/menu/page.tsx` & `app/[lang]/admin/dashboard/page.tsx` – Primary admin workspace for managing menu hierarchy and analytics.
- `app/[lang]/onboarding/page.tsx` – Phone verification and restaurant setup flow guarding menu access.

## Important API Routes
- Diner menu feed: `app/api/menu/route.ts`.
- Admin CRUD: `app/api/admin/menu/{categories,items,choice-groups,choice-options}/route.ts` plus `/tree` for nested builders and `/images` for uploads.
- User/account endpoints: `app/api/admin/{add,remove}`, `app/api/admin/list`, `app/api/user/phone`, and `app/api/auth/[...all]`.

## Feature Highlights
- Public menu cards and list rows now deep-link into the detail page (`components/menu/menu-browser.tsx`, `components/menu/mobile/mobile-menu-browser.tsx`), letting diners tap/click to review descriptions, choices, and pricing.
- `MenuItemDetail` (`components/menu/menu-item-detail.tsx`) handles localized copy, optional notes, choice group validation (single vs multi-select), and live total computation across desktop/mobile layouts.
- `ResponsiveMenuBrowser` switches between desktop (`MenuBrowser`) and the touch-optimized `MobileMenuBrowser`, both honoring the `MenuLanguageToggle` and search/filter UX.
- Admin builder, onboarding, and menu experiences share locale + session providers via `components/i18n/menu-locale-provider` and `lib/session`.

## Build, Test, and Development Commands
- `npm run dev` – Launch the Next.js dev server (Turbopack).
- `npm run lint` – Run ESLint with the project rules.
- `npm run build` – Create the production bundle.
- `npm run start` – Serve the production bundle.
- `npx drizzle-kit push` – Apply pending migrations against `DATABASE_URL`.

## Coding Style & Naming Conventions
- TypeScript everywhere with 2-space indentation. camelCase functions/variables, PascalCase React components, kebab-case feature folders.
- Keep admin copy conversational (“Choices section”, “Add menu item”). All remote images must go through `next/image` and have hosts whitelisted in `next.config.ts`.

## Testing Guidelines
- Automated suites are not wired up yet—run `npm run lint` and manually validate key flows.
- After schema/migration tweaks, run `npx drizzle-kit push`, restart `npm run dev`, and manually confirm draft autosave, choice CRUD, image uploads, menu browsing, and the new detail view.
- Add future automated tests under `tests/`, mirroring feature directories (Jest/Playwright ready).

## Commit & Pull Request Guidelines
- Use concise, conventional commits (`feat:`, `fix:`, `chore:`) in present tense.
- PRs should summarize the change, list verification steps (`npm run lint`, migrations applied), attach screenshots/GIFs for UI updates, and link the tracking ticket. Rebase before opening and prefer squash merges unless told otherwise.

## Agent-Specific Notes
- Trim and validate IDs before invoking Drizzle helpers to avoid “not found” errors.
- When touching menu flows, keep admin builder (`components/admin/menu`) and public browser (`components/menu`) in sync so experiences match.
- Provide fallbacks for any new image surfaces to keep `next/image` happy when assets are missing or hosts unapproved.
- Respect the active `[lang]` segment—route via `withLocalePath` and hydrate UI copy through `getDictionary` so English/Burmese stay aligned.
- Always expose the menu-language toggle around menu data; persist updates through the `menuLocale` cookie/provider.
