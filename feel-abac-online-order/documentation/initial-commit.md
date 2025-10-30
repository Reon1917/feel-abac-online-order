# Feel ABAC – Initial Auth & Onboarding Flow

## ✅ Implemented Flow
1. Landing page introduces the online ordering experience and gates entry with a `Log in / Sign up` modal.
2. Email/password authentication handled via custom API routes (`/api/sign-in`, `/api/sign-up`, `/api/sign-out`) backed by Better Auth + Drizzle (Neon).
3. First-time users are redirected to `/onboarding` to capture a contact phone number stored in `user_profiles`.
4. Returning users skip onboarding and reach `/menu`, which displays a sample menu and basic account info.

## 🔧 Key Technical Decisions
- Better Auth configured with the Drizzle adapter (`lib/auth.ts`) and Neon HTTP driver; schema tables provided through the adapter to align with pluralised table names.
- Session context forwarded through `proxy.ts`, embedding user + onboarding state in a custom header (`x-feel-session`) consumed by server components/actions.
- Lightweight client modal (`components/auth/login-modal.tsx`) posts to the new API routes instead of using SDK components, keeping forms simple.
- Onboarding form uses a server action (`app/onboarding/actions.ts`) to validate phone numbers with Zod and upsert into `user_profiles`.

## 📂 New / Notable Files
- `app/page.tsx` – refreshed landing page with modal trigger.
- `components/auth/login-modal.tsx` – client modal toggling between sign-in and sign-up.
- `app/api/sign-in|sign-up|sign-out/route.ts` – thin auth API wrappers around Better Auth endpoints.
- `app/onboarding/page.tsx` & `app/menu/page.tsx` – protected routes leveraging the forwarded session header.
- `lib/session.ts`, `lib/user-profile.ts` – helpers to read session data and user profiles on the server.
- `proxy.ts` – enforces auth/onboarding redirects and injects session context into downstream handlers.

## 🚀 Next Steps
- Flesh out the actual menu data and ordering workflow.
- Add profile editing to modify phone numbers after onboarding.
- Introduce admin dashboards and delivery logic once core ordering is solid.
