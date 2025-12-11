# User Account Management – Implementation Plan (Better Auth + Brevo)

## Goals

- Add robust user account management on top of the existing Better Auth setup:
  - Password reset flow for email/password users.
  - Ability for OAuth-only users to set a password.
  - Safe account deletion with proper verification and cleanup.
  - Option to change email and password from within the profile.
- Use Brevo as the transactional email provider for auth-related mail.

## Env & Integration Setup

### Brevo Environment Variables

Server-side env vars (no client exposure):

- `BREVO_API_KEY` – Brevo transactional API key.
- `BREVO_SENDER_EMAIL` – From address for auth emails (e.g. `no-reply@feel-abac.com`).
- `BREVO_SENDER_NAME` – From name (e.g. `Feel ABAC`).

Optional:

- `BREVO_BASE_URL` – Override for Brevo API base URL if needed (default to `https://api.brevo.com/v3` if unset).

### Email Helper

- Add `lib/email/brevo.ts`:
  - Minimal HTTP client using `fetch` to call Brevo’s `/smtp/email` (or equivalent) endpoint.
  - Export a small API:
    - `sendTransactionalEmail({ to, subject, text, html })`.
  - Centralize sender defaults using the env vars above.
  - Ensure failures are logged but do not block auth responses (fire-and-forget pattern).

### Better Auth Email Hooks

- Update `lib/auth.ts` to wire Brevo into Better Auth callbacks where needed:
  - For email verification and change-email flows (if/when enabled).
  - For delete-account verification emails (see Delete User section).
  - We will keep password reset as a custom flow (below) to control URLs and UX.

## Password Reset Flow

### High-Level UX

- From the sign-in view, users can click “Forgot password?” to:
  - Land on a localized `/[lang]/auth/forgot-password` page with a single email input.
  - After submitting, they see a generic “Check your email for a reset link” message (regardless of whether the email exists).
- The email contains a single-use, time-limited URL:
  - `https://<host>/<lang>/auth/reset-password/<token>`
- The reset page `/[lang]/auth/reset-password/[token]`:
  - Verifies token validity on submit (and optionally on first load).
  - Lets users enter `newPassword` + `confirmPassword`.
  - On success, shows confirmation and provides a path back to sign-in.

### Data & Token Strategy

- Use Better Auth’s `verifications` table (already present via Drizzle adapter) to store password-reset tokens:
  - `identifier`: user email (or auth user id).
  - `value`: hashed token value.
  - `expiresAt`: 30–60 minutes from creation.
  - Add a convention for `type` in `metadata` or encode type in `identifier` (e.g. `password_reset:email@example.com`) so reset tokens are distinguishable from other verifications.
- Tokens are:
  - Single-use – delete after successful reset or on failure that should invalidate it.
  - Time-limited – reject if `expiresAt` is in the past.

### API Routes

#### 1. Request Password Reset

- `POST /api/auth/forgot-password`
  - Payload: `{ email: string }`.
  - Steps:
    1. Normalize and validate email shape with `emailSchema` (reuse `lib/validations.ts`).
    2. Lookup user + credential account (email/password) using Better Auth/Drizzle:
       - If user doesn’t exist or only has OAuth accounts, do nothing visible (return generic success).
    3. Generate a secure random token (e.g. 32+ bytes, hex/base64).
    4. Hash token and store in `verifications` with:
       - Identifier (email or user id, plus type tag).
       - Hashed token value.
       - `expiresAt` (e.g. now + 45 minutes).
    5. Build reset URL including `lang` and raw token.
    6. Call `sendTransactionalEmail` with:
       - Subject: “Reset your Feel ABAC password”.
       - Body: short explanation + reset link.
    7. Return 200 with generic message.
  - Security:
    - Never reveal whether the email exists.
    - Rate-limit by IP/email pair (future enhancement; for now, document the need).

#### 2. Perform Password Reset

- `POST /api/auth/reset-password`
  - Payload: `{ token: string; newPassword: string; confirmPassword: string }`.
  - Steps:
    1. Validate `newPassword`/`confirmPassword` with a dedicated Zod schema (reuse `passwordSchema` and equality refinement).
    2. Look up token record in `verifications` by a hashed version of the provided token and the correct type.
    3. If not found or expired, return 400/401 with a generic “Link is invalid or expired” message.
    4. Resolve user from `identifier`.
    5. Call `auth.api.setPassword` or the equivalent Better Auth API on the server:
       - `await auth.api.setPassword({ body: { newPassword }, headers })` – headers must carry a session; for reset we instead:
         - Use a dedicated server-only internal path (Better Auth supports password update via API with appropriate context).
         - If needed, use a dedicated internal adapter hook to set password by user id.
    6. Optionally revoke other sessions (e.g. via Better Auth `changePassword` semantics).
    7. Delete the verification token row.
    8. Return success.

### Pages & UI

#### 1. Forgot Password Page

- `app/[lang]/auth/forgot-password/page.tsx`
  - Server component using `getDictionary` for copy.
  - Renders a client form:
    - Input: `email`.
    - Button: “Send reset link”.
  - Client component handles:
    - Local Zod validation via `emailSchema`.
    - POST to `/api/auth/forgot-password`.
    - Sonner toasts for success/error, but always end in a neutral “Check your email” message.

#### 2. Reset Password Page

- `app/[lang]/auth/reset-password/[token]/page.tsx`
  - Server component receives `token` from route params.
  - Renders a client form:
    - Inputs: `newPassword`, `confirmPassword`.
    - Button: “Set new password”.
  - Client component:
    - Validates via new `passwordResetSchema`.
    - Calls `/api/auth/reset-password`.
    - On success: toast + redirect to `/${lang}/menu` or open login modal.
    - On error: inline error + toast; if token clearly invalid, offer link back to forgot-password.

#### 3. Login Modal Integration

- `components/auth/login-modal.tsx`:
  - Add “Forgot password?” link under password field in the sign-in view.
  - Link to `withLocalePath(locale, "/auth/forgot-password")` or switch to a dedicated local modal view.

## Change Password (While Logged In)

### API Route

- `POST /api/user/change-password`
  - Requires authenticated session: use `auth.api.getSession({ headers })`.
  - Payload: `{ currentPassword: string; newPassword: string; confirmPassword: string }`.
  - Steps:
    1. Validate payload with `changePasswordSchema` (wrap Better Auth’s `changePassword` signature).
    2. Call `auth.api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: true }, headers })`.
    3. Map Better Auth errors to friendly messages (wrong password, same password, etc.).
    4. Return 200 on success.

### UI

- Extend `ProfileClient` or add a dedicated “Security” section:
  - “Change password” section with current + new + confirm password fields.
  - Uses a client component with form POST to `/api/user/change-password`.
  - Toasts for success/failure, with clear copy.

## Set Password for OAuth Users

### API Route

- `POST /api/user/set-password`
  - Requires authenticated session.
  - Payload: `{ newPassword: string; confirmPassword: string }`.
  - Steps:
    1. Validate with `passwordSetSchema`.
    2. Ensure the current user does **not** already have a credential account with a password (skip or error if they do).
    3. Call `auth.api.setPassword({ body: { newPassword }, headers })`.
    4. Return success.

### UI

- On Profile “Account” section:
  - If user has no password (OAuth-only), show a call-to-action card “Add a password to your account”.
  - Form uses the `set-password` endpoint.

## Email Change (Optional but Recommended)

### Better Auth Config

- In `lib/auth.ts`:
  - Enable and configure:
    ```ts
    export const auth = betterAuth({
      // ...
      user: {
        changeEmail: {
          enabled: true,
          sendChangeEmailConfirmation: async ({ user, newEmail, url, token }) => {
            // Optionally send confirmation to CURRENT email before updating
            void sendTransactionalEmail({
              to: user.email,
              subject: "Confirm email change",
              text: `Click to approve changing your email to ${newEmail}: ${url}`,
            });
          },
        },
      },
      emailVerification: {
        sendVerificationEmail: async ({ user, url, token }) => {
          void sendTransactionalEmail({
            to: user.email,
            subject: "Verify your email",
            text: `Click to verify your email: ${url}`,
          });
        },
      },
    });
    ```

### UI

- Profile “Account” card:
  - Add “Change email” option.
  - Use `authClient.changeEmail({ newEmail, callbackURL })` from the client.
  - Show appropriate toasts and copy explaining verification steps.

## Account Deletion

### Better Auth Configuration

- In `lib/auth.ts` enable deletion and email verification for deletion:
  ```ts
  export const auth = betterAuth({
    // ...existing config
    user: {
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: async ({ user, url, token }, request) => {
          // URL deletes account once accessed, or you can construct a custom URL using token.
          void sendTransactionalEmail({
            to: user.email,
            subject: "Confirm deletion of your Feel ABAC account",
            text: `If you requested this, click here to delete your account: ${url}`,
          });
        },
        beforeDelete: async (user, request) => {
          // Prevent accidental admin deletions, for example:
          // - Look up matching record in `admins` table and block if found.
        },
        afterDelete: async (user, request) => {
          // Optional: log audit event, clean up any external integrations.
        },
      },
    },
  });
  ```

### Deletion Flows

#### 1. Standard Deletion (Password Users)

- Client calls `authClient.deleteUser`:
  - With `password: "..."` when user has a password, or
  - With no arguments when a fresh session is required and acceptable.
  - Optionally with `callbackURL: "/goodbye"` to redirect post-deletion.
- Better Auth will:
  - Validate password or session freshness.
  - Delete the user and cascade via configured `onDelete` behaviors.
  - Redirect to callback URL.

#### 2. Email-Verified Deletion (OAuth-only or Safe Deletion)

- Triggered either directly via `authClient.deleteUser()` or via a “Send delete link” button in the UI:
  - `deleteUser` sends an email using `sendDeleteAccountVerification`.
  - Email includes a link that calls back into Better Auth’s deletion handler.
  - After deletion, redirect to a `/[lang]/goodbye` or landing page.

#### 3. Custom Delete Page with Token

- Alternate flow:
  - Use `sendDeleteAccountVerification` to send a link to a custom route with `token` param (e.g. `/[lang]/auth/delete-account?token=...`).
  - On that page, call:
    ```ts
    await authClient.deleteUser({ token });
    ```
  - Show a “We’re sorry to see you go” screen and link back to landing.

### Profile UI – Danger Zone

- Extend `ProfileClient`:
  - Add a “Danger zone” card under `sections.actions`:
    - “Delete account” button.
    - Copy explaining:
      - Orders will remain but won’t be linked to your profile.
      - This action is permanent.
  - When clicked:
    - Show a confirmation dialog/modal.
    - For password accounts:
      - Ask for current password and maybe an additional confirmation string.
      - Call `authClient.deleteUser({ password })`.
    - For OAuth-only accounts:
      - Trigger `authClient.deleteUser()` and rely on email verification if configured.
  - After successful deletion:
    - User is redirected to landing and sees a friendly “Your account has been deleted” message.

### Data Model Considerations

- Existing schema already supports safe deletion:
  - `orders.userId` is `onDelete: "set null"`, so historical orders remain.
  - `sessions`, `accounts`, `userProfiles`, `carts`, etc. are configured to cascade or null out.
- `beforeDelete` can be used to:
  - Block deletion of active `admins`.
  - Require manual cleanup of any external integrations first if needed.

## Signup Flow Hardening

### Confirm Password on Sign-Up

- Update `lib/validations.ts`:
  - Extend `signUpSchema`:
    - Add `confirmPassword: passwordSchema`.
    - Add `.refine` to ensure `password === confirmPassword` with an error message attached to `confirmPassword`.
- Update `components/auth/login-modal.tsx`:
  - In the sign-up view, add a “Confirm password” field wired to `confirmPassword`.
  - Show inline validation errors using existing pattern.
- API:
  - `app/api/sign-up/route.ts`:
    - Accept `confirmPassword` in the parsed body but ignore it when calling `auth.api.signUpEmail`.

### Optional Password Strength

- Future enhancement:
  - Extend `passwordSchema` to enforce stronger passwords (mixture of character types).
  - Add inline “password strength” hints in the sign-up and reset forms.

## Phasing & Rollout Checklist

### Phase 1 – Infrastructure

- [ ] Add Brevo email helper and env vars.
- [ ] Wire Better Auth email callbacks to use Brevo (verification, delete).

### Phase 2 – Password Reset

- [ ] Implement `/api/auth/forgot-password` and `/api/auth/reset-password` routes.
- [ ] Add forgot/reset pages and client components under `app/[lang]/auth`.
- [ ] Integrate “Forgot password?” link in `LoginModal`.

### Phase 3 – Profile Security Controls

- [ ] Implement change password API + UI.
- [ ] Implement set password API + UI for OAuth-only accounts.
- [ ] Optionally implement change email via Better Auth’s `changeEmail` API.

### Phase 4 – Account Deletion

- [ ] Enable `user.deleteUser` in Better Auth config with Brevo-based email verification.
- [ ] Implement `beforeDelete` guard for admins.
- [ ] Add profile “Danger zone” UI for deletion, using `authClient.deleteUser`.
- [ ] Optionally add custom goodbye page for post-deletion redirect.

### Phase 5 – Polish & Observability

- [ ] Add logging around password reset and deletion flows (redacted of sensitive data).
- [ ] Add rate limiting and abuse protections to forgot-password and delete-user triggers.
- [ ] QA flows across both email/password and Google OAuth accounts.

