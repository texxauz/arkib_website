-- ================================================================
-- migration_016_redemption_guards.sql
-- Adds two protections to the redeem_reward RPC:
--   1. Minimum order value to redeem (min_order_to_redeem setting)
--   2. One redemption per calendar day per member (MYT)
-- Additive only. Safe to run on the live database.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Add new setting: minimum order subtotal required to redeem
--    Default: RM 80.00
-- ----------------------------------------------------------------
INSERT INTO public.membership_settings (key, value)
VALUES ('min_order_to_redeem', '80')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------
-- 2. Replace redeem_reward with guarded version
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
  v_reward              public.rewards%ROWTYPE;
  v_member              public.members%ROWTYPE;
  v_order               public.pos_orders%ROWTYPE;
  v_live_subtotal       NUMERIC(10,2);
  v_discount_amount     NUMERIC(10,2);
  v_label               TEXT;
  v_min_order           NUMERIC(10,2);
  v_today_myt           DATE;
  v_redemptions_today   INT;
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

  -- ── GUARD 1: Minimum order value ────────────────────────────────────────────
  SELECT COALESCE(value::NUMERIC, 0)
    INTO v_min_order
    FROM public.membership_settings
    WHERE key = 'min_order_to_redeem';

  IF v_live_subtotal < COALESCE(v_min_order, 0) THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error',      'Minimum order of RM ' || COALESCE(v_min_order, 0)::TEXT || ' required to redeem a reward',
      'min_order',  COALESCE(v_min_order, 0),
      'subtotal',   v_live_subtotal
    );
  END IF;

  -- ── GUARD 2: One redemption per calendar day (MYT = UTC+8) ─────────────────
  v_today_myt := (NOW() AT TIME ZONE 'Asia/Kuala_Lumpur')::DATE;

  SELECT COUNT(*) INTO v_redemptions_today
    FROM public.reward_redemptions rr
    JOIN public.pos_orders o ON o.id = rr.order_id
    WHERE rr.member_id = p_member_id
      AND (rr.created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::DATE = v_today_myt;

  IF v_redemptions_today >= 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Only one reward redemption is allowed per day'
    );
  END IF;

  -- ── All guards passed — calculate and apply discount ────────────────────────

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

-- Permissions unchanged — SECURITY DEFINER, authenticated only
REVOKE EXECUTE ON FUNCTION public.redeem_reward(UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_reward(UUID, UUID, UUID, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.redeem_reward(UUID, UUID, UUID, UUID) TO authenticated;
