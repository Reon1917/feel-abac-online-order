# User Account Management – Implementation Plan (Better Auth + Brevo)

## Goals

- Add robust user account management on top of the existing Better Auth setup:
  - Password reset flow for email/password users.
  - Ability for OAuth-only users to set a password.
  - Safe account deletion with proper verification and cleanup.
  - Option to change email and password from within the profile.
- Use Brevo as the transactional email provider for auth-related mail.
- **Enable account linking** so users can sign in with both OAuth and email/password for the same account.

---

## Critical: Account Linking Configuration

**Problem:** Currently, if a user signs up with Google OAuth and later tries to sign in with email/password (or vice versa) using the same email, Better Auth will either reject the login or create a duplicate user. This is because account linking is NOT enabled.

**Solution:** Update `lib/auth.ts` to enable account linking:

```ts
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Reset your Feel ABAC password",
        text: `Click the link to reset your password: ${url}`,
        html: `<p>Click <a href="${url}">here</a> to reset your password. This link expires in 1 hour.</p>`,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      // When a user with existing email/password signs in with Google (same email),
      // automatically link the accounts. Google is trusted because it verifies emails.
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, newEmail, url, token }) => {
        await sendTransactionalEmail({
          to: newEmail,
          subject: "Verify your new email address",
          text: `Click the link to verify your new email: ${url}`,
          html: `<p>Click <a href="${url}">here</a> to verify your new email address.</p>`,
        });
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }) => {
        await sendTransactionalEmail({
          to: user.email,
          subject: "Confirm deletion of your Feel ABAC account",
          text: `If you requested this, click here to delete your account: ${url}`,
          html: `<p>If you requested this, click <a href="${url}">here</a> to permanently delete your account.</p>`,
        });
      },
      beforeDelete: async (user, request) => {
        // Block deletion if user is an admin
        const admin = await db.query.admins.findFirst({
          where: (admins, { eq }) => eq(admins.userId, user.id),
        });
        if (admin) {
          throw new Error("Cannot delete admin accounts through this flow");
        }
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET as string,
});
```

### How Account Linking Works

| Scenario | What Happens |
|----------|--------------|
| User signs up with email/password, later signs in with Google (same email) | Google account is linked to existing user. User can now sign in with either method. |
| User signs up with Google, later wants to add email/password | User calls `setPassword` to add credential account to existing user. |
| User tries to sign up with email when Google account exists | With linking enabled, credential account is added to existing user (if email verified). |

**Important:** `trustedProviders: ["google"]` means Google sign-ins will auto-link even if Google doesn't explicitly confirm email verification status. This is safe because Google always verifies emails before account creation.

---

## Env & Integration Setup

### Brevo Environment Variables

Server-side env vars (no client exposure):

- `BREVO_API_KEY` – Brevo transactional API key.
- `BREVO_SENDER_EMAIL` – From address for auth emails (e.g. `no-reply@feel-abac.com`).
- `BREVO_SENDER_NAME` – From name (e.g. `Feel ABAC`).

### Email Helper

Add `lib/email/brevo.ts`:

```ts
interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendTransactionalEmail({ to, subject, text, html }: SendEmailParams) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME;

  if (!apiKey || !senderEmail) {
    console.error("[Brevo] Missing BREVO_API_KEY or BREVO_SENDER_EMAIL");
    return;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName || "Feel ABAC", email: senderEmail },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html || text,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Brevo] Failed to send email:", err);
    }
  } catch (error) {
    console.error("[Brevo] Error sending email:", error);
  }
}
```

- Fire-and-forget pattern: failures logged but don't block auth responses.
- Called from Better Auth hooks configured above.

---

## Password Reset Flow (Built-in Better Auth)

### Why Not Custom Routes?

Better Auth has **built-in** password reset via:
- `sendResetPassword` hook (server config) – sends the email
- `authClient.requestPasswordReset({ email })` – client initiates
- `authClient.resetPassword({ token, newPassword })` – client completes

**Do NOT create custom `/api/auth/forgot-password` or `/api/auth/reset-password` routes.** Use the built-in flow.

### Server Configuration

Already shown above in `emailAndPassword.sendResetPassword`. Better Auth will:
1. Generate a secure token
2. Store it in `verifications` table with expiry
3. Call your `sendResetPassword` function with the URL containing the token
4. Handle token validation and password update via `resetPassword`

### Client Flow

#### 1. Forgot Password Page

`app/[lang]/auth/forgot-password/page.tsx`:

```tsx
"use client";

import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/auth/reset-password", // Better Auth appends ?token=xxx
    });

    // Always show success to prevent email enumeration
    setSubmitted(true);
    toast.success("If an account exists, you'll receive a reset link");
  };

  if (submitted) {
    return <div>Check your email for a reset link.</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        required 
      />
      <button type="submit">Send reset link</button>
    </form>
  );
}
```

#### 2. Reset Password Page

`app/[lang]/auth/reset-password/page.tsx`:

```tsx
"use client";

import { authClient } from "@/lib/auth-client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (!token) {
    return <div>Invalid or missing reset link.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    const { error } = await authClient.resetPassword({
      token,
      newPassword,
    });

    if (error) {
      toast.error(error.message || "Reset link expired or invalid");
      return;
    }

    toast.success("Password reset successfully");
    router.push("/menu");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="New password"
        required
      />
      <input 
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm password"
        required
      />
      <button type="submit">Reset password</button>
    </form>
  );
}
```

### Login Modal Integration

Add "Forgot password?" link in `components/auth/login-modal.tsx` under the password field:

```tsx
<Link href={`/${locale}/auth/forgot-password`} className="text-sm text-muted-foreground hover:underline">
  Forgot password?
</Link>
```

---

## Change Password (While Logged In)

### API: Use Built-in

Better Auth provides `authClient.changePassword` directly. **No custom API route needed.**

### Client Usage

```ts
const { error } = await authClient.changePassword({
  currentPassword: "oldPassword123",
  newPassword: "newPassword456",
  revokeOtherSessions: true, // Logs out all other devices
});

if (error) {
  // Handle: wrong current password, same password, etc.
}
```

### UI in Profile

Add a "Security" section in `ProfileClient`:

```tsx
function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password changed successfully");
    // Clear form
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* current, new, confirm password fields */}
    </form>
  );
}
```

---

## Set Password for OAuth-Only Users

### The Problem

Users who signed up via Google don't have a password in the `accounts` table. They can only sign in via Google.

### Solution: `auth.api.setPassword`

Better Auth provides a server-side `setPassword` API that adds a credential account to an existing user. It requires the user's session.

### API Route

`app/api/user/set-password/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const setPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = setPasswordSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await auth.api.setPassword({
      headers: req.headers,
      body: { newPassword: parsed.data.newPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Handle case where user already has a password
    if (error.message?.includes("already has a password")) {
      return NextResponse.json(
        { error: "You already have a password. Use change password instead." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Failed to set password" }, { status: 500 });
  }
}
```

### Detecting OAuth-Only Users

Query the `accounts` table to check if user has a credential account:

```ts
// lib/auth/queries.ts
import { db } from "@/src/db/client";
import { accounts } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";

export async function hasCredentialAccount(userId: string): Promise<boolean> {
  const credentialAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.userId, userId),
      eq(accounts.providerId, "credential")
    ),
  });
  return !!credentialAccount;
}

export async function getLinkedProviders(userId: string): Promise<string[]> {
  const userAccounts = await db
    .select({ providerId: accounts.providerId })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  
  return userAccounts.map(a => a.providerId);
}
```

### UI in Profile

```tsx
function SetPasswordSection({ userId }: { userId: string }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/user/has-password`)
      .then(r => r.json())
      .then(d => setHasPassword(d.hasPassword));
  }, []);

  if (hasPassword === null) return <Skeleton />;
  if (hasPassword) return null; // Don't show if they already have a password

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a password</CardTitle>
        <CardDescription>
          You signed in with Google. Add a password to also sign in with email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SetPasswordForm />
      </CardContent>
    </Card>
  );
}
```

---

## Email Change

### Better Auth Configuration

Already included in the main config above under `user.changeEmail`.

### Client Usage

```ts
const { error } = await authClient.changeEmail({
  newEmail: "new@example.com",
  callbackURL: "/profile", // Redirect after verification
});

if (error) {
  toast.error(error.message);
  return;
}

toast.success("Check your new email for a verification link");
```

### Important Notes

- Better Auth sends verification to the **new** email address
- User must click the link to confirm the change
- Old email is not notified by default (you can add this in the hook if needed for security)

---

## Account Deletion

### Better Auth Configuration

Already included in the main config above under `user.deleteUser`.

### Deletion Methods

#### Method 1: Password Verification (for users with password)

```ts
const { error } = await authClient.deleteUser({
  password: "currentPassword",
  callbackURL: "/goodbye",
});
```

#### Method 2: Email Verification (for OAuth-only users)

```ts
const { error } = await authClient.deleteUser({
  callbackURL: "/goodbye",
});
// This triggers sendDeleteAccountVerification email
// User must click link to confirm deletion
```

#### Method 3: Token-based (from email link)

If you send users to a custom page with `?token=xxx`:

```ts
const { error } = await authClient.deleteUser({
  token: searchParams.get("token"),
});
```

### Profile UI – Danger Zone

```tsx
function DeleteAccountSection({ hasPassword }: { hasPassword: boolean }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleDelete = async () => {
    if (hasPassword) {
      const { error } = await authClient.deleteUser({
        password,
        callbackURL: "/goodbye",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      // OAuth-only: triggers email verification
      const { error } = await authClient.deleteUser({
        callbackURL: "/goodbye",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Check your email to confirm account deletion");
    }
  };

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Deleting your account is permanent. Your orders will remain in our system
          but won't be linked to your profile.
        </p>
        
        {showConfirm ? (
          <div className="space-y-4">
            {hasPassword && (
              <Input
                type="password"
                placeholder="Enter your password to confirm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {hasPassword ? "Delete my account" : "Send confirmation email"}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="destructive" onClick={() => setShowConfirm(true)}>
            Delete account
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### Data Model – Already Correct

Your schema already handles deletion properly:
- `orders.userId` → `onDelete: "set null"` (orders preserved, user reference cleared)
- `sessions`, `accounts`, `userProfiles`, `carts` → `onDelete: "cascade"` (cleaned up)

---

## Signup Flow Hardening

### Confirm Password on Sign-Up

Update `lib/validations.ts`:

```ts
export const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: passwordSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
```

Update `components/auth/login-modal.tsx` sign-up view to include confirm password field.

### API Route Update

In `app/api/sign-up/route.ts`, validate with full schema but only pass required fields to Better Auth:

```ts
const { confirmPassword, ...signUpData } = parsed.data;
await auth.api.signUpEmail({ body: signUpData, headers: req.headers });
```

---

## Linked Accounts Display

Show users which sign-in methods they have:

```tsx
function LinkedAccountsSection({ userId }: { userId: string }) {
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/user/linked-accounts")
      .then(r => r.json())
      .then(d => setProviders(d.providers));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>Email & Password</span>
          </div>
          {providers.includes("credential") ? (
            <Badge variant="secondary">Connected</Badge>
          ) : (
            <Button size="sm" variant="outline">Add password</Button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GoogleIcon className="h-4 w-4" />
            <span>Google</span>
          </div>
          {providers.includes("google") ? (
            <Badge variant="secondary">Connected</Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={() => authClient.linkSocial({ provider: "google" })}>
              Link Google
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Phasing & Rollout Checklist

### Phase 1 – Infrastructure & Account Linking (CRITICAL)

- [ ] Add Brevo email helper (`lib/email/brevo.ts`)
- [ ] Add Brevo env vars to `.env` and deployment
- [ ] **Update `lib/auth.ts` with account linking + email hooks** ← Most important
- [ ] Test: Sign up with email, then sign in with Google (same email) → should auto-link
- [ ] Test: Sign up with Google, then try email sign-in → should fail until password set

### Phase 2 – Password Reset

- [ ] Create forgot-password page (`app/[lang]/auth/forgot-password`)
- [ ] Create reset-password page (`app/[lang]/auth/reset-password`)
- [ ] Add "Forgot password?" link to login modal
- [ ] Test full flow with Brevo emails

### Phase 3 – Profile Security Controls

- [ ] Add `hasCredentialAccount` query helper
- [ ] Create `/api/user/set-password` route
- [ ] Create `/api/user/has-password` route (or fetch via linked accounts)
- [ ] Add change password UI to profile (for users with password)
- [ ] Add set password UI to profile (for OAuth-only users)
- [ ] Add linked accounts display to profile

### Phase 4 – Account Deletion

- [ ] Verify `beforeDelete` hook blocks admin deletion
- [ ] Add danger zone UI to profile
- [ ] Create `/[lang]/goodbye` page for post-deletion redirect
- [ ] Test deletion flow for both password and OAuth-only users

### Phase 5 – Polish

- [ ] Add password strength indicator to signup/reset forms
- [ ] Add rate limiting to password reset requests (via middleware or edge)
- [ ] Add logging for auth events (reset requested, password changed, account deleted)
- [ ] QA all flows in both English and Burmese locales

---

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Email enumeration on password reset | Always return generic "check email" message |
| Token brute force | Better Auth tokens are cryptographically random, short-lived |
| Account takeover via OAuth linking | Only trusted providers auto-link; Google verifies emails |
| Admin accidental deletion | `beforeDelete` hook checks `admins` table |
| Session hijacking after password change | `revokeOtherSessions: true` on password change |

---

## Summary of What Changed from Original Plan

| Original Approach | Refined Approach |
|-------------------|------------------|
| Custom `/api/auth/forgot-password` route | Use Better Auth's built-in `sendResetPassword` hook + `requestPasswordReset` client |
| Custom `/api/auth/reset-password` route | Use Better Auth's built-in `resetPassword` client |
| Manual token storage in verifications | Better Auth handles this automatically |
| No account linking config | Added `account.accountLinking.enabled: true` with `trustedProviders` |
| Separate email helper calls | Centralized in Better Auth hooks |

The key insight: **Better Auth already has most of this built in.** Wire Brevo into the hooks, enable account linking, and use the client APIs. Don't reinvent password reset.
