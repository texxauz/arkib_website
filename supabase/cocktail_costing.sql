-- ============================================================
-- COCKTAIL COSTING DATA
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── INGREDIENTS ───────────────────────────────────────────
-- cost_per_unit is auto-computed as cost_per_bottle / bottle_size_ml

INSERT INTO public.ingredients (name, category, unit, bottle_size_ml, cost_per_bottle, current_stock, min_stock_level, is_active) VALUES

-- House Infusions
('Asamboi Gin', 'spirits', 'ml', 100, 24.00, 0, 0, true),
('Chrysanthemum Whisky', 'spirits', 'ml', 100, 25.00, 0, 0, true),
('Kumquat Fino Sherry', 'spirits', 'ml', 100, 16.00, 0, 0, true),
('Lychee Gin', 'spirits', 'ml', 100, 14.00, 0, 0, true),
('Calamansi Tuak', 'spirits', 'ml', 100, 6.00, 0, 0, true),
('Lemongrass Gin', 'spirits', 'ml', 100, 23.50, 0, 0, true),
('Keluak Oloroso Sherry', 'spirits', 'ml', 100, 23.70, 0, 0, true),
('Eggplant Tequila', 'spirits', 'ml', 100, 22.23, 0, 0, true),
('Eggplant Mezcal', 'spirits', 'ml', 100, 28.70, 0, 0, true),
('Satay Whisky', 'spirits', 'ml', 100, 25.00, 0, 0, true),
('Lapsang Souchong Rum', 'spirits', 'ml', 100, 26.25, 0, 0, true),
('Pandan Gin', 'spirits', 'ml', 100, 23.49, 0, 0, true),
('Brown Butter Whisky', 'spirits', 'ml', 100, 24.00, 0, 0, true),
('Vanilla Cascara Whisky', 'spirits', 'ml', 100, 24.12, 0, 0, true),
('Black Cardamom Vermouth', 'spirits', 'ml', 100, 18.55, 0, 0, true),
('Butterfly Pea Gin', 'spirits', 'ml', 100, 23.49, 0, 0, true),
('Fig Leaf Tuak', 'spirits', 'ml', 100, 4.00, 0, 0, true),
('Coconut Oil Tequila', 'spirits', 'ml', 100, 22.22, 0, 0, true),
('Galangal Turmeric Gin', 'spirits', 'ml', 100, 23.55, 0, 0, true),
('Laksa Leaf Vermouth Dry', 'spirits', 'ml', 100, 19.20, 0, 0, true),
('Laksa Leaf Vermouth Rosso', 'spirits', 'ml', 100, 17.00, 0, 0, true),
('Banana Brandy', 'spirits', 'ml', 100, 24.55, 0, 0, true),
('Parmesan Whisky', 'spirits', 'ml', 100, 24.10, 0, 0, true),
('Roselle Tuak', 'spirits', 'ml', 100, 4.00, 0, 0, true),

-- Commercial Spirits & Liqueurs
('Greather Than Gin', 'spirits', 'ml', 700, 164.80, 0, 0, true),
('Black & White Blended Whisky', 'spirits', 'ml', 700, 168.80, 0, 0, true),
('Mount Gay Eclipse Rum', 'spirits', 'ml', 700, 175.00, 0, 0, true),
('Laphroaig 10 Yrs', 'spirits', 'ml', 750, 272.00, 0, 0, true),
('Cachaca Thoquino', 'spirits', 'ml', 700, 193.00, 0, 0, true),
('Jack Daniel''s No.7', 'spirits', 'ml', 750, 180.00, 0, 0, true),
('Pierre Ferrand Orange Curacao', 'liqueur', 'ml', 700, 158.00, 0, 0, true),
('Mozart Dark Chocolate', 'liqueur', 'ml', 500, 125.00, 0, 0, true),
('Salers Gentiane', 'spirits', 'ml', 1000, 140.00, 0, 0, true),
('Licor Beirao', 'liqueur', 'ml', 700, 125.00, 0, 0, true),
('Eldoria Elderflower Liqueur', 'liqueur', 'ml', 700, 120.80, 0, 0, true),
('Lush Lychee Liqueur', 'liqueur', 'ml', 700, 98.40, 0, 0, true),
('Hofman Peach Liqueur', 'liqueur', 'ml', 700, 98.40, 0, 0, true),
('Quevedo Ruby Port Wine', 'wine', 'ml', 750, 120.00, 0, 0, true),
('Strega', 'liqueur', 'ml', 700, 215.00, 0, 0, true),
('Lustau Oloroso Sherry', 'spirits', 'ml', 750, 178.00, 0, 0, true),
('Angostura Aromatic Bitters', 'other', 'ml', 200, 77.00, 0, 0, true),
('Angostura Cocoa Bitters', 'other', 'ml', 100, 48.00, 0, 0, true),
('Angostura Orange Bitters', 'other', 'ml', 100, 48.00, 0, 0, true),
('Peychaud''s Bitters', 'other', 'ml', 148, 55.00, 0, 0, true),
('Ancho Reyes Chili Liqueur', 'liqueur', 'ml', 700, 220.00, 0, 0, true),
('Absinthe Angelique Verte Suisse', 'spirits', 'ml', 700, 310.00, 0, 0, true),
('Coconut Falernum', 'liqueur', 'ml', 100, 20.00, 0, 0, true),

-- Mixers & Non-Alcoholic
('Saline Solution', 'other', 'ml', 100, 10.00, 0, 0, true),
('Watermelon Juice', 'juice', 'ml', 100, 1.00, 0, 0, true),
('Schweppes Tonic', 'other', 'ml', 100, 0.70, 0, 0, true),
('Tartaric Acid', 'syrup', 'ml', 100, 2.00, 0, 0, true),
('Fresh Milk', 'other', 'ml', 100, 1.11, 0, 0, true),
('Air Mata Kuching', 'other', 'ml', 100, 0.45, 0, 0, true),
('Citric Acid', 'syrup', 'ml', 100, 2.00, 0, 0, true),
('Long Chan Sarsi', 'other', 'ml', 100, 0.73, 0, 0, true),
('Milk Oolong Tea', 'other', 'ml', 100, 0.27, 0, 0, true),
('Rose Syrup', 'syrup', 'ml', 100, 2.00, 0, 0, true),
('Malic Acid', 'syrup', 'ml', 100, 2.00, 0, 0, true),
('Cold Brew Coffee', 'other', 'ml', 100, 1.67, 0, 0, true),
('Tamarind Syrup', 'syrup', 'ml', 100, 1.50, 0, 0, true),
('Peanut Orgeat', 'syrup', 'ml', 100, 1.25, 0, 0, true),
('Sweet Corn Orgeat', 'syrup', 'ml', 100, 1.50, 0, 0, true),
('Ginger Honey', 'syrup', 'ml', 100, 2.50, 0, 0, true),
('Eggplant Puree', 'juice', 'ml', 100, 1.00, 0, 0, true),
('Stillabunt Foamer', 'other', 'ml', 100, 40.00, 0, 0, true),
('Milo Milk', 'other', 'ml', 100, 1.25, 0, 0, true),
('Pumpkin Foam', 'other', 'ml', 100, 1.00, 0, 0, true),
('Shrimp Chili Bitters', 'other', 'ml', 100, 50.00, 0, 0, true),
('Gula Melaka', 'syrup', 'ml', 100, 1.00, 0, 0, true),
('Lemon Juice', 'juice', 'ml', 100, 3.00, 0, 0, true),
('Lime Juice', 'juice', 'ml', 100, 2.67, 0, 0, true),
('Coconut Water', 'juice', 'ml', 100, 1.33, 0, 0, true),
('Coconut Milk', 'juice', 'ml', 100, 0.67, 0, 0, true),
('Red Bean Puree', 'other', 'ml', 100, 0.33, 0, 0, true),
('Bunga Kantan Spritz', 'other', 'ml', 100, 100.00, 0, 0, true),

-- Garnishes & Solid Items (bottle_size_ml=1 so cost_per_unit = cost_per_bottle)
('Filter Paper', 'garnish', 'pc', 1, 0.10, 0, 0, true),
('CO2', 'other', 'pc', 1, 0.20, 0, 0, true),
('Pickled Watermelon Rind', 'garnish', 'pc', 1, 0.20, 0, 0, true),
('Lemon Peel', 'garnish', 'pc', 1, 0.10, 0, 0, true),
('Mint Sprig', 'garnish', 'g', 1, 0.25, 0, 0, true),
('Pandan Leaf', 'garnish', 'pc', 1, 0.10, 0, 0, true),
('Longan', 'garnish', 'pc', 1, 0.20, 0, 0, true),
('Cincau', 'garnish', 'pc', 1, 0.20, 0, 0, true),
('Basil Seeds', 'garnish', 'g', 1, 0.10, 0, 0, true),
('Cendol Jelly', 'garnish', 'pc', 1, 0.15, 0, 0, true),
('Coconut Gelato', 'other', 'scoop', 1, 1.00, 0, 0, true),
('Luxardo Candied Cherry', 'garnish', 'pc', 1, 0.25, 0, 0, true),
('Orange Peel', 'garnish', 'pc', 1, 0.10, 0, 0, true),
('Hup Seng Cream Cracker', 'garnish', 'pc', 1, 0.15, 0, 0, true),
('Kaya Jam', 'garnish', 'pc', 1, 0.15, 0, 0, true),
('Jackfruit Foam', 'garnish', 'pc', 1, 1.00, 0, 0, true),
('Lime Zest', 'garnish', 'pc', 1, 0.10, 0, 0, true),
('Cucumber Jelly', 'garnish', 'pc', 1, 0.40, 0, 0, true),
('Lemongrass Garnish', 'garnish', 'g', 1, 0.15, 0, 0, true),
('Milo Cookie', 'garnish', 'pc', 1, 0.20, 0, 0, true),
('Dehydrated Orange Wheel', 'garnish', 'pc', 1, 0.10, 0, 0, true),
('Brown Rice Cracker', 'garnish', 'pc', 1, 0.25, 0, 0, true),
('Kaffir Lime Leaf', 'garnish', 'pc', 1, 0.15, 0, 0, true),
('Coconut Flakes', 'garnish', 'g', 1, 0.06, 0, 0, true),
('Coriander', 'garnish', 'g', 1, 0.15, 0, 0, true),
('Banana Leaf', 'garnish', 'pc', 1, 0.10, 0, 0, true),
('Coconut Dodol', 'garnish', 'pc', 1, 0.40, 0, 0, true),
('Lemon Wedge', 'garnish', 'pc', 1, 0.30, 0, 0, true),
('Eggplant Chip', 'garnish', 'pc', 1, 0.50, 0, 0, true),
('Dark Chocolate Paint', 'garnish', 'g', 1, 0.10, 0, 0, true),
('Sesame Seeds', 'garnish', 'g', 1, 0.10, 0, 0, true),
('Pandan Sago', 'garnish', 'pc', 1, 0.40, 0, 0, true)

ON CONFLICT (name) DO NOTHING;

-- ── COCKTAILS ─────────────────────────────────────────────
-- other_cost = 10% variance buffer (as per costing sheet)

INSERT INTO public.cocktails (name, selling_price, garnish_cost, ice_cost, other_cost, total_cost, gross_profit, profit_margin, is_active, is_on_menu) VALUES
('Watermelon Log',   55.00, 0, 0, 1.49, 16.38, 38.62, 70.2, true, true),
('Liang Cha Register', 55.00, 0, 0, 1.52, 16.74, 38.26, 69.6, true, true),
('Bandung Folio',    55.00, 0, 0, 1.02, 11.23, 43.77, 79.6, true, true),
('Sarsi Record',     55.00, 0, 0, 1.60, 17.56, 37.44, 68.1, true, true),
('Keluak Entry',     55.00, 0, 0, 1.46, 16.07, 38.93, 70.8, true, true),
('Eggplant Margin',  55.00, 0, 0, 1.54, 16.93, 38.07, 69.2, true, true),
('Satay Ledger',     55.00, 0, 0, 1.77, 19.41, 35.59, 64.7, true, true),
('Jagung Manuscript',55.00, 0, 0, 1.66, 18.26, 36.74, 66.8, true, true),
('Cendol Registry',  55.00, 0, 0, 1.64, 18.00, 37.00, 67.3, true, true),
('Kopi Memorandum',  55.00, 0, 0, 1.67, 18.37, 36.63, 66.6, true, true),
('Coconut Footnote', 55.00, 0, 0, 1.77, 19.41, 35.59, 64.7, true, true),
('Milo Memoir',      58.00, 0, 0, 1.60, 17.61, 40.39, 69.6, true, true),
('Seri Muka Index',  58.00, 0, 0, 1.47, 16.14, 41.86, 72.2, true, true),
('Laksa Confidential',65.00, 0, 0, 1.92, 21.15, 43.85, 67.5, true, true),
('Pisang Addendum',  58.00, 0, 0, 2.02, 22.26, 35.74, 61.6, true, true)

ON CONFLICT (name) DO NOTHING;

-- ── COCKTAIL RECIPES ──────────────────────────────────────

-- WATERMELON LOG
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Asamboi Gin'), 25 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Asamboi Gin');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Greather Than Gin'), 25 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Greather Than Gin');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Roselle Tuak'), 15 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Roselle Tuak');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Watermelon Juice'), 50 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Watermelon Juice');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Schweppes Tonic'), 50 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Schweppes Tonic');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Tartaric Acid'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Tartaric Acid');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Fresh Milk'), 45 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Fresh Milk');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Filter Paper'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Filter Paper');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='CO2'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='CO2');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Pickled Watermelon Rind'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Pickled Watermelon Rind');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Lemon Peel'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemon Peel');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Watermelon Log'), (SELECT id FROM ingredients WHERE name='Mint Sprig'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Watermelon Log') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Mint Sprig');

-- LIANG CHA REGISTER
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Liang Cha Register'), (SELECT id FROM ingredients WHERE name='Chrysanthemum Whisky'), 30 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Liang Cha Register') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Chrysanthemum Whisky');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Liang Cha Register'), (SELECT id FROM ingredients WHERE name='Black & White Blended Whisky'), 20 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Liang Cha Register') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Black & White Blended Whisky');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Liang Cha Register'), (SELECT id FROM ingredients WHERE name='Kumquat Fino Sherry'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Liang Cha Register') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Kumquat Fino Sherry');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Liang Cha Register'), (SELECT id FROM ingredients WHERE name='Air Mata Kuching'), 110 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Liang Cha Register') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Air Mata Kuching');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Liang Cha Register'), (SELECT id FROM ingredients WHERE name='Citric Acid'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Liang Cha Register') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Citric Acid');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Liang Cha Register'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Liang Cha Register') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Liang Cha Register'), (SELECT id FROM ingredients WHERE name='CO2'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Liang Cha Register') AND EXISTS (SELECT 1 FROM ingredients WHERE name='CO2');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Liang Cha Register'), (SELECT id FROM ingredients WHERE name='Pandan Leaf'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Liang Cha Register') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Pandan Leaf');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Liang Cha Register'), (SELECT id FROM ingredients WHERE name='Longan'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Liang Cha Register') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Longan');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Liang Cha Register'), (SELECT id FROM ingredients WHERE name='Lemon Peel'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Liang Cha Register') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemon Peel');

-- BANDUNG FOLIO
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='Lychee Gin'), 45 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lychee Gin');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='Lush Lychee Liqueur'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lush Lychee Liqueur');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='Hofman Peach Liqueur'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Hofman Peach Liqueur');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='Rose Syrup'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Rose Syrup');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='Malic Acid'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Malic Acid');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='Milk Oolong Tea'), 110 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Milk Oolong Tea');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='Filter Paper'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Filter Paper');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='CO2'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='CO2');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='Cincau'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Cincau');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Bandung Folio'), (SELECT id FROM ingredients WHERE name='Basil Seeds'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Bandung Folio') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Basil Seeds');

-- SARSI RECORD
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Sarsi Record'), (SELECT id FROM ingredients WHERE name='Mount Gay Eclipse Rum'), 45 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Sarsi Record') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Mount Gay Eclipse Rum');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Sarsi Record'), (SELECT id FROM ingredients WHERE name='Laphroaig 10 Yrs'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Sarsi Record') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Laphroaig 10 Yrs');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Sarsi Record'), (SELECT id FROM ingredients WHERE name='Calamansi Tuak'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Sarsi Record') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Calamansi Tuak');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Sarsi Record'), (SELECT id FROM ingredients WHERE name='Citric Acid'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Sarsi Record') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Citric Acid');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Sarsi Record'), (SELECT id FROM ingredients WHERE name='Long Chan Sarsi'), 110 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Sarsi Record') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Long Chan Sarsi');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Sarsi Record'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Sarsi Record') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Sarsi Record'), (SELECT id FROM ingredients WHERE name='CO2'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Sarsi Record') AND EXISTS (SELECT 1 FROM ingredients WHERE name='CO2');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Sarsi Record'), (SELECT id FROM ingredients WHERE name='Jackfruit Foam'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Sarsi Record') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Jackfruit Foam');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Sarsi Record'), (SELECT id FROM ingredients WHERE name='Lime Zest'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Sarsi Record') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lime Zest');

-- KELUAK ENTRY
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Keluak Entry'), (SELECT id FROM ingredients WHERE name='Lemongrass Gin'), 40 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Keluak Entry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemongrass Gin');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Keluak Entry'), (SELECT id FROM ingredients WHERE name='Keluak Oloroso Sherry'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Keluak Entry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Keluak Oloroso Sherry');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Keluak Entry'), (SELECT id FROM ingredients WHERE name='Licor Beirao'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Keluak Entry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Licor Beirao');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Keluak Entry'), (SELECT id FROM ingredients WHERE name='Tamarind Syrup'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Keluak Entry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Tamarind Syrup');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Keluak Entry'), (SELECT id FROM ingredients WHERE name='Lime Juice'), 15 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Keluak Entry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lime Juice');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Keluak Entry'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Keluak Entry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Keluak Entry'), (SELECT id FROM ingredients WHERE name='Kaffir Lime Leaf'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Keluak Entry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Kaffir Lime Leaf');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Keluak Entry'), (SELECT id FROM ingredients WHERE name='Brown Rice Cracker'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Keluak Entry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Brown Rice Cracker');

-- EGGPLANT MARGIN
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Eggplant Margin'), (SELECT id FROM ingredients WHERE name='Eggplant Tequila'), 40 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Eggplant Margin') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Eggplant Tequila');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Eggplant Margin'), (SELECT id FROM ingredients WHERE name='Eggplant Mezcal'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Eggplant Margin') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Eggplant Mezcal');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Eggplant Margin'), (SELECT id FROM ingredients WHERE name='Eldoria Elderflower Liqueur'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Eggplant Margin') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Eldoria Elderflower Liqueur');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Eggplant Margin'), (SELECT id FROM ingredients WHERE name='Ginger Honey'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Eggplant Margin') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Ginger Honey');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Eggplant Margin'), (SELECT id FROM ingredients WHERE name='Eggplant Puree'), 50 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Eggplant Margin') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Eggplant Puree');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Eggplant Margin'), (SELECT id FROM ingredients WHERE name='Lime Juice'), 15 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Eggplant Margin') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lime Juice');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Eggplant Margin'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Eggplant Margin') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Eggplant Margin'), (SELECT id FROM ingredients WHERE name='Coriander'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Eggplant Margin') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Coriander');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Eggplant Margin'), (SELECT id FROM ingredients WHERE name='Eggplant Chip'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Eggplant Margin') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Eggplant Chip');

-- SATAY LEDGER
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Satay Ledger'), (SELECT id FROM ingredients WHERE name='Satay Whisky'), 40 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Satay Ledger') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Satay Whisky');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Satay Ledger'), (SELECT id FROM ingredients WHERE name='Black & White Blended Whisky'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Satay Ledger') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Black & White Blended Whisky');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Satay Ledger'), (SELECT id FROM ingredients WHERE name='Ancho Reyes Chili Liqueur'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Satay Ledger') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Ancho Reyes Chili Liqueur');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Satay Ledger'), (SELECT id FROM ingredients WHERE name='Peanut Orgeat'), 20 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Satay Ledger') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Peanut Orgeat');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Satay Ledger'), (SELECT id FROM ingredients WHERE name='Lemon Juice'), 15 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Satay Ledger') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemon Juice');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Satay Ledger'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Satay Ledger') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Satay Ledger'), (SELECT id FROM ingredients WHERE name='Stillabunt Foamer'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Satay Ledger') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Stillabunt Foamer');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Satay Ledger'), (SELECT id FROM ingredients WHERE name='Lemongrass Garnish'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Satay Ledger') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemongrass Garnish');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Satay Ledger'), (SELECT id FROM ingredients WHERE name='Cucumber Jelly'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Satay Ledger') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Cucumber Jelly');

-- JAGUNG MANUSCRIPT
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Jagung Manuscript'), (SELECT id FROM ingredients WHERE name='Lapsang Souchong Rum'), 40 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Jagung Manuscript') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lapsang Souchong Rum');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Jagung Manuscript'), (SELECT id FROM ingredients WHERE name='Mount Gay Eclipse Rum'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Jagung Manuscript') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Mount Gay Eclipse Rum');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Jagung Manuscript'), (SELECT id FROM ingredients WHERE name='Coconut Falernum'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Jagung Manuscript') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Coconut Falernum');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Jagung Manuscript'), (SELECT id FROM ingredients WHERE name='Sweet Corn Orgeat'), 20 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Jagung Manuscript') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Sweet Corn Orgeat');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Jagung Manuscript'), (SELECT id FROM ingredients WHERE name='Lemon Juice'), 15 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Jagung Manuscript') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemon Juice');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Jagung Manuscript'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Jagung Manuscript') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Jagung Manuscript'), (SELECT id FROM ingredients WHERE name='Banana Leaf'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Jagung Manuscript') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Banana Leaf');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Jagung Manuscript'), (SELECT id FROM ingredients WHERE name='Coconut Dodol'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Jagung Manuscript') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Coconut Dodol');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Jagung Manuscript'), (SELECT id FROM ingredients WHERE name='Lemon Wedge'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Jagung Manuscript') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemon Wedge');

-- CENDOL REGISTRY
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Pandan Gin'), 45 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Pandan Gin');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Cachaca Thoquino'), 15 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Cachaca Thoquino');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Gula Melaka'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Gula Melaka');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Lemon Juice'), 7.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemon Juice');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Red Bean Puree'), 60 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Red Bean Puree');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Coconut Water'), 30 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Coconut Water');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Coconut Milk'), 30 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Coconut Milk');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Filter Paper'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Filter Paper');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Cendol Jelly'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Cendol Jelly');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Cendol Registry'), (SELECT id FROM ingredients WHERE name='Lemon Peel'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Cendol Registry') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemon Peel');

-- KOPI MEMORANDUM
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Kopi Memorandum'), (SELECT id FROM ingredients WHERE name='Brown Butter Whisky'), 50 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Kopi Memorandum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Brown Butter Whisky');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Kopi Memorandum'), (SELECT id FROM ingredients WHERE name='Quevedo Ruby Port Wine'), 20 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Kopi Memorandum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Quevedo Ruby Port Wine');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Kopi Memorandum'), (SELECT id FROM ingredients WHERE name='Gula Melaka'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Kopi Memorandum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Gula Melaka');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Kopi Memorandum'), (SELECT id FROM ingredients WHERE name='Cold Brew Coffee'), 30 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Kopi Memorandum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Cold Brew Coffee');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Kopi Memorandum'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Kopi Memorandum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Kopi Memorandum'), (SELECT id FROM ingredients WHERE name='Stillabunt Foamer'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Kopi Memorandum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Stillabunt Foamer');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Kopi Memorandum'), (SELECT id FROM ingredients WHERE name='Hup Seng Cream Cracker'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Kopi Memorandum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Hup Seng Cream Cracker');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Kopi Memorandum'), (SELECT id FROM ingredients WHERE name='Kaya Jam'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Kopi Memorandum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Kaya Jam');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Kopi Memorandum'), (SELECT id FROM ingredients WHERE name='Lemon Peel'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Kopi Memorandum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemon Peel');

-- COCONUT FOOTNOTE
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Coconut Footnote'), (SELECT id FROM ingredients WHERE name='Vanilla Cascara Whisky'), 50 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Coconut Footnote') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Vanilla Cascara Whisky');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Coconut Footnote'), (SELECT id FROM ingredients WHERE name='Black Cardamom Vermouth'), 20 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Coconut Footnote') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Black Cardamom Vermouth');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Coconut Footnote'), (SELECT id FROM ingredients WHERE name='Angostura Aromatic Bitters'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Coconut Footnote') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Angostura Aromatic Bitters');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Coconut Footnote'), (SELECT id FROM ingredients WHERE name='Angostura Orange Bitters'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Coconut Footnote') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Angostura Orange Bitters');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Coconut Footnote'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Coconut Footnote') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Coconut Footnote'), (SELECT id FROM ingredients WHERE name='Coconut Gelato'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Coconut Footnote') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Coconut Gelato');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Coconut Footnote'), (SELECT id FROM ingredients WHERE name='Luxardo Candied Cherry'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Coconut Footnote') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Luxardo Candied Cherry');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Coconut Footnote'), (SELECT id FROM ingredients WHERE name='Orange Peel'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Coconut Footnote') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Orange Peel');

-- MILO MEMOIR
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Mount Gay Eclipse Rum'), 25 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Mount Gay Eclipse Rum');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Jack Daniel''s No.7'), 25 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Jack Daniel''s No.7');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Pierre Ferrand Orange Curacao'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Pierre Ferrand Orange Curacao');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Mozart Dark Chocolate'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Mozart Dark Chocolate');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Lemon Juice'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemon Juice');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Angostura Cocoa Bitters'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Angostura Cocoa Bitters');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Milo Milk'), 20 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Milo Milk');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Filter Paper'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Filter Paper');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Milo Cookie'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Milo Cookie');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Milo Memoir'), (SELECT id FROM ingredients WHERE name='Dehydrated Orange Wheel'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Milo Memoir') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Dehydrated Orange Wheel');

-- SERI MUKA INDEX
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Seri Muka Index'), (SELECT id FROM ingredients WHERE name='Butterfly Pea Gin'), 45 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Seri Muka Index') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Butterfly Pea Gin');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Seri Muka Index'), (SELECT id FROM ingredients WHERE name='Fig Leaf Tuak'), 25 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Seri Muka Index') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Fig Leaf Tuak');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Seri Muka Index'), (SELECT id FROM ingredients WHERE name='Salers Gentiane'), 15 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Seri Muka Index') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Salers Gentiane');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Seri Muka Index'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Seri Muka Index') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Seri Muka Index'), (SELECT id FROM ingredients WHERE name='Pumpkin Foam'), 60 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Seri Muka Index') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Pumpkin Foam');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Seri Muka Index'), (SELECT id FROM ingredients WHERE name='Coconut Flakes'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Seri Muka Index') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Coconut Flakes');

-- LAKSA CONFIDENTIAL
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Laksa Confidential'), (SELECT id FROM ingredients WHERE name='Coconut Oil Tequila'), 50 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Laksa Confidential') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Coconut Oil Tequila');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Laksa Confidential'), (SELECT id FROM ingredients WHERE name='Galangal Turmeric Gin'), 20 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Laksa Confidential') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Galangal Turmeric Gin');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Laksa Confidential'), (SELECT id FROM ingredients WHERE name='Laksa Leaf Vermouth Dry'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Laksa Confidential') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Laksa Leaf Vermouth Dry');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Laksa Confidential'), (SELECT id FROM ingredients WHERE name='Laksa Leaf Vermouth Rosso'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Laksa Confidential') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Laksa Leaf Vermouth Rosso');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Laksa Confidential'), (SELECT id FROM ingredients WHERE name='Shrimp Chili Bitters'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Laksa Confidential') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Shrimp Chili Bitters');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Laksa Confidential'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Laksa Confidential') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Laksa Confidential'), (SELECT id FROM ingredients WHERE name='Bunga Kantan Spritz'), 0.5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Laksa Confidential') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Bunga Kantan Spritz');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Laksa Confidential'), (SELECT id FROM ingredients WHERE name='Lemon Peel'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Laksa Confidential') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lemon Peel');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Laksa Confidential'), (SELECT id FROM ingredients WHERE name='Pandan Sago'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Laksa Confidential') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Pandan Sago');

-- PISANG ADDENDUM
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Pisang Addendum'), (SELECT id FROM ingredients WHERE name='Banana Brandy'), 55 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Pisang Addendum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Banana Brandy');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Pisang Addendum'), (SELECT id FROM ingredients WHERE name='Lustau Oloroso Sherry'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Pisang Addendum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Lustau Oloroso Sherry');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Pisang Addendum'), (SELECT id FROM ingredients WHERE name='Parmesan Whisky'), 10 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Pisang Addendum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Parmesan Whisky');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Pisang Addendum'), (SELECT id FROM ingredients WHERE name='Peychaud''s Bitters'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Pisang Addendum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Peychaud''s Bitters');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Pisang Addendum'), (SELECT id FROM ingredients WHERE name='Absinthe Angelique Verte Suisse'), 2 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Pisang Addendum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Absinthe Angelique Verte Suisse');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Pisang Addendum'), (SELECT id FROM ingredients WHERE name='Saline Solution'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Pisang Addendum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Saline Solution');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Pisang Addendum'), (SELECT id FROM ingredients WHERE name='Dark Chocolate Paint'), 5 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Pisang Addendum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Dark Chocolate Paint');
INSERT INTO public.cocktail_recipes (cocktail_id, ingredient_id, quantity_ml) SELECT (SELECT id FROM cocktails WHERE name='Pisang Addendum'), (SELECT id FROM ingredients WHERE name='Sesame Seeds'), 1 WHERE EXISTS (SELECT 1 FROM cocktails WHERE name='Pisang Addendum') AND EXISTS (SELECT 1 FROM ingredients WHERE name='Sesame Seeds');
