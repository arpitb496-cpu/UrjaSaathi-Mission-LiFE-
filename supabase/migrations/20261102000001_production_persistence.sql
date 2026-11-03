-- ============================================================================
-- URJASAATHI: Production Persistence Schema & Atomic Reward Allocation
-- Target: Supabase PostgreSQL (Vercel Serverless Production Deployment)
-- Timezone Standard: Asia/Kolkata (YYYY-MM-DD)
-- ============================================================================

-- 1. Mission Completions Ledger (Authoritative Source of Truth)
CREATE TABLE IF NOT EXISTS public.mission_completions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  completion_date DATE NOT NULL, -- Stored as YYYY-MM-DD in Asia/Kolkata timezone
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  co2_saved_kg NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (co2_saved_kg >= 0),
  inr_saved NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (inr_saved >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Mandatory Database-Level Idempotency Constraint
  CONSTRAINT uq_mission_completions_user_mission_date
    UNIQUE (user_id, mission_id, completion_date)
);

CREATE INDEX IF NOT EXISTS idx_mission_completions_user_date
  ON public.mission_completions (user_id, completion_date DESC);

-- 2. User Progress & Consecutive Streak Ledger
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id TEXT PRIMARY KEY,
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  total_co2_saved_kg NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_co2_saved_kg >= 0),
  total_inr_saved NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_inr_saved >= 0),
  streak_days INTEGER NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  last_active_date DATE, -- YYYY-MM-DD in Asia/Kolkata timezone
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Reusable Green Impact Passport Credential Records (for QR Verification)
CREATE TABLE IF NOT EXISTS public.credential_records (
  credential_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  holder_name TEXT NOT NULL DEFAULT 'Household Citizen',
  district TEXT NOT NULL DEFAULT 'Gujarat',
  green_score INTEGER NOT NULL DEFAULT 0 CHECK (green_score >= 0 AND green_score <= 100),
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  co2_saved_kg NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (co2_saved_kg >= 0),
  inr_saved NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (inr_saved >= 0),
  missions_completed INTEGER NOT NULL DEFAULT 0 CHECK (missions_completed >= 0),
  streak_days INTEGER NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  payload_hash TEXT NOT NULL,
  qr_verification_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_count INTEGER NOT NULL DEFAULT 0 CHECK (verified_count >= 0),
  last_verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_credential_records_user_id
  ON public.credential_records (user_id);

-- 4. Atomic Server-Side Transaction Function for Mission Completion & Streak Update
-- Serializes concurrent requests across multiple Vercel serverless instances using
-- PostgreSQL transaction-level advisory locks + UNIQUE constraint conflict handling.
-- SECURITY DEFINER HARDENING:
--   1. Fixed empty search_path (`SET search_path = ''`) prevents object-shadowing attacks.
--   2. Every table (`public.*`) and built-in function (`pg_catalog.*`) is schema-qualified.
--   3. EXECUTE is revoked from PUBLIC, anon, and authenticated; granted ONLY to service_role.
CREATE OR REPLACE FUNCTION public.complete_mission_atomic(
  p_user_id TEXT,
  p_mission_id TEXT,
  p_completion_date DATE,
  p_points INTEGER,
  p_co2_saved_kg NUMERIC DEFAULT 0,
  p_inr_saved NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted_id BIGINT;
  v_prev_streak INTEGER := 0;
  v_prev_last_active DATE := NULL;
  v_new_streak INTEGER := 0;
  v_streak_incremented BOOLEAN := FALSE;
  v_total_points INTEGER := 0;
  v_total_co2 NUMERIC(10, 2) := 0;
  v_total_inr NUMERIC(10, 2) := 0;
  v_diff_days INTEGER;
BEGIN
  -- Acquire per-user transaction-scoped advisory lock to prevent race conditions
  -- across concurrent serverless invocations without relying on in-memory JS locks.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('urjasaathi_mission_' || p_user_id));

  -- Ensure public.user_progress row exists
  INSERT INTO public.user_progress (user_id, total_points, total_co2_saved_kg, total_inr_saved, streak_days, last_active_date)
  VALUES (p_user_id, 0, 0, 0, 0, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock public.user_progress row FOR UPDATE inside this transaction
  SELECT streak_days, last_active_date, total_points, total_co2_saved_kg, total_inr_saved
    INTO v_prev_streak, v_prev_last_active, v_total_points, v_total_co2, v_total_inr
    FROM public.user_progress
   WHERE user_id = p_user_id
     FOR UPDATE;

  -- Reconcile missed calendar day before evaluating today's mission
  IF v_prev_last_active IS NOT NULL THEN
    v_diff_days := (p_completion_date - v_prev_last_active);
    IF v_diff_days > 1 THEN
      v_prev_streak := 0;
    END IF;
  ELSE
    v_prev_streak := 0;
  END IF;

  -- Attempt atomic insert into public.mission_completions with UNIQUE (user_id, mission_id, completion_date)
  INSERT INTO public.mission_completions (
    user_id,
    mission_id,
    completion_date,
    points_awarded,
    co2_saved_kg,
    inr_saved
  )
  VALUES (
    p_user_id,
    p_mission_id,
    p_completion_date,
    GREATEST(0, COALESCE(p_points, 0)),
    GREATEST(0, COALESCE(p_co2_saved_kg, 0)),
    GREATEST(0, COALESCE(p_inr_saved, 0))
  )
  ON CONFLICT ON CONSTRAINT uq_mission_completions_user_mission_date DO NOTHING
  RETURNING id INTO v_inserted_id;

  -- If duplicate completion on the same calendar day (Asia/Kolkata): award 0 points and 0 streak
  IF v_inserted_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'already_completed',
      'duplicate', TRUE,
      'user_id', p_user_id,
      'mission_id', p_mission_id,
      'completion_date', pg_catalog.to_char(p_completion_date, 'YYYY-MM-DD'),
      'points_awarded', 0,
      'streak_days', v_prev_streak,
      'streak_incremented', FALSE,
      'total_points', v_total_points,
      'total_co2_saved_kg', v_total_co2,
      'total_inr_saved', v_total_inr
    );
  END IF;

  -- Compute new consecutive daily streak in Asia/Kolkata
  IF v_prev_last_active = p_completion_date THEN
    -- Already completed another mission today: keep streak unchanged
    v_new_streak := GREATEST(1, v_prev_streak);
    v_streak_incremented := FALSE;
  ELSIF v_prev_last_active IS NOT NULL AND (p_completion_date - v_prev_last_active) = 1 THEN
    -- Yesterday was an active day: increment streak by 1
    v_new_streak := GREATEST(1, v_prev_streak) + 1;
    v_streak_incremented := TRUE;
  ELSE
    -- First ever mission or missed one or more calendar days: reset streak to 1
    v_new_streak := 1;
    v_streak_incremented := TRUE;
  END IF;

  -- Update authoritative aggregates in public.user_progress
  UPDATE public.user_progress
     SET total_points = total_points + GREATEST(0, COALESCE(p_points, 0)),
         total_co2_saved_kg = total_co2_saved_kg + GREATEST(0, COALESCE(p_co2_saved_kg, 0)),
         total_inr_saved = total_inr_saved + GREATEST(0, COALESCE(p_inr_saved, 0)),
         streak_days = v_new_streak,
         last_active_date = GREATEST(COALESCE(last_active_date, p_completion_date), p_completion_date),
         updated_at = pg_catalog.now()
   WHERE user_id = p_user_id
   RETURNING total_points, total_co2_saved_kg, total_inr_saved
    INTO v_total_points, v_total_co2, v_total_inr;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'completed',
    'duplicate', FALSE,
    'user_id', p_user_id,
    'mission_id', p_mission_id,
    'completion_date', pg_catalog.to_char(p_completion_date, 'YYYY-MM-DD'),
    'points_awarded', GREATEST(0, COALESCE(p_points, 0)),
    'streak_days', v_new_streak,
    'streak_incremented', v_streak_incremented,
    'total_points', v_total_points,
    'total_co2_saved_kg', v_total_co2,
    'total_inr_saved', v_total_inr
  );
END;
$$;

-- ============================================================================
-- 5. Row-Level Security (RLS) & Strict Privilege Lockdown
-- ============================================================================

-- Enable and force Row Level Security on all persistence tables.
-- With zero permissive policies defined for `anon` or `authenticated`, direct PostgREST
-- client access is denied by default; only the server-side `service_role` bypasses RLS.
ALTER TABLE public.mission_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_completions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress FORCE ROW LEVEL SECURITY;

ALTER TABLE public.credential_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_records FORCE ROW LEVEL SECURITY;

-- Revoke direct table access from PUBLIC, anon, and authenticated roles.
-- In particular, `public.credential_records` cannot be queried directly by anonymous or
-- ordinary authenticated users; public QR verification MUST flow through the controlled
-- server verification endpoint (`/api/passport/credentials/:credentialId/verify`).
REVOKE ALL ON TABLE public.mission_completions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_progress FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.credential_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.mission_completions_id_seq FROM PUBLIC, anon, authenticated;

-- Grant table and sequence access exclusively to the trusted server-side `service_role`.
GRANT ALL ON TABLE public.mission_completions TO service_role;
GRANT ALL ON TABLE public.user_progress TO service_role;
GRANT ALL ON TABLE public.credential_records TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.mission_completions_id_seq TO service_role;

-- Restrict execution privileges for the exact SECURITY DEFINER function signature so
-- only the trusted server-side Supabase service-role client can invoke this RPC.
REVOKE EXECUTE ON FUNCTION public.complete_mission_atomic(TEXT, TEXT, DATE, INTEGER, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mission_atomic(TEXT, TEXT, DATE, INTEGER, NUMERIC, NUMERIC) TO service_role;
