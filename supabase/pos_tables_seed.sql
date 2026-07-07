-- Seed floor plan: 2 rooms x 6 tables
INSERT INTO public.pos_tables (name, section, capacity, pos_x, pos_y, sort_order) VALUES
  ('Table 1', 'Barroom', 4, 10, 10, 1),
  ('Table 2', 'Barroom', 4, 40, 10, 2),
  ('Table 3', 'Barroom', 4, 70, 10, 3),
  ('Table 4', 'Barroom', 4, 10, 45, 4),
  ('Table 5', 'Barroom', 4, 40, 45, 5),
  ('Table 6', 'Barroom', 4, 70, 45, 6),
  ('Table 1', 'Stained Glass Room', 4, 10, 10, 1),
  ('Table 2', 'Stained Glass Room', 4, 40, 10, 2),
  ('Table 3', 'Stained Glass Room', 4, 70, 10, 3),
  ('Table 4', 'Stained Glass Room', 4, 10, 45, 4),
  ('Table 5', 'Stained Glass Room', 4, 40, 45, 5),
  ('Table 6', 'Stained Glass Room', 4, 70, 45, 6)
ON CONFLICT DO NOTHING;
