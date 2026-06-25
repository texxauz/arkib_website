-- Run this in Supabase SQL Editor AFTER bar_inventory.sql

CREATE TABLE IF NOT EXISTS public.bar_premix_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premix_name TEXT NOT NULL,
  ingredient_name TEXT NOT NULL,
  ingredient_type TEXT NOT NULL CHECK (ingredient_type IN ('infusion', 'spirit')),
  ml_per_serve NUMERIC(8,2) NOT NULL
);

ALTER TABLE public.bar_premix_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_bar_premix_recipes" ON public.bar_premix_recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Recipes: only spirits & infusions that are tracked in bar_spirits / bar_infusions
INSERT INTO public.bar_premix_recipes (premix_name, ingredient_name, ingredient_type, ml_per_serve) VALUES

-- Watermelon Log
('Watermelon Log Premix', 'Asamboi Gin', 'infusion', 25),
('Watermelon Log Premix', 'Roselle Tuak', 'infusion', 15),

-- Liang Cha Register
('Liang Cha Register Premix', 'Chrysanthemum Whisky', 'infusion', 30),
('Liang Cha Register Premix', 'Kumquat Fino Sherry', 'infusion', 10),

-- Bandung Folio
('Bandung Folio Premix', 'Lychee Gin', 'infusion', 45),
('Bandung Folio Premix', 'Lush Lychee', 'spirit', 5),
('Bandung Folio Premix', 'Hofman Peach', 'spirit', 10),

-- Sarsi Record
('Sarsi Record Premix', 'Calamansi Tuak', 'infusion', 10),
('Sarsi Record Premix', 'Mount Gay Eclipse', 'spirit', 45),
('Sarsi Record Premix', 'Laphroaig Islay Single Malt', 'spirit', 5),

-- Keluak Entry
('Keluak Entry Premix', 'Lemongrass Gin', 'infusion', 40),
('Keluak Entry Premix', 'Keluak Oloroso Sherry', 'infusion', 10),
('Keluak Entry Premix', 'Licor Beirao', 'spirit', 10),

-- Eggplant Margin
('Eggplant Margin Premix', 'Eggplant Tequila & Mezcal Blend', 'infusion', 50),
('Eggplant Margin Premix', 'Eldoria Elderflower', 'spirit', 10),

-- Satay Ledger
('Satay Ledger Premix', 'Satay-Washed Whisky', 'infusion', 30),
('Satay Ledger Premix', 'Ancho Reyes Chile', 'spirit', 10),

-- Jagung Manuscript
('Jagung Manuscript Premix', 'Lapsang Souchong Rum', 'infusion', 30),
('Jagung Manuscript Premix', 'Mount Gay Eclipse', 'spirit', 15),

-- Cendol Registry
('Cendol Registry Premix', 'Pandan Gin', 'infusion', 45),
('Cendol Registry Premix', 'Thoquino Cachaca', 'spirit', 15),

-- Kopi Memorandum
('Kopi Memorandum Premix', 'Brown Butter Whisky', 'infusion', 50),
('Kopi Memorandum Premix', 'Taylor''s Fine Tawny Port', 'spirit', 20),

-- Lassi Archive
('Lassi Archive Premix', 'Mango Rum', 'infusion', 55),
('Lassi Archive Premix', 'Strega', 'spirit', 5),

-- Coconut Footnote
('Coconut Footnote Premix', 'Vanilla Cascara Whisky', 'infusion', 50),
('Coconut Footnote Premix', 'Black Cardamom Sweet Vermouth', 'infusion', 20),

-- Milo Memoir
('Milo Memoir Premix', 'Jack Daniel''s', 'spirit', 25),
('Milo Memoir Premix', 'Mount Gay Eclipse', 'spirit', 25),
('Milo Memoir Premix', 'Mozart Chocolate', 'spirit', 5),

-- Seri Muka Index
('Seri Muka Index Premix', 'Butterfly Pea Gin', 'infusion', 45),
('Seri Muka Index Premix', 'Fig Leaf Tuak', 'infusion', 20),
('Seri Muka Index Premix', 'Salers Gentiane', 'spirit', 15),

-- Laksa Confidential
('Laksa Confidential Premix', 'Coconut Oil Tequila', 'infusion', 50),
('Laksa Confidential Premix', 'Galangal Turmeric Gin', 'infusion', 20),
('Laksa Confidential Premix', 'Laksa Leaf Vermouth', 'infusion', 10),

-- Pisang Addendum
('Pisang Addendum Premix', 'Banana Brandy', 'infusion', 55),
('Pisang Addendum Premix', 'Lustau Wine Olorosso Don Nuno', 'spirit', 10);
