-- ============================================================
-- SPIRITS INVENTORY
-- Removes non-recipe ingredients, adds all spirits from the bar
-- Run AFTER cocktail_costing.sql
-- ============================================================

-- Remove ingredients not used in any cocktail recipe (garnishes, mixers, etc.)
DELETE FROM public.ingredients
WHERE id NOT IN (SELECT ingredient_id FROM public.cocktail_recipes);

-- Upsert all spirits/liqueurs from the spreadsheet
-- ON CONFLICT updates price if the item already exists from cocktail_costing.sql

INSERT INTO public.ingredients (name, category, unit, bottle_size_ml, cost_per_bottle, current_stock, min_stock_level, is_active)
VALUES

-- ── HOUSE COCKTAIL SPIRITS ─────────────────────────────────
('Absinthe Angelique Verte Suisse',  'spirits',  'ml', 700,  310.00,  0, 0, true),
('Ancho Reyes Chili Liqueur',        'liqueur',  'ml', 700,  220.00,  0, 0, true),
('Angostura Aromatic Bitters',       'other',    'ml', 200,  77.00,   0, 0, true),
('Angostura Cocoa Bitters',          'other',    'ml', 100,  48.00,   0, 0, true),
('Angostura Orange Bitters',         'other',    'ml', 100,  48.00,   0, 0, true),
('Black & White Blended Whisky',     'spirits',  'ml', 700,  168.80,  0, 0, true),
('Cachaca Thoquino',                 'spirits',  'ml', 700,  193.00,  0, 0, true),
('Cucielo Vermouth Dry',             'wine',     'ml', 500,  96.00,   0, 0, true),
('Cucielo Vermouth Rosso',           'wine',     'ml', 750,  139.00,  0, 0, true),
('Eldoria Elderflower Liqueur',      'liqueur',  'ml', 700,  120.80,  0, 0, true),
('Herradura Plata Tequila',          'spirits',  'ml', 750,  166.67,  0, 0, true),
('Hofman Peach Liqueur',             'liqueur',  'ml', 700,  98.40,   0, 0, true),
('Jack Daniel''s No.7',              'spirits',  'ml', 750,  180.00,  0, 0, true),
('Laphroaig 10 Yrs',                 'spirits',  'ml', 750,  272.00,  0, 0, true),
('Licor Beirao',                     'liqueur',  'ml', 700,  125.00,  0, 0, true),
('Lillet Blanc',                     'wine',     'ml', 750,  128.00,  0, 0, true),
('Lush Lychee Liqueur',              'liqueur',  'ml', 700,  98.40,   0, 0, true),
('Lustau Fino Sherry',               'wine',     'ml', 750,  120.00,  0, 0, true),
('Lustau Oloroso Sherry',            'wine',     'ml', 750,  178.00,  0, 0, true),
('Matusalem Platino',                'spirits',  'ml', 700,  171.67,  0, 0, true),
('Mount Gay Eclipse Rum',            'spirits',  'ml', 700,  175.00,  0, 0, true),
('Mozart Dark Chocolate',            'liqueur',  'ml', 500,  125.00,  0, 0, true),
('Peychaud''s Bitters',              'other',    'ml', 148,  55.00,   0, 0, true),
('Pierre Ferrand Orange Curacao',    'liqueur',  'ml', 700,  158.00,  0, 0, true),
('Quevedo Ruby Port Wine',           'wine',     'ml', 750,  120.00,  0, 0, true),
('Rooster Rojo Mezcal',              'spirits',  'ml', 700,  200.80,  0, 0, true),
('Salers Gentiane 25%',              'spirits',  'ml', 1000, 140.00,  0, 0, true),
('St.Remy VSOP',                     'spirits',  'ml', 700,  165.00,  0, 0, true),
('Strega',                           'liqueur',  'ml', 700,  215.00,  0, 0, true),
('Stillabunt Magic Velvet Foamer',   'other',    'ml', 100,  40.00,   0, 0, true),
('Tuak',                             'spirits',  'ml', 750,  0.00,    0, 0, true),

-- ── BACK BAR SPIRITS ───────────────────────────────────────
('Angostura Dark 7 Yrs',                        'spirits', 'ml', 700, 207.00,  0, 0, true),
('Bailey''s Irish Cream',                        'liqueur', 'ml', 700, 130.18,  0, 0, true),
('Benedictine D.O.M',                            'liqueur', 'ml', 700, 159.00,  0, 0, true),
('Buffalo Trace Bourbon',                        'spirits', 'ml', 750, 220.00,  0, 0, true),
('Campari',                                      'spirits', 'ml', 700, 136.90,  0, 0, true),
('Corazon Reposado Tequila',                     'spirits', 'ml', 750, 236.00,  0, 0, true),
('Giffard Creme de Cacao White',                 'liqueur', 'ml', 700, 93.00,   0, 0, true),
('Giffard Creme de Framboise',                   'liqueur', 'ml', 700, 93.00,   0, 0, true),
('Giffard Premium Abricot du Rousillon',         'liqueur', 'ml', 700, 110.00,  0, 0, true),
('Giffard Premium Cassis',                       'liqueur', 'ml', 700, 110.00,  0, 0, true),
('Giffard Premium Carribean Pineapple',          'liqueur', 'ml', 700, 110.00,  0, 0, true),
('Giffard Syrup Agave',                          'syrup',   'ml', 700, 72.00,   0, 0, true),
('Izarra Green',                                 'liqueur', 'ml', 700, 210.00,  0, 0, true),
('La Blanche Christian Drouin Clear Calvados',   'spirits', 'ml', 700, 190.00,  0, 0, true),
('Luxardo Amaretto Liqueur',                     'liqueur', 'ml', 700, 135.00,  0, 0, true),
('Luxardo Espresso Liqueur',                     'liqueur', 'ml', 700, 145.00,  0, 0, true),
('Luxardo Maraschino Liqueur',                   'liqueur', 'ml', 700, 160.00,  0, 0, true),
('Pisco Demonio De Los Andes',                   'spirits', 'ml', 700, 215.00,  0, 0, true),
('Tito''s Vodka',                                'spirits', 'ml', 750, 182.00,  0, 0, true),
('Woodford Reserve Rye',                         'spirits', 'ml', 700, 303.00,  0, 0, true)

ON CONFLICT (name) DO UPDATE SET
  cost_per_bottle = EXCLUDED.cost_per_bottle,
  bottle_size_ml  = EXCLUDED.bottle_size_ml,
  is_active       = true;
