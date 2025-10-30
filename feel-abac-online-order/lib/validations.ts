import { z } from "zod";

// Email validation
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address");

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

// Phone validation - international format support
export const phoneSchema = z
  .string()
  .min(8, "Phone number must be at least 8 digits")
  .max(20, "Phone number is too long")
  .regex(/^[+]?[\d\s()-]+$/, "Enter a valid phone number");

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

