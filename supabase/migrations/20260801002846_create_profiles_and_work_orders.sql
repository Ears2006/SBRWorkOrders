/*
# Work Orders: profiles + work_orders tables

1. Overview
   This migration creates the database schema for a Work Order management app.
   The app has a sign-in/sign-up screen, so every table is owner-scoped using
   auth.uid() and restricted to the `authenticated` role.

2. New Tables
   a) `profiles`
      - `id` (uuid, primary key) — matches the auth user id
      - `email` (text, not null) — copied from auth.users for quick display
      - `full_name` (text, not null) — collected at sign-up
      - `created_at` (timestamptz) — defaults to now()
      One row per authenticated user. Populated automatically by a trigger
      when a new auth user is created.

   b) `work_orders`
      - `id` (uuid, primary key)
      - `location` (text, not null, <= 150 chars)
      - `subject` (text, not null, <= 150 chars) — used as the short description
      - `description` (text, not null, <= 5000 chars)
      - `status` (text, not null) — one of: 'active', 'waiting_for_parts', 'completed'
      - `user_id` (uuid, not null, DEFAULT auth.uid()) — the creator; FK to auth.users
      - `created_by` (text, not null) — creator's full name, captured at creation
      - `created_by_email` (text, not null) — creator's email, captured at creation
      - `created_at` (timestamptz) — defaults to now()
      - `updated_at` (timestamptz) — defaults to now(), refreshed via trigger on update

3. Triggers / Functions
   a) `handle_new_user()` — SECURITY DEFINER function that inserts a matching
      `profiles` row whenever a new row is added to `auth.users`. It copies the
      email and the `full_name` value from the new user's metadata (collected
      at sign-up).
   b) `handle_new_user` trigger on `auth.users` — fires AFTER INSERT.
   c) `set_updated_at()` — SECURITY DEFINER function that sets `updated_at = now()`
      whenever a work_orders row is updated.
   d) `set_updated_at` trigger on `work_orders` — fires BEFORE UPDATE.

   SECURITY DEFINER is used so the trigger functions can write to `profiles`
   and `work_orders` even though the caller is the anonymous auth process.

4. Security (RLS)
   - `profiles`: RLS enabled. Users can SELECT and UPDATE only their own row.
   - `work_orders`: RLS enabled. Full owner-scoped CRUD (select/insert/update/delete),
     each scoped with `auth.uid() = user_id`.

5. Indexes
   - `work_orders_user_id_idx` on `work_orders(user_id)` for ownership-filtered queries.
   - `work_orders_status_idx` on `work_orders(status)` for status filtering.
   - `work_orders_created_at_idx` on `work_orders(created_at desc)` for date sorting.
*/

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------
-- work_orders
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL CHECK (char_length(location) <= 150),
  subject text NOT NULL CHECK (char_length(subject) <= 150),
  description text NOT NULL CHECK (char_length(description) <= 5000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','waiting_for_parts','completed')),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by text NOT NULL,
  created_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_work_orders" ON work_orders;
CREATE POLICY "select_own_work_orders" ON work_orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_work_orders" ON work_orders;
CREATE POLICY "insert_own_work_orders" ON work_orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_work_orders" ON work_orders;
CREATE POLICY "update_own_work_orders" ON work_orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_work_orders" ON work_orders;
CREATE POLICY "delete_own_work_orders" ON work_orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS work_orders_user_id_idx ON work_orders(user_id);
CREATE INDEX IF NOT EXISTS work_orders_status_idx ON work_orders(status);
CREATE INDEX IF NOT EXISTS work_orders_created_at_idx ON work_orders(created_at DESC);

-- ---------------------------------------------------------------
-- Trigger: populate profiles on new auth user
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Team Member')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------
-- Trigger: refresh updated_at on work_orders update
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON work_orders;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();