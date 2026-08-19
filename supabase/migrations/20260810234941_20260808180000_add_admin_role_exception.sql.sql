-- Add the admin-role exception for ejclinton1@gmail.com to the existing
-- auto-assign role function. The CASE already maps known Robson accounts to
-- maintenance/supervisor and everyone else to employee; this adds one branch
-- for the allowlisted outside email so it receives the existing 'admin' role.
-- No other role mappings, permissions, or schema are changed.

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
    WHEN LOWER(NEW.email) = 'ejclinton1@gmail.com' THEN 'admin'
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
