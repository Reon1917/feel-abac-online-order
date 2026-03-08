# 🍽️ Feel ABAC — Online Food Ordering System

**A full-stack, real-time online food ordering platform built for Feel Restaurant**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000?logo=vercel)](https://vercel.com/)


<img width="316" height="1258" alt="iPhone-14-Plus-feelabac com" src="https://github.com/user-attachments/assets/83782003-d963-4b6f-9a75-02fa634ae89a" />
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
<img width="316" height="1258" alt="iPhone-14-Plus-feelabac com (1)" src="https://github.com/user-attachments/assets/1e4823fd-0138-485d-8b5f-2c06865b9697" />

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Project Structure](#project-structure)
- [Internationalization](#internationalization)
- [Scripts](#scripts)
- [Screenshots](#screenshots)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

**Feel ABAC** is a production-grade online food ordering system that powers Feel Restaurant's digital storefront. It provides customers with a seamless menu browsing, cart management, and ordering experience — complete with real-time order tracking, PromptPay payment integration, and multi-language support (English & Burmese). A comprehensive admin dashboard gives restaurant staff full control over menu management, order processing, delivery zones, and payments.

---

## Features

### Customer Experience
- **Responsive Menu Browser** — Browse categories and items on any device with bilingual content (EN/MY)
- **Item Customization** — Choice groups, add-ons, and set menu selections with dynamic pricing
- **Smart Cart** — Add/edit items, swipe-to-remove, real-time price calculation with VAT
- **Delivery Selection** — Choose from preset locations/buildings or pin a custom address via Google Maps
- **Order Tracking** — Real-time order status updates powered by Pusher (processing → kitchen → delivery → completed)
- **PromptPay Payments** — QR code generation, payment slip upload, and two-stage payment flow (food + delivery)
- **Receipt Download** — Generate and download PDF receipts for completed orders
- **Order History** — Browse past orders with tabbed filtering

### Admin Dashboard
- **Order Management** — Live order board with accept/cancel/handoff/delivered actions and payment verification
- **Menu Editor** — Full CRUD for categories, items, choice groups, and choice pools with drag-and-drop reordering
- **Image Management** — Upload and compress menu images stored on Cloudflare R2
- **Stock Control** — Toggle item availability in real time
- **Delivery Zones** — Manage condominiums, buildings, and fee structures
- **PromptPay Settings** — Configure active payment accounts
- **Shop Status** — Open/close the restaurant with one toggle
- **Team Management** — Add and remove admin users with role-based access
- **Archived Orders** — Search and filter historical orders

### Platform
- **Real-time Updates** — Pusher WebSocket integration for instant order status sync
- **Authentication** — Email/password and Google OAuth via Better Auth with secure session management
- **Internationalization** — Full EN/MY support with independent UI and menu language switching
- **Onboarding Flow** — Guided setup for new users (verification + delivery preferences)
- **Automated Cleanup** — Cron job for archiving stale orders

---

## Screenshots

### Admin Dashboard
<img width="1038" height="598" alt="Galaxy-Tab-S7-feelabac com" src="https://github.com/user-attachments/assets/b5820bea-8a9f-4620-8734-11aa0ee9cfd4" />


### Menu Management
<img width="1038" height="598" alt="Galaxy-Tab-S7-feelabac com (2)" src="https://github.com/user-attachments/assets/07905150-d977-4f71-8083-e82b0b6af6f8" />


### Live Order Board
<img width="1038" height="598" alt="Galaxy-Tab-S7-feelabac com (1)" src="https://github.com/user-attachments/assets/3cce2e98-7a1c-496e-b7ed-9c404cef4af4" />

### Customer Landing & Menu (Mobile)

<img width="316" height="1258" alt="iPhone-14-Plus-feelabac com" src="https://github.com/user-attachments/assets/2b144089-3ad0-45f1-b1d4-53f9d88c9202" />
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
<img width="316" height="1258" alt="iPhone-14-Plus-feelabac com (1)" src="https://github.com/user-attachments/assets/7f49982c-b08b-42b2-92e5-f41cbdbd21f2" />

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **UI** | React 19, Tailwind CSS 4, shadcn/ui (New York), Radix UI |
| **State** | Zustand, React Hook Form |
| **Database** | PostgreSQL (Neon Serverless) |
| **ORM** | Drizzle ORM |
| **Auth** | Better Auth (email/password + Google OAuth) |
| **Real-time** | Pusher |
| **File Upload** | UploadThing + Cloudflare R2 |
| **Maps** | Google Maps API |
| **Payments** | PromptPay (QR-based) |
| **Email** | Brevo (transactional) |
| **Validation** | Zod |
| **Drag & Drop** | @dnd-kit |
| **PDF** | html2pdf.js |
| **QR Codes** | qrcode.react |
| **Icons** | Lucide React |
| **Deployment** | Vercel |

---

## Architecture

<img width="924" height="680" alt="Diner App" src="https://github.com/user-attachments/assets/c90f2abf-193e-4bf5-b527-2c1d76abbaa6" />


**Key Design Decisions:**
- **Locale-based routing** — All pages nested under `[lang]` for clean EN/MY URLs
- **Server-side validation** — Cart items validated against stock at submit time
- **Day-based order IDs** — Human-friendly `YYYYMMDD-NNN` format
- **Two-stage payments** — Food and delivery fees handled as separate payment steps
- **Independent language controls** — UI language and menu language can differ per user

---

## Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** (or your preferred package manager)
- **PostgreSQL** database (recommend [Neon](https://neon.tech) for serverless)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/feel-abac-online-order.git
cd feel-abac-online-order

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials (see below)

# Push database schema
npx drizzle-kit push

# Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Authentication (Better Auth)
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Pusher (Real-time)
PUSHER_APP_ID=your-app-id
PUSHER_KEY=your-key
PUSHER_SECRET=your-secret
PUSHER_CLUSTER=your-cluster
NEXT_PUBLIC_PUSHER_KEY=your-key
NEXT_PUBLIC_PUSHER_CLUSTER=your-cluster

# UploadThing (File Uploads)
UPLOADTHING_TOKEN=your-token

# AWS S3 / Cloudflare R2 (Image Storage)
AWS_S3_REGION=auto
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket
R2_ENDPOINT=your-r2-endpoint
CDN_BASE_URL=https://cdn.yoursite.com

# Brevo (Transactional Email)
BREVO_API_KEY=your-brevo-api-key

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-key
```

---

## Database Setup

This project uses **Drizzle ORM** with **PostgreSQL**. The schema is defined in `src/db/schema.ts` and migrations are stored in the `drizzle/` directory.

```bash
# Push schema changes to the database
npx drizzle-kit push

# Generate a new migration
npx drizzle-kit generate

# Seed admin user (first time setup)
npx tsx scripts/seed-admin.ts
```

### Data Model Overview

| Domain | Tables |
|---|---|
| **Auth & Users** | `users`, `sessions`, `accounts`, `verifications`, `user_profiles` |
| **Admin** | `admins` (role-based access control) |
| **Menu** | `menu_categories`, `menu_items`, `menu_choice_groups`, `menu_choice_options`, `choice_pools`, `choice_pool_options`, `set_menu_pool_links`, `recommended_menu_items` |
| **Cart** | `carts`, `cart_items`, `cart_item_choices` |
| **Orders** | `orders` (with full status lifecycle, refund tracking, VAT) |
| **Delivery** | `delivery_locations`, `delivery_buildings` |
| **Payments** | `promptpay_accounts` |

---

## Project Structure

```
├── app/
│   ├── layout.tsx                  # Root layout with metadata & providers
│   ├── globals.css                 # Tailwind config & CSS variables
│   ├── [lang]/                     # Locale-based routing (en, my)
│   │   ├── page.tsx                # Landing page
│   │   ├── menu/                   # Menu browser & item details
│   │   ├── cart/                   # Shopping cart & checkout
│   │   ├── orders/                 # Order tracking & history
│   │   ├── profile/                # User profile & settings
│   │   ├── onboarding/             # New user setup flow
│   │   ├── admin/                  # Admin dashboard (protected)
│   │   │   ├── orders/             # Order management
│   │   │   ├── menu/               # Menu editor
│   │   │   ├── delivery/           # Delivery zone config
│   │   │   ├── stock/              # Availability control
│   │   │   └── settings/           # Team, payments, shop settings
│   │   └── auth/                   # Auth pages
│   └── api/                        # API routes (REST endpoints)
├── components/                     # Feature-organized React components
│   ├── admin/                      # Admin UI modules
│   ├── menu/                       # Menu display components
│   ├── cart/                       # Cart components
│   ├── orders/                     # Order status & history
│   ├── payments/                   # Payment flow UI
│   ├── i18n/                       # Locale providers & switchers
│   └── ui/                         # shadcn/ui primitives
├── lib/                            # Shared utilities & business logic
│   ├── db/                         # Database client & queries
│   ├── auth/                       # Auth helpers
│   ├── menu/                       # Menu logic
│   ├── cart/                       # Cart logic
│   ├── orders/                     # Order processing
│   ├── delivery/                   # Delivery calculations
│   ├── payments/                   # Payment verification
│   ├── pusher/                     # Real-time event helpers
│   └── i18n/                       # Internationalization utilities
├── src/db/schema.ts                # Drizzle ORM schema definitions
├── drizzle/                        # SQL migrations
├── dictionaries/                   # Translation files (en/, my/)
├── scripts/                        # Utility scripts (seed, i18n check)
└── documentation/                  # Feature documentation & plans
```

---

## Internationalization

The app supports **English** (`en`) and **Burmese/Myanmar** (`my`) with a unique dual-language system:

- **UI Language** — Controls interface text (buttons, labels, navigation)
- **Menu Language** — Controls food item names and descriptions independently

Translation files are organized by feature in `dictionaries/{locale}/`:

```
dictionaries/
├── en/
│   ├── common.json
│   ├── menu.json
│   ├── cart.json
│   ├── order.json
│   ├── auth.json
│   ├── landing.json
│   ├── profile.json
│   ├── admin-orders.json
│   ├── admin-menu.json
│   └── ...
└── my/
    └── (same structure)
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Create production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |
| `npm run check:i18n` | Validate i18n translation completeness |
| `npx drizzle-kit push` | Push schema to database |
| `npx drizzle-kit generate` | Generate SQL migration |
| `npx tsx scripts/seed-admin.ts` | Seed initial admin user |

---

## Deployment

The project is configured for **Vercel** deployment:

1. Connect the repository to Vercel
2. Set all environment variables in the Vercel dashboard
3. Deploy — Vercel auto-detects Next.js and builds accordingly

**Cron Jobs** (configured in `vercel.json`):
- Order cleanup runs daily at 17:00 UTC (`/api/cron/cleanup-orders`)

**CDN Configuration:**
- Menu images are served via `cdn.feelabac.com` with Next.js Image Optimization
- Remote image patterns are configured in `next.config.ts`

---

## License

This project is proprietary software. All rights reserved.

---

<div align="center">

**Built with ❤️ for Feel Restaurant**

</div>
