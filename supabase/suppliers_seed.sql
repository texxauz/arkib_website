-- ============================================================
-- SUPPLIERS SEED DATA
-- Run this in Supabase SQL Editor
-- ============================================================

INSERT INTO public.suppliers (name, category, notes, is_active)
VALUES
('TWE',    'alcohol', 'The Wine Exchange — main spirits supplier', true),
('DC',     'alcohol', 'DC Distributors — spirits supplier', true),
('CDA',    'alcohol', 'CDA — spirits & liqueurs supplier', true),
('LH/S&A', 'alcohol', 'LH/S&A — spirits supplier', true),
('Sunny',  'alcohol', 'Sunny — Tuak supplier', true)
ON CONFLICT DO NOTHING;
