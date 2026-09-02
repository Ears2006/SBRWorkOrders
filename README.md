# Work Orders — Internal Maintenance Application

A professional internal maintenance work-order management application for Robson
employees. Users sign in with their `@robson.com` email, create work orders for
facility issues, and track them through Active, Waiting for Parts, and Completed
statuses.

## What the Application Does

- **Authentication:** Email/password sign-up and sign-in restricted to `@robson.com`
  addresses, with password reset and email verification flows.
- **Dashboard:** Sortable, searchable table of work orders with status filter
  buttons. On mobile, switches to clickable cards.
- **Create Work Order:** Form with Location, Subject, and Description fields with
  validation and character counters.
- **Work Order Detail:** Full view of a single work order with a status dropdown
  that saves changes to the database and shows success/error notifications.
- **Security:** Row Level Security on all tables; users can only access their own
  work orders. Creation fields are protected from modification after submission.

## Technology Stack

| Layer        | Technology                                      |
| ------------ | ----------------------------------------------- |
| Frontend     | React 18 + TypeScript                           |
| Build tool   | Vite                                            |
| Styling      | Tailwind CSS                                    |
| Icons        | lucide-react                                    |
| Routing      | react-router-dom v7                             |
| Backend      | Supabase (PostgreSQL, Auth, RLS)               |
| Testing      | Vitest                                          |

## Folder Structure

```
src/
├── components/        Reusable UI components (StatusBadge, StatusDropdown, table, cards, etc.)
├── contexts/          React context providers (ToastProvider)
├── hooks/             Custom hooks (useWorkOrders)
├── lib/               Core libraries (supabase client, auth context, date formatting)
├── pages/             Route-level page components
├── services/          Data-access service layer (workOrders API)
├── types/             Shared TypeScript types and constants (types.ts)
└── utils/             Pure utility functions (validation, sorting) + tests
scripts/
├── seed.mjs           Development-only sample data seeder
supabase/
└── migrations/        SQL migration files
```

## Installation

```bash
npm install
```

## Supabase Setup

### 1. Create the Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon public key** from Settings → API.

### 2. Run the SQL Migration

The migrations in `supabase/migrations/` create the `profiles` and `work_orders`
tables, RLS policies, triggers, and indexes. If you're using the Bolt Supabase
integration, these are applied automatically via the Supabase MCP tools.

To run manually, open the Supabase SQL Editor and paste the contents of each
migration file in order:

1. `20260801002846_create_profiles_and_work_orders.sql`
2. `20260801003229_revoke_execute_on_trigger_functions.sql`
3. `extend_work_orders_and_tighten_security.sql`

### 3. Enable Email Verification

By default, Supabase has email confirmation **off**. To enable it:

1. Go to your Supabase Dashboard → **Authentication** → **Providers** → **Email**.
2. Toggle **Confirm email** to **ON**.
3. Save.

When enabled, new registrants receive a verification email and must click the
link before signing in. The app's `/verify-email` page lets them resend the
verification link.

### 4. Configure the Approved Email Domain

The app restricts registration to `@robson.com` addresses. This is enforced
client-side in `src/utils/validation.ts` (`isApprovedEmailDomain`). To change
the domain, update the `APPROVED_DOMAIN` constant in that file.

For server-side enforcement (recommended), add a trigger or use Supabase Auth
hooks to reject sign-ups from non-approved domains.

### 5. Create the Environment File

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

> **Security:** Never commit your real `.env` file. It is already in `.gitignore`.
> Only the public anon key is used in the frontend — the service role key must
> never be exposed in client code.

## Running the Development Server

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

## Running Tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

Tests cover:

- Robson email-domain validation (accepts `@robson.com` and subdomains, rejects others)
- Password validation (minimum length)
- Default status ordering (Active → Waiting for Parts → Completed)
- Reversed status ordering (Completed first)
- Date sorting (newest-to-oldest and oldest-to-newest)
- Description sorting (alphabetical, case-insensitive)
- Work-order form validation (required fields, trimming, whitespace rejection, length limits)
- Status label formatting (human-readable labels, no raw database values)

## Building for Production

```bash
npm run build
```

Output is in `dist/`. Preview with:

```bash
npm run preview
```

## Deployment

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages,
etc.). Make sure your environment variables (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) are set in your hosting platform's environment
configuration.

If using Bolt, the app is deployed automatically.

## Seeding Sample Data (Development Only)

```bash
npm run seed
```

This creates sample work orders covering all three statuses with different
creators and dates. **Do not run this in production.** You must have at least one
registered account for the seed to work (RLS requires an authenticated session).

## How Sorting Works

The dashboard supports four sortable columns. Clicking a heading sorts by that
column; clicking again reverses the direction. An arrow icon indicates the
active sort column and direction.

| Column          | Sort behavior                                         |
| --------------- | ----------------------------------------------------- |
| Description     | Alphabetical by subject (A→Z or Z→A)                  |
| Status          | Active → Waiting for Parts → Completed (or reversed)  |
| Created By      | Alphabetical by creator's full name                    |
| Date Created    | Newest-to-oldest or oldest-to-newest (by timestamp)   |

**Default order** (no explicit sort): Active first, then Waiting for Parts, then
Completed — newest-first within each group. Completed orders appear at the
bottom unless the user changes the sort.

Sorting uses the actual UTC timestamp, not the formatted date string, so it is
always accurate regardless of locale display.

## How Row Level Security Protects the Data

- **RLS is enabled** on both `profiles` and `work_orders` tables.
- **SELECT:** Authenticated users can only read their own work orders
  (`auth.uid() = user_id`).
- **INSERT:** The `created_by_id` / `user_id` column defaults to `auth.uid()`,
  so it's filled from the authenticated session. The INSERT policy checks that
  the creator matches the signed-in user.
- **UPDATE:** Only the `status` column is client-writable (column-level
  privileges). All creation fields (subject, location, description, creator
  fields, timestamps) are protected from modification after submission.
- **DELETE:** No DELETE policy — users cannot delete work orders in this first
  version.
- **Profiles:** Users can read and update only their own profile row.
- **Unauthenticated access:** All policies require `authenticated` role. The
  anon key without a session gets zero rows.

## Routes

| Route                  | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `/`                    | Redirects to `/work-orders` or `/signin` |
| `/signin`              | Sign in page                             |
| `/register`            | Create account (Robson email only)       |
| `/forgot-password`     | Request password reset link              |
| `/reset-password`      | Set a new password                       |
| `/verify-email`        | Resend email verification link           |
| `/work-orders`         | Dashboard (protected)                    |
| `/work-orders/create`  | Create work order form (protected)       |
| `/work-orders/:id`     | Work order detail page (protected)       |
| `*`                    | 404 Not Found page                       |

## Troubleshooting

**"Only @robson.com email addresses can register."**
This is expected if you're using a non-Robson email. Use a `@robson.com` address
for testing, or change `APPROVED_DOMAIN` in `src/utils/validation.ts`.

**The dashboard shows no work orders.**
Make sure you're signed in. RLS only returns work orders you created. If you just
registered, you won't have any yet — create one via the Create Work Order button.

**"Please verify your email before signing in."**
Email confirmation is enabled. Check your inbox for a verification link, or use
the `/verify-email` page to resend it. To disable confirmation for development,
turn off **Confirm email** in Supabase Dashboard → Authentication → Providers.

**Status update fails.**
The dropdown reverts to its previous value on failure. Check your network
connection. If the issue persists, check the browser console for details.

**Seed script fails.**
RLS requires an authenticated session for inserts. The seed script uses the anon
key, so inserts may be blocked. For development, you can run the seed SQL
directly in the Supabase SQL Editor, or temporarily use a service role key in
the script.
