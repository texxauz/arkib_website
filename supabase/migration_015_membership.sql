-- ================================================================
-- migration_015_membership.sql
-- ARKIB Members Loyalty System
-- Additive only. Safe to run multiple times (IF NOT EXISTS / ON CONFLICT).
-- Only existing-table change: nullable member_id on pos_orders.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. members
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.members (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized TEXT          UNIQUE NOT NULL,
  name             TEXT,
  birthday         DATE,
  credits_balance  NUMERIC(10,2) DEFAULT 0  NOT NULL CHECK (credits_balance >= 0),
  total_spend      NUMERIC(10,2) DEFAULT 0  NOT NULL,
  total_visits     INT           DEFAULT 0  NOT NULL,
  last_visit_at    TIMESTAMPTZ,
  status           TEXT          DEFAULT 'active' NOT NULL
                                 CHECK (status IN ('active', 'inactive')),
  created_at       TIMESTAMPTZ   DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ   DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS members_phone_idx  ON public.members (phone_normalized);
CREATE INDEX IF NOT EXISTS members_status_idx ON public.members (status);

-- ----------------------------------------------------------------
-- 2. membership_ledger  (immutable audit trail — writes via RPC only)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_ledger (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID          NOT NULL REFERENCES public.members(id),
  order_id      UUID          REFERENCES public.pos_orders(id),
  type          TEXT          NOT NULL
                              CHECK (type IN ('earn', 'redeem', 'adjustment', 'expiry')),
  credits_delta NUMERIC(10,2) NOT NULL,
  reason        TEXT,
  staff_id      UUID          REFERENCES public.users(id),
  created_at    TIMESTAMPTZ   DEFAULT now() NOT NULL
);
-- One earn entry per order (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS membership_ledger_order_earn_unique
  ON public.membership_ledger (order_id)
  WHERE type = 'earn';
CREATE INDEX IF NOT EXISTS membership_ledger_member_idx ON public.membership_ledger (member_id);
CREATE INDEX IF NOT EXISTS membership_ledger_order_idx  ON public.membership_ledger (order_id);

-- ----------------------------------------------------------------
-- 3. rewards catalogue (V1: discount_fixed | discount_percentage only)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rewards (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT          NOT NULL,
  description      TEXT,
  reward_type      TEXT          NOT NULL
                                 CHECK (reward_type IN ('discount_fixed', 'discount_percentage')),
  reward_value     NUMERIC(10,2) NOT NULL
                                 CHECK (reward_value > 0)
                                 CHECK (
                                   reward_type != 'discount_percentage'
                                   OR reward_value <= 100
                                 ),
  credits_required NUMERIC(10,2) NOT NULL CHECK (credits_required > 0),
  is_active        BOOLEAN       DEFAULT true NOT NULL,
  created_at       TIMESTAMPTZ   DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ   DEFAULT now() NOT NULL
);

-- ----------------------------------------------------------------
-- 4. reward_redemptions  (writes via RPC only)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID          NOT NULL REFERENCES public.members(id),
  reward_id    UUID          NOT NULL REFERENCES public.rewards(id),
  order_id     UUID          NOT NULL REFERENCES public.pos_orders(id),
  credits_used NUMERIC(10,2) NOT NULL,
  staff_id     UUID          REFERENCES public.users(id),
  created_at   TIMESTAMPTZ   DEFAULT now() NOT NULL
);
-- One redemption of each reward per order
CREATE UNIQUE INDEX IF NOT EXISTS reward_redemptions_order_reward_unique
  ON public.reward_redemptions (order_id, reward_id);
CREATE INDEX IF NOT EXISTS reward_redemptions_member_idx ON public.reward_redemptions (member_id);
CREATE INDEX IF NOT EXISTS reward_redemptions_order_idx  ON public.reward_redemptions (order_id);

-- ----------------------------------------------------------------
-- 5. membership_credit_queue  (DB-level retry for failed credit processing)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_credit_queue (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID          NOT NULL UNIQUE REFERENCES public.pos_orders(id),
  member_id         UUID          NOT NULL REFERENCES public.members(id),
  credits_to_award  NUMERIC(10,2) NOT NULL,
  order_total       NUMERIC(10,2) NOT NULL,
  status            TEXT          DEFAULT 'pending' NOT NULL
                                  CHECK (status IN ('pending', 'processed', 'failed')),
  attempts          INT           DEFAULT 0 NOT NULL,
  last_attempted_at TIMESTAMPTZ,
  processed_at      TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ   DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS membership_credit_queue_status_idx
  ON public.membership_credit_queue (status);

-- ----------------------------------------------------------------
-- 6. membership_settings
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
INSERT INTO public.membership_settings (key, value) VALUES
  ('credits_per_rm',    '1'),
  ('min_spend_to_earn', '0')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------
-- 7. Nullable member_id on pos_orders (only existing-table change)
-- ----------------------------------------------------------------
ALTER TABLE public.pos_orders
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id);
CREATE INDEX IF NOT EXISTS pos_orders_member_idx
  ON public.pos_orders (member_id)
  WHERE member_id IS NOT NULL;

-- ================================================================
-- RPC FUNCTIONS
-- Security: SECURITY DEFINER with explicit search_path = public, pg_temp
-- EXECUTE revoked from PUBLIC and anon; granted to authenticated only.
-- This means only authenticated server-side callers can invoke them —
-- browser clients using the anon key cannot.
-- ================================================================

-- ----------------------------------------------------------------
-- 8. normalize_phone  (pure string helper — SECURITY INVOKER, not DEFINER)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_phone(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE digits TEXT;
BEGIN
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  IF digits LIKE '60%' THEN RETURN digits; END IF;
  IF digits LIKE '0%'  THEN RETURN '60' || substring(digits FROM 2); END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_phone(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.normalize_phone(TEXT) TO authenticated;

-- ----------------------------------------------------------------
-- 9. award_membership_credits  (SECURITY DEFINER — bypasses RLS for ledger writes)
--    Returns TRUE if credits were newly awarded, FALSE if already processed.
--    Callers must treat both TRUE and FALSE as success.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_membership_credits(
  p_member_id   UUID,
  p_order_id    UUID,
  p_credits     NUMERIC,
  p_order_total NUMERIC,
  p_staff_id    UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_inserted INT;
BEGIN
  -- Insert ledger entry; partial unique index silently blocks duplicates
  WITH ins AS (
    INSERT INTO public.membership_ledger
      (member_id, order_id, type, credits_delta, reason, staff_id)
    VALUES
      (p_member_id, p_order_id, 'earn', p_credits, 'Purchase credit', p_staff_id)
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;

  -- Only update member if ledger entry was actually inserted (idempotent)
  IF v_inserted > 0 THEN
    UPDATE public.members SET
      credits_balance = credits_balance + p_credits,
      total_spend     = total_spend     + p_order_total,
      total_visits    = total_visits    + 1,
      last_visit_at   = now(),
      updated_at      = now()
    WHERE id = p_member_id;
  END IF;

  RETURN v_inserted > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_membership_credits(UUID, UUID, NUMERIC, NUMERIC, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_membership_credits(UUID, UUID, NUMERIC, NUMERIC, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.award_membership_credits(UUID, UUID, NUMERIC, NUMERIC, UUID) TO authenticated;

-- ----------------------------------------------------------------
-- 10. redeem_reward  (SECURITY DEFINER — atomic, all-or-nothing)
--     Returns JSONB: {success: true, ...} or {success: false, error: "..."}
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_member_id UUID,
  p_reward_id UUID,
  p_order_id  UUID,
  p_staff_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reward          public.rewards%ROWTYPE;
  v_member          public.members%ROWTYPE;
  v_order           public.pos_orders%ROWTYPE;
  v_live_subtotal   NUMERIC(10,2);
  v_discount_amount NUMERIC(10,2);
  v_label           TEXT;
BEGIN
  -- Lock member row to prevent concurrent redemptions
  SELECT * INTO v_member
    FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  -- Validate reward is active
  SELECT * INTO v_reward
    FROM public.rewards WHERE id = p_reward_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward not found or inactive');
  END IF;

  -- Check sufficient credits before touching anything
  IF v_member.credits_balance < v_reward.credits_required THEN
    RETURN jsonb_build_object(
      'success',  false,
      'error',    'Insufficient credits',
      'balance',  v_member.credits_balance,
      'required', v_reward.credits_required
    );
  END IF;

  -- Lock and load the order
  SELECT * INTO v_order
    FROM public.pos_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- CRITICAL: verify this order belongs to this member
  IF v_order.member_id IS DISTINCT FROM p_member_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member does not match this order');
  END IF;

  -- Order must be open
  IF v_order.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is not open');
  END IF;

  -- CRITICAL: explicit duplicate check — do NOT use ON CONFLICT and continue
  IF EXISTS (
    SELECT 1 FROM public.reward_redemptions
    WHERE order_id = p_order_id AND reward_id = p_reward_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward already redeemed on this order');
  END IF;

  -- Guard: reject if a non-membership discount already exists on the order
  IF COALESCE(v_order.discount_amount, 0) > 0
     AND (
       v_order.discount_label IS NULL
       OR v_order.discount_label NOT LIKE 'Member Reward:%'
     )
  THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Order already has a discount applied. Remove it before redeeming a reward.'
    );
  END IF;

  -- Compute live subtotal from non-voided items (pos_orders.subtotal is 0 until close)
  SELECT COALESCE(SUM(quantity * unit_price - COALESCE(discount, 0)), 0)
    INTO v_live_subtotal
    FROM public.pos_order_items
    WHERE order_id = p_order_id AND voided_at IS NULL;

  IF v_live_subtotal <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order has no chargeable items');
  END IF;

  -- Calculate discount amount
  IF v_reward.reward_type = 'discount_percentage' THEN
    v_discount_amount := ROUND(v_live_subtotal * v_reward.reward_value / 100, 2);
  ELSE -- discount_fixed
    v_discount_amount := LEAST(v_reward.reward_value, v_live_subtotal);
  END IF;

  v_label := 'Member Reward: ' || v_reward.name;

  -- All writes below are within the same transaction — fully atomic.
  -- If any statement throws, Postgres rolls back everything.

  UPDATE public.pos_orders SET
    discount_amount = v_discount_amount,
    discount_label  = v_label
  WHERE id = p_order_id;

  INSERT INTO public.reward_redemptions
    (member_id, reward_id, order_id, credits_used, staff_id)
  VALUES
    (p_member_id, p_reward_id, p_order_id, v_reward.credits_required, p_staff_id);

  INSERT INTO public.membership_ledger
    (member_id, order_id, type, credits_delta, reason, staff_id)
  VALUES
    (p_member_id, p_order_id, 'redeem',
     -v_reward.credits_required,
     'Reward: ' || v_reward.name,
     p_staff_id);

  UPDATE public.members SET
    credits_balance = credits_balance - v_reward.credits_required,
    updated_at      = now()
  WHERE id = p_member_id;

  RETURN jsonb_build_object(
    'success',           true,
    'discount_amount',   v_discount_amount,
    'discount_label',    v_label,
    'credits_used',      v_reward.credits_required,
    'credits_remaining', v_member.credits_balance - v_reward.credits_required
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_reward(UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_reward(UUID, UUID, UUID, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.redeem_reward(UUID, UUID, UUID, UUID) TO authenticated;

-- ================================================================
-- RLS POLICIES
-- Strategy:
--   membership_ledger     — SELECT authenticated; NO direct write (SECURITY DEFINER only)
--   reward_redemptions    — SELECT authenticated; NO direct write (SECURITY DEFINER only)
--   members               — SELECT + INSERT + UPDATE authenticated (API enforces tab_permissions)
--   membership_credit_queue — INSERT authenticated (close-order enqueues); SELECT/UPDATE admin only
--   rewards               — SELECT authenticated; ALL admin only
--   membership_settings   — SELECT authenticated; ALL admin only
-- ================================================================

ALTER TABLE public.members                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_ledger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_credit_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_settings     ENABLE ROW LEVEL SECURITY;

-- members
CREATE POLICY "members_select_authenticated"
  ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_insert_authenticated"
  ON public.members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "members_update_authenticated"
  ON public.members FOR UPDATE TO authenticated USING (true);
-- No direct DELETE from any client

-- membership_ledger: read-only from client; all writes via SECURITY DEFINER RPCs
CREATE POLICY "ledger_select_authenticated"
  ON public.membership_ledger FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE/DELETE intentionally omitted → denied to all direct clients

-- rewards: all authenticated can read; only admin can write
CREATE POLICY "rewards_select_authenticated"
  ON public.rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "rewards_write_admin"
  ON public.rewards FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('owner', 'manager'));

-- reward_redemptions: read-only from client; all writes via SECURITY DEFINER RPC
CREATE POLICY "redemptions_select_authenticated"
  ON public.reward_redemptions FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE/DELETE intentionally omitted → denied to all direct clients

-- membership_credit_queue:
--   INSERT — any authenticated (close-order route enqueues on failure)
--   SELECT/UPDATE — admin only (retry processing)
CREATE POLICY "queue_insert_authenticated"
  ON public.membership_credit_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "queue_read_admin"
  ON public.membership_credit_queue FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'));
CREATE POLICY "queue_update_admin"
  ON public.membership_credit_queue FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'));

-- membership_settings
CREATE POLICY "settings_select_authenticated"
  ON public.membership_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_write_admin"
  ON public.membership_settings FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('owner', 'manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('owner', 'manager'));
