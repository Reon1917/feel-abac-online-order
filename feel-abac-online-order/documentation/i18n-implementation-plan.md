# Internationalization Rollout Plan (Static JSON Routing)

This approach keeps bilingual English ⇄ Burmese support lightweight by relying on static JSON and predictable routing. It’s optimized for just two locales while remaining easy to extend.

## Goals
- Deliver English-first content with Burmese translations layered in as they’re ready.
- Keep runtime overhead minimal: no dynamic imports or translation libraries.
- Maintain prominent language toggles on landing, menu, and admin screens, accounting for Burmese text length.
- Ensure the structure can grow as new pages or (if needed later) locales arrive.

## Architecture Overview
- **Primary locale routing:** Nest routes under `app/[lang]/…` so each page gets a UI locale param (`lang`). Only `en` and `my` are recognized; other paths redirect to `/en/...`.
- **Static dictionaries:** Store JSON per surface in `dictionaries/<locale>/<surface>.json`. Import them statically and expose a synchronous registry.
- **Locale negotiation:** Determine the UI locale once in `proxy.ts` using `Accept-Language` and a `locale` cookie override. Redirect bare paths to `/${locale}/…`.
- **Dual language switches:** Provide two related controls:
  - **UI language switcher** (global) that swaps `[lang]` in the route and updates dictionaries.
  - **Menu content switcher** (local to menu experiences) that can request English or Burmese menu data regardless of UI language. Persist this preference (cookie/store) so we can serve mixed combinations like English UI + Burmese menu names.
- **Layout flexibility:** Shared typography utilities ensure Burmese strings wrap or grow vertically when needed.

## Detailed Implementation
1. **Config primitives**
   - Create `lib/i18n/config.ts` with:
     ```ts
     export const SUPPORTED_LOCALES = ['en', 'my'] as const;
     export type Locale = (typeof SUPPORTED_LOCALES)[number];
     export const DEFAULT_LOCALE: Locale = 'en';
     export const LOCALE_COOKIE_NAME = 'locale';
     ```

2. **Directory layout**
   - Move current routes into `app/[lang]/`. For example:
     ```
     app/[lang]/page.tsx          // landing
     app/[lang]/menu/page.tsx
     app/[lang]/admin/layout.tsx
     app/[lang]/admin/dashboard/page.tsx
     app/[lang]/onboarding/page.tsx
     ```
   - Update the global `app/layout.tsx` to read the negotiated locale from headers and set `<html lang>`.

3. **Proxy redirect logic**
   - In `proxy.ts`:
     - Parse pathname; if it lacks a supported locale prefix, redirect to `/${bestLocale}${pathname}`.
     - Determine `bestLocale` as `localeCookie ?? Accept-Language ?? DEFAULT_LOCALE`.
     - Persist the selected locale in a cookie (`locale=en|my`).

4. **Static dictionary registry**
   - Create JSON files per surface:
     ```
     dictionaries/
       en/
         landing.json
         menu.json
         admin-dashboard.json
         admin-menu.json
       my/
         landing.json
         menu.json
         admin-dashboard.json
         admin-menu.json
     ```
   - Build `lib/i18n/dictionaries.ts`:
     ```ts
     import landingEn from '@/dictionaries/en/landing.json';
     import landingMy from '@/dictionaries/my/landing.json';
     // import other surfaces...

     export const DICTIONARIES = {
       en: {
         landing: landingEn,
         menu: menuEn,
         adminDashboard: adminDashboardEn,
         adminMenu: adminMenuEn,
       },
       my: {
         landing: landingMy,
         menu: menuMy,
         adminDashboard: adminDashboardMy,
         adminMenu: adminMenuMy,
       },
     } as const;

     export type Surface = keyof typeof DICTIONARIES.en;

     export function getDictionary(locale: Locale, surface: Surface) {
       return DICTIONARIES[locale][surface];
     }
     ```
   - Because imports are static, everything is tree-shakable and runs synchronously.

5. **Page integration**
   - Server components fetch the dictionary up front:
     ```ts
     const dict = getDictionary(lang, 'landing');
     ```
   - Pass localized strings into client components via props or a context provider.
   - Admin layout can load a shared `'admin-common'` dictionary to reuse button labels across pages.
   - Menu pages additionally read the **menu content locale** (from cookie/store). When requesting menu data or rendering admin editors, use that locale to decide whether to show `nameEn` or `nameMm`. Provide graceful fallbacks if one language is missing for a menu item.

6. **Language switchers**
   - **UI switcher (`components/i18n/ui-language-switcher.tsx`):**
     - Determine the alternate locale (`en ↔ my`).
     - Update `document.cookie` (`locale=`) and perform `router.replace(swapLocale(pathname, nextLocale))`.
     - Provide accessible labels and ensure buttons support multi-line Burmese text.
     - Embed in landing/menu headers and admin workspace shell.
   - **Menu content switcher (`components/i18n/menu-language-toggle.tsx`):**
     - Controls which menu fields are displayed/queried (`nameEn` vs `nameMm`).
     - Stores preference in a separate cookie (e.g., `menuLocale`) or Zustand store.
     - In admin builder, toggles preview language without affecting UI copy so staff can edit both easily.

7. **Styling considerations**
   - Create a small helper (hook or utility) that returns the active locale so components can adjust line-height/font-size.
   - Ensure key components (hero headings, CTA buttons, admin table headers) allow wrapping and have responsive padding.

8. **Content workflow**
   - Fill English JSON fully.
   - Duplicate English text into Burmese files until translations are ready (prevents missing-key crashes).
   - Add a script (e.g., `npm run check:i18n`) that compares keys across `en` and `my` JSON to catch gaps before commit.
   - For menu data, ensure API responses include both `nameEn`/`nameMm` and downstream components select the correct one based on the menu toggle.

9. **Testing**
   - Automated: smoke test redirects (`/menu` → `/en/menu`), switcher cookie behavior, and dictionary rendering.
   - Manual: verify Burmese layout at common breakpoints.

## Scaling Later
- For new surfaces: add JSON files in both locales, import them in the registry, and fetch them in the corresponding page.
- For additional locales (if ever needed): extend `SUPPORTED_LOCALES`, add new JSON folders, and expand the registry. The static pattern still works; the only cost is build-time bundle size.

## Rollout Sequence
1. Implement routing/proxy changes and move pages under `[lang]`.
2. Introduce dictionary registry and migrate landing/menu copy.
3. Add language switcher + cookie persistence.
4. Localize admin screens.
5. Wire up the validation script and populate Burmese translations.

With this plan we retain clear separation of content, keep runtime logic minimal, and maintain flexibility for future pages while focusing on the English/Burmese experience today.

## Open TODOs
- Provide proper Myanmar translations for `dictionaries/my/order.json` (some strings still mirror English). Until done, ensure runtime falls back cleanly to `en` for any missing keys.
- Localize `dictionaries/my/admin-promptpay.json` to align with the PromptPay admin UI before enabling Burmese copy on those screens.
