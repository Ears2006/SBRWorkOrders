/*
# Auto-assign roles for known department accounts on registration

1. Purpose
   The prior migration seeded roles for existing profiles. For accounts that
   do not yet exist (e.g. adam.mancha@robson.com), the role must be assigned
   automatically when the account is created so the user gets the correct
   permissions without manual SQL.

2. Changes
   - Updates `handle_new_user()` to derive the profile role from the new
     user's email:
       sbrmaintenance@robson.com  -> 'maintenance'
       adam.mancha@robson.com     -> 'supervisor'
       (all others)               -> 'employee'
   - The function remains SECURITY DEFINER, search_path = public.
   - The trigger `on_auth_user_created` is unchanged (already exists).

3. No data changes — existing profiles keep their roles.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := 'employee';
BEGIN
  v_role := CASE
    WHEN LOWER(NEW.email) = 'sbrmaintenance@robson.com' THEN 'maintenance'
    WHEN LOWER(NEW.email) = 'adam.mancha@robson.com' THEN 'supervisor'
    ELSE 'employee'
  END;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Team Member'),
    v_role
  )
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  RETURN NEW;
END;
$$;
