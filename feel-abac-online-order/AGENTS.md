# Repository Guidelines

## Project Structure & Module Organization
- App Router code resides in `app/`. Admin flows are under `app/admin`, diner-facing experiences in `app/menu`, and API handlers in `app/api`.
- Feature components live in `components/` (e.g., `components/admin/menu` for the builder, `components/menu` for the customer browser). Shared helpers and hooks live in `lib/`.
- Database access is powered by Drizzle. Table definitions sit in `src/db/schema.ts`, while query helpers are in `lib/menu/queries.ts`. SQL migrations belong in `drizzle/`.
- Static assets are stored in `public/`; menu fallback images already exist at `public/menu-placeholders/`.

## Build, Test, and Development Commands
- `npm run dev` – launch the local Next.js development server (Turbopack).
- `npm run lint` – execute ESLint with the project configuration.
- `npm run build` – produce an optimized production bundle.
- `npm run start` – serve the production bundle locally.
- `npx drizzle-kit push` – apply pending schema migrations against the database defined by `DATABASE_URL`.

## Coding Style & Naming Conventions
- Use TypeScript with 2-space indentation. Favor camelCase for variables/functions, PascalCase for React components, and kebab-case for feature folders.
- Keep admin copy human friendly (e.g., “Choices section”, “Add menu item”) instead of schema jargon.
- All remote imagery should flow through `next/image`; whitelist additional hosts in `next.config.ts` before shipping.

## Testing Guidelines
- Automated tests are not yet wired up—run `npm run lint` and perform manual verification for key flows.
- After altering schema or migrations, run `npx drizzle-kit push`, restart `npm run dev`, and manually validate draft autosave, option CRUD, image uploads, and public menu rendering.
- Add new automated suites under `tests/`, mirroring feature directories, if you introduce Jest or Playwright.

## Commit & Pull Request Guidelines
- Follow concise, conventional commit messages (`feat:`, `fix:`, `chore:`) written in present tense (“add autosave prompt”).
- Pull requests should summarize the change, list manual verification steps (e.g., `npm run lint`, migration applied), include screenshots/GIFs for UI updates, and link to relevant tickets.
- Rebase before opening a PR and prefer squash merges unless release engineering requests a different strategy.

## Agent-Specific Notes
- Trim and validate IDs before passing them to Drizzle to avoid “not found” responses.
- When updating menu flows, touch both the admin builder (`components/admin/menu`) and public browser (`components/menu`) so experiences stay aligned.
- Supply fallback assets or copy when introducing new card layouts to keep `next/image` free of warnings about missing images or hosts.
- Honour the active `[lang]` segment; use `withLocalePath` and hydrate UI copy through `getDictionary` so English/Burmese content stays in sync.
- Expose the menu-language toggle (English/Burmese dish names) whenever showing menu data; persist updates via the `menuLocale` cookie and provider.
