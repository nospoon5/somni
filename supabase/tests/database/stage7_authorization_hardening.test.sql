-- Run against a disposable/local Supabase database after migrations:
--   npx supabase test db
--
-- This suite is catalog-only. It creates no users or application data.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

SELECT ok(
  pg_catalog.to_regprocedure('public.accept_baby_invite(uuid,text)') IS NOT NULL,
  'accept_baby_invite(uuid,text) exists'
);

SELECT ok(
  (
    SELECT p.prosecdef
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = pg_catalog.to_regprocedure(
      'public.accept_baby_invite(uuid,text)'
    )
  ),
  'accept_baby_invite is SECURITY DEFINER'
);

SELECT ok(
  (
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(p.proconfig) AS setting
      WHERE setting LIKE 'search_path=%'
    )
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = pg_catalog.to_regprocedure(
      'public.accept_baby_invite(uuid,text)'
    )
  ),
  'accept_baby_invite fixes its search_path'
);

SELECT ok(
  NOT pg_catalog.has_function_privilege(
    'anon',
    'public.accept_baby_invite(uuid,text)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute accept_baby_invite'
);

SELECT ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.accept_baby_invite(uuid,text)',
    'EXECUTE'
  ),
  'authenticated callers can execute accept_baby_invite'
);

SELECT ok(
  pg_catalog.to_regprocedure('public.rotate_baby_invite(uuid,text)') IS NOT NULL,
  'rotate_baby_invite(uuid,text) exists'
);

SELECT ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.rotate_baby_invite(uuid,text)',
    'EXECUTE'
  ),
  'authenticated owners can invoke scoped invite rotation'
);

SELECT is(
  (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'baby_shares'
      AND cmd = 'UPDATE'
  ),
  0::BIGINT,
  'baby_shares has no direct UPDATE policy'
);

SELECT ok(
  NOT pg_catalog.has_table_privilege(
    'authenticated',
    'public.baby_shares',
    'UPDATE'
  ),
  'authenticated callers have no table UPDATE privilege on baby_shares'
);

SELECT ok(
  NOT pg_catalog.has_column_privilege(
    'authenticated',
    'public.babies',
    'profile_id',
    'UPDATE'
  ),
  'authenticated callers cannot update babies.profile_id'
);

SELECT ok(
  pg_catalog.has_column_privilege(
    'authenticated',
    'public.babies',
    'name',
    'UPDATE'
  ),
  'authenticated callers retain access to an allowed baby field'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS t
    WHERE t.tgrelid = 'public.babies'::pg_catalog.regclass
      AND t.tgname = 'protect_baby_ownership'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ),
  'the immutable-ownership trigger is enabled'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    WHERE c.conrelid = 'public.baby_shares'::pg_catalog.regclass
      AND c.conname = 'baby_shares_access_role_check'
      AND pg_catalog.pg_get_constraintdef(c.oid) LIKE '%caregiver%'
      AND pg_catalog.pg_get_constraintdef(c.oid) NOT LIKE '%admin%'
  ),
  'the share role constraint allows caregiver only'
);

SELECT ok(
  (
    SELECT pg_catalog.bool_and(
      p.prosecdef
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.unnest(p.proconfig) AS setting
        WHERE setting LIKE 'search_path=%'
      )
    )
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid IN (
      pg_catalog.to_regprocedure('public.is_baby_owner(uuid,uuid)'),
      pg_catalog.to_regprocedure('public.has_baby_access(uuid,uuid)')
    )
  ),
  'both access helpers are SECURITY DEFINER with fixed search paths'
);

SELECT * FROM finish();

ROLLBACK;
