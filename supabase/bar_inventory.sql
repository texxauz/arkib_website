-- ============================================================
-- BAR INVENTORY SYSTEM
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Bar Spirits (Bottle Inventory)
CREATE TABLE IF NOT EXISTS public.bar_spirits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  bottle_size_ml INTEGER NOT NULL DEFAULT 700,
  full_bottles INTEGER NOT NULL DEFAULT 0,
  open_ml INTEGER NOT NULL DEFAULT 0,
  used_classics_ml INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bar Infusions
CREATE TABLE IF NOT EXISTS public.bar_infusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_spirit TEXT,
  notes TEXT,
  opening_ml INTEGER NOT NULL DEFAULT 0,
  produced_ml INTEGER NOT NULL DEFAULT 0,
  used_premix_ml INTEGER NOT NULL DEFAULT 0,
  wasted_ml INTEGER NOT NULL DEFAULT 0,
  ml_per_serve INTEGER DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Bar Premixes
CREATE TABLE IF NOT EXISTS public.bar_premixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cocktail_name TEXT,
  category TEXT,
  opening_serves INTEGER NOT NULL DEFAULT 0,
  produced_serves INTEGER NOT NULL DEFAULT 0,
  sold_serves INTEGER NOT NULL DEFAULT 0,
  ml_per_serve INTEGER NOT NULL DEFAULT 175,
  storage TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Bar Activity Log
CREATE TABLE IF NOT EXISTS public.bar_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  week_number INTEGER,
  activity_type TEXT NOT NULL,
  product TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  vol_ml INTEGER,
  notes TEXT,
  spirit_1 TEXT,
  vol_1 INTEGER,
  spirit_2 TEXT,
  vol_2 INTEGER,
  spirit_3 TEXT,
  vol_3 INTEGER,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bar_spirits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_infusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_premixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies (authenticated users can read/write)
CREATE POLICY "auth_all_bar_spirits" ON public.bar_spirits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_bar_infusions" ON public.bar_infusions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_bar_premixes" ON public.bar_premixes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_bar_activity_log" ON public.bar_activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA — Spirit Bottle Inventory
-- ============================================================
INSERT INTO public.bar_spirits (name, category, bottle_size_ml, full_bottles, open_ml, used_classics_ml) VALUES
('La Blanche', 'Absinthe', 700, 1, 0, 0),
('La Clandestine Absinthe', 'Absinthe', 700, 0, 425, 0),
('Fernet Branca', 'Amaro', 700, 1, 0, 0),
('Branca Menta', 'Amaro', 700, 1, 0, 0),
('Luxardo Aperitivo', 'Aperitif', 700, 1, 0, 0),
('Campari', 'Aperitif', 700, 0, 650, 40),
('Salers Gentiane', 'Aperitif', 700, 0, 210, 0),
('VSOP St Remy Brandy', 'Brandy', 700, 0, 155, 0),
('Thoquino Cachaca', 'Cachaca', 700, 0, 560, 0),
('Sui Suntory Gin', 'Gin', 700, 0, 300, 75),
('Eden Mill Bourbon Cask', 'Gin', 700, 1, 0, 0),
('Dry Curacao', 'Liqueur', 700, 1, 210, 0),
('Licor Beirao', 'Liqueur', 700, 0, 560, 0),
('Luxardo Maraschino', 'Liqueur', 700, 1, 0, 0),
('Luxardo Amaretto', 'Liqueur', 700, 1, 0, 0),
('Giffard Abricot du Roussillon', 'Liqueur', 700, 1, 0, 0),
('Hofman Peach', 'Liqueur', 700, 0, 150, 0),
('Lush Lychee', 'Liqueur', 700, 0, 265, 0),
('Giffard Depuis', 'Liqueur', 700, 1, 0, 0),
('Mozart Chocolate', 'Liqueur', 700, 1, 140, 0),
('Eldoria Elderflower', 'Liqueur', 700, 1, 140, 0),
('Ancho Reyes Chile', 'Liqueur', 700, 1, 210, 0),
('Strega', 'Liqueur', 700, 0, 560, 0),
('Izarra', 'Liqueur', 700, 1, 0, 0),
('Dom Benedictine', 'Liqueur', 700, 1, 0, 0),
('Luxardo Espresso', 'Liqueur', 700, 0, 490, 0),
('Chartreuse Green', 'Liqueur', 700, 1, 0, 0),
('Baileys', 'Liqueur', 700, 1, 0, 0),
('Rooster Rojo Mezcal', 'Mezcal', 700, 1, 560, 0),
('Demonio Des Los Andes', 'Pisco', 700, 1, 0, 0),
('Taylor''s Fine Tawny Port', 'Port', 700, 1, 140, 0),
('Mount Gay Eclipse', 'Rum', 700, 4, 0, 0),
('Ron Matusalem Platino', 'Rum', 700, 1, 420, 0),
('Angostura Caribbean Rum', 'Rum', 700, 1, 0, 0),
('Diplomatico Rum', 'Rum', 700, 0, 20, 0),
('Matusalem Gran Reserva', 'Rum', 700, 1, 0, 0),
('Lustau Wine Amontillado Los Arcos', 'Sherry (Amontillado)', 700, 1, 420, 0),
('Lustau Wine Fino Del Puerto', 'Sherry (Fino)', 700, 3, 420, 0),
('Lustau Wine Olorosso Don Nuno', 'Sherry (Oloroso)', 700, 1, 350, 0),
('Giffard Agave Syrup', 'Syrup', 700, 1, 0, 0),
('Herradura Tequila', 'Tequila', 700, 2, 0, 0),
('Original Tuak', 'Tuak', 1000, 8, 0, 0),
('Cucielo Vermouth', 'Vermouth', 700, 0, 155, 40),
('Cucielo Vermouth Dry', 'Vermouth (Dry)', 700, 1, 305, 0),
('Martini Rosso Vermouth', 'Vermouth (Sweet)', 700, 2, 0, 0),
('Tito''s Handmade Vodka', 'Vodka', 700, 0, 260, 0),
('Belvedere Vodka', 'Vodka', 700, 0, 350, 0),
('Jack Daniel''s', 'Whisky', 700, 4, 560, 0),
('Black & White Scotch Whisky', 'Whisky', 700, 2, 500, 0),
('A.D. Rattray', 'Whisky', 700, 1, 0, 0),
('Buffalo Trace', 'Whisky', 700, 0, 610, 0),
('Woodford Reserve', 'Whisky', 700, 0, 450, 0),
('Laphroaig Islay Single Malt', 'Whisky', 700, 0, 160, 0),
('AD Rattray Arran 5 Year Sherry Casks', 'Whisky', 700, 1, 0, 0),
('Pinot Noir (Red)', 'Wine', 750, 6, 0, 0),
('Le Beu Sud Cabernet Sauvignon', 'Wine', 750, 6, 0, 0),
('Le Beu Sud Sauvignon Blanc', 'Wine', 750, 4, 0, 0);

-- ============================================================
-- SEED DATA — Infusions
-- ============================================================
INSERT INTO public.bar_infusions (name, base_spirit, opening_ml, produced_ml, used_premix_ml, wasted_ml, ml_per_serve, notes) VALUES
('Asamboi Gin', 'Gin', 110, 0, 0, 0, 25, 'Gin infused with asamboi'),
('Chrysanthemum Whisky', 'Whisky', 295, 0, 0, 0, 30, 'Whisky infused with chrysanthemum'),
('Kumquat Fino Sherry', 'Sherry (Fino)', 185, 0, 0, 0, 10, 'Fino Sherry with kumquat'),
('Lychee Gin', 'Gin', 100, 500, 0, 0, 45, 'Gin infused with lychee'),
('Calamansi Tuak', 'Tuak', 40, 250, 0, 0, 10, 'Tuak infused with calamansi'),
('Lemongrass Gin', 'Gin', 0, 500, 0, 0, 40, 'Gin infused with lemongrass'),
('Keluak Oloroso Sherry', 'Sherry (Oloroso)', 150, 0, 0, 0, 10, 'Oloroso Sherry with keluak'),
('Eggplant Tequila & Mezcal Blend', 'Tequila/Mezcal', 225, 0, 0, 0, 50, 'Tequila+Mezcal blend with eggplant'),
('Satay-Washed Whisky', 'Whisky', 405, 0, 0, 0, 30, 'Fat-washed with satay'),
('Lapsang Souchong Rum', 'Rum', 570, 0, 0, 0, 30, 'Rum infused with lapsang souchong'),
('Pandan Gin', 'Gin', 470, 500, 0, 0, 45, 'Gin infused with pandan'),
('Brown Butter Whisky', 'Whisky', 240, 0, 0, 0, 50, 'Fat-washed with brown butter'),
('Mango Rum', 'Rum', 400, 0, 0, 0, 55, 'Rum infused with mango'),
('Vanilla Cascara Whisky', 'Whisky', 510, 0, 0, 0, 50, 'Whisky infused with vanilla & cascara'),
('Black Cardamom Sweet Vermouth', 'Vermouth (Sweet)', 460, 0, 0, 0, 20, 'Vermouth infused with black cardamom'),
('Butterfly Pea Gin', 'Gin', 470, 0, 0, 0, 45, 'Gin infused with butterfly pea'),
('Fig Leaf Tuak', 'Tuak', 220, 250, 0, 0, 20, 'Tuak infused with fig leaf'),
('Coconut Oil Tequila', 'Tequila', 135, 0, 0, 0, 50, 'Fat-washed with coconut oil'),
('Galangal Turmeric Gin', 'Gin', 410, 350, 0, 0, 20, 'Gin infused with galangal & turmeric'),
('Laksa Leaf Vermouth', 'Vermouth', 280, 0, 0, 0, 10, 'Vermouth infused with laksa leaf'),
('Bunga Kantan Infusion', 'Water/Neutral', 70, 0, 0, 0, NULL, 'Bunga kantan extraction — used as spritz'),
('Roselle Tuak', 'Tuak', 70, 500, 0, 0, 15, NULL),
('Toasted Coconut Falernum', 'Rum', 325, 0, 0, 0, 15, NULL),
('Banana Brandy', 'Brandy', 30, 0, 0, 0, 55, NULL);

-- ============================================================
-- SEED DATA — Premixes (current serves left as of 8 Jun 2026)
-- ============================================================
INSERT INTO public.bar_premixes (name, cocktail_name, category, opening_serves, produced_serves, sold_serves, ml_per_serve, storage) VALUES
('Watermelon Log Premix', 'Watermelon Log', 'Fizzy', 2, 0, 0, 175, 'chiller'),
('Liang Cha Register Premix', 'Liang Cha Register', 'Fizzy', 9, 0, 0, 175, 'chiller'),
('Bandung Folio Premix', 'Bandung Folio', 'Fizzy', 7, 0, 0, 175, 'chiller'),
('Sarsi Record Premix', 'Sarsi Record', 'Fizzy', 8, 0, 0, 175, 'chiller'),
('Keluak Entry Premix', 'Keluak Entry', 'Citrusy', 1, 0, 0, 60, 'chiller'),
('Eggplant Margin Premix', 'Eggplant Margin', 'Citrusy', 3, 0, 0, 70, NULL),
('Satay Ledger Premix', 'Satay Ledger', 'Citrusy', 12, 0, 0, 60, NULL),
('Jagung Manuscript Premix', 'Jagung Manuscript', 'Citrusy', 3, 0, 0, 60, NULL),
('Cendol Registry Premix', 'Cendol Registry', 'Rich', 10, 0, 0, 60, 'chiller'),
('Kopi Memorandum Premix', 'Kopi Memorandum', 'Rich', 4, 0, 0, 70, 'chiller'),
('Lassi Archive Premix', 'Lassi Archive', 'Rich', 2, 0, 0, 60, NULL),
('Coconut Footnote Premix', 'Coconut Footnote', 'Rich', 2, 0, 0, 70, 'freezer'),
('Milo Memoir Premix', 'Milo Memoir', 'Spirit Forward', 15, 0, 0, 60, 'freezer'),
('Seri Muka Index Premix', 'Seri Muka Index', 'Spirit Forward', 9, 0, 0, 80, 'freezer'),
('Laksa Confidential Premix', 'Laksa Confidential', 'Spirit Forward', 3, 0, 0, 80, 'freezer'),
('Pisang Addendum Premix', 'Pisang Addendum', 'Spirit Forward', 6, 0, 0, 75, 'freezer');
