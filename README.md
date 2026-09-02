# SBR Work Orders

A production-ready internal work-order management system designed to simplify how
employees submit, track, assign, update, and complete maintenance requests. The
application was built around simplicity, mobile usability, and an efficient
workflow for both requesters and maintenance staff — and has progressed from
development into real-world workplace testing.

## Live Application

**Production URL:** [https://sbrworkorders.com](https://sbrworkorders.com)

The production application requires an authorized `@robson.com` account with
email verification, so recruiters viewing this repository will not be able to
access the internal dashboard. The codebase is fully documented here for
review.

## Features

### Work Orders

- **Work order creation** — employees submit requests with location, subject,
  detailed description, and requester name
- **Unique work order numbers** — auto-generated sequential identifiers
  (e.g. `WO-2026-0001`) assigned at creation
- **Photo attachments** — upload and view photos on each work order, stored in
  secure database-backed storage
- **Requester information** — captures who submitted the request and their
  contact email
- **Creation and last-updated timestamps** — full audit trail of when each
  order was created and last modified

### Status Workflow

- **Three statuses** — Active, Waiting for Parts, and Completed
- **Waiting for Parts updates** — when a maintenance user sets an order to
  Waiting for Parts, a progress note is required documenting work performed,
  problems discovered, parts needed, ordering status, and related details
- **Work Updates history** — a chronological log of progress updates associated
  with each work order, displayed on the detail page with the update text,
  technician name, date/time, and associated status
- **Work Performed completion notes** — required when marking an order as
  Completed, along with the technician who completed the work
- **Technician completion tracking** — records which technician completed the
  order and when

### Technician Assignment

- Supervisors and administrators can assign work orders to specific
  maintenance technicians
- Assignment is visible on the dashboard and detail page

### Dashboard

- **Summary cards** — at-a-glance counts of Active, Waiting for Parts, and
  Completed work orders, clickable to filter
- **Searchable table** — full-text search across work order fields
- **Filtering** — filter by status using the summary cards
- **Sorting** — sortable by subject, status, created-by, and date created,
  with ascending/descending toggle
- **Pagination** — paginated results for large work order lists
- **Mobile-responsive** — table switches to clickable cards on mobile devices

### Authentication & Accounts

- **Email/password authentication** — powered by Supabase Auth
- **Email verification** — new accounts must verify their email before
  accessing the application
- **Registration restricted to `@robson.com`** — only Robson email addresses
  can create accounts, with a controlled admin exception for a non-Robson
  address
- **Password management** — signed-in users can change their password from the
  account menu, and password reset is available via email
- **Session persistence** — users stay signed in across page reloads

### Role-Based Access Control

Four roles with distinct capabilities:

| Role | Capabilities |
| --- | --- |
| **Employee** | Create work orders, view own orders, receive completion emails |
| **Maintenance** | Everything an Employee can do, plus change work order statuses, add Work Updates, complete work orders with Work Performed notes |
| **Supervisor** | Everything Maintenance can do, plus assign technicians to work orders |
| **Admin** | Full access — all Maintenance and Supervisor capabilities |

Roles are assigned automatically at registration based on the email address
and managed through the database. Regular `@robson.com` employees receive the
Employee role by default.

### Email Notifications

Automated email notifications are sent at two key points in the workflow:

1. **New work order created** — an email is sent to the Maintenance inbox
   (`sbrmaintenance@robson.com`) with the full work order details.
2. **Work order completed** — an email is sent to the original creator's email
   address with the completion details, Work Performed notes, and a link to
   view the completed order.

Emails are delivered through [Resend](https://resend.com) using a custom
verified sending domain. Duplicate prevention ensures each notification is
sent only once per occurrence. All email activity is logged in the database
with delivery status and provider message IDs.

### Security

- **Authentication** — Supabase Auth with email verification required
- **Role-based authorization** — maintenance, supervisor, and admin actions
  are enforced server-side via SECURITY DEFINER database functions, not just
  in the UI
- **Row Level Security** — all database tables have RLS enabled with
  ownership-scoped policies
- **Protected mutations** — status changes, completions, assignments, and
  Work Updates run through server-side functions that verify the caller's
  role before executing
- **Column-level protection** — work order creation fields (subject, location,
  description, requester info) cannot be modified after submission
- **Environment-based secrets** — API keys and credentials are stored as
  environment variables, never committed to the repository or exposed in
  client-side code

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Icons | lucide-react |
| Routing | React Router v7 |
| Backend / Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (email/password with verification) |
| File storage | Supabase Storage |
| Email service | Resend (via Supabase Edge Functions) |
| Server-side logic | Supabase Edge Functions (Deno runtime) |
| Testing | Vitest |
| Hosting | Bolt (automatic deployment) |

## Email Workflow

```
1. Employee submits a work order
       ↓
2. Maintenance receives an automated notification email
       ↓
3. Maintenance manages the order — assigns technician, adds Work Updates,
   changes status as needed (e.g. Waiting for Parts with progress notes)
       ↓
4. Maintenance completes the order with Work Performed notes
       ↓
5. The original creator receives an automated completion email
   with the work order details and completion information
```

## Real-World Usage

SBR Work Orders was developed to solve an actual maintenance workflow problem
— replacing an inefficient, paper-based request process with a streamlined
digital system. The application has progressed from development and testing
into real-world workplace use at Robson.

Early user feedback has specifically highlighted the application's simplicity,
ease of use, and user-friendly design as standout qualities. The interface was
designed to be approachable for non-technical staff while giving maintenance
technicians the structured information they need to work efficiently.

## Development Story

The engineering and product goals behind SBR Work Orders:

- **Replace complexity with a streamlined workflow** — the previous process
  was cumbersome; this system reduces a maintenance request to a simple form
- **Design around the people using it** — both the employee submitting a
  request and the technician fulfilling it have tailored experiences
- **Make submission fast** — an employee can file a work order in under a
  minute with optional photo attachments
- **Give maintenance the information they need** — descriptions, photos,
  location, and requester contact info are all captured up front
- **Provide clear status visibility** — everyone can see where an order stands
  and what progress has been made
- **Work well on any device** — the interface is fully responsive, from
  desktop monitors to mobile phones in the field

## Screenshots

Screenshots are not currently stored in this repository. To capture
screenshots for documentation:

1. Run the development server with `npm run dev`
2. Sign in with a test account
3. Capture the dashboard, work order detail, creation form, and mobile views
4. Save images to a `screenshots/` directory and reference them here

## Getting Started

### Installation

```bash
npm install
```

### Environment Setup

Copy the example environment file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Required variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

> **Security:** Never commit your real `.env` file. It is already in
> `.gitignore`. Only the public anon key is used in the frontend — the
> service role key must never be exposed in client code.

### Database

The SQL migrations in `supabase/migrations/` create the database schema, RLS
policies, triggers, indexes, and server-side functions. If using the Bolt
Supabase integration, these are applied automatically via the Supabase MCP
tools. To run manually, execute each migration file in order in the Supabase
SQL Editor.

### Development Server

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

### Testing

```bash
npm test          # run once
npm run test:watch  # watch mode
```

Tests cover email-domain validation, password validation, status ordering,
date and description sorting, and work-order form validation.

### Production Build

```bash
npm run build
```

Output is in `dist/`. Preview with `npm run preview`.

## Repository Structure

```
src/
├── components/        Reusable UI (StatusBadge, StatusDropdown, table, cards, photos, etc.)
├── contexts/          React context providers (ToastProvider)
├── hooks/             Custom hooks (useWorkOrders)
├── lib/               Core libraries (supabase client, auth context, formatting)
├── pages/             Route-level pages (dashboard, detail, create, auth, change password)
├── services/          Data-access layer (work orders, photos, email notifications)
├── utils/             Pure utilities (validation, sorting, permissions) + tests
└── types.ts           Shared TypeScript types and constants
supabase/
├── migrations/        SQL migration files (schema, RLS, functions)
└── functions/         Edge Functions (email notifications via Resend)
scripts/
└── seed.mjs           Development-only sample data seeder
```
