import { z } from "zod";

// Email validation
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .pipe(z.email("Enter a valid email address"));

// Password validation
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long");

// Name validation
export const nameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name is too long")
  .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes");

// Phone validation - Thai phone number format
export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(
    /^(\+66[0-9]{9}|0[0-9]{9})$/,
    "Enter a valid Thai phone number (e.g., 0812345678 or +66812345678)"
  );

// Sign up schema
export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

// Sign in schema
export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// Onboarding schema
export const onboardingSchema = z.object({
  phoneNumber: phoneSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;

