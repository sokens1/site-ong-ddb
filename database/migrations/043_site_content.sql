-- ============================================
-- Table site_content : textes et images modifiables depuis
-- Admin > Paramètres > Contenu du site web, sans redéploiement.
-- Clé libre (ex: "hero.subtitle", "hero.image_1") -> valeur (texte ou URL image).
-- ============================================

CREATE TABLE IF NOT EXISTS public.site_content (
  key text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('text', 'image')),
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Lecture publique : le site vitrine doit pouvoir afficher les overrides
-- sans être connecté.
DROP POLICY IF EXISTS "Allow public read access to site_content" ON public.site_content;
CREATE POLICY "Allow public read access to site_content"
ON public.site_content FOR SELECT TO public USING (true);

-- Modification réservée à l'admin et au chargé de communication, comme pour
-- les autres tables de contenu (news, faq, etc. — voir migration 010).
DROP POLICY IF EXISTS "Allow admin/comms modify site_content" ON public.site_content;
CREATE POLICY "Allow admin/comms modify site_content"
ON public.site_content FOR ALL TO authenticated
USING (public.get_my_claim_role() IN ('admin', 'charge_communication'))
WITH CHECK (public.get_my_claim_role() IN ('admin', 'charge_communication'));

-- Realtime : pour que l'admin (et un site déjà ouvert) reflète les
-- changements sans recharger la page.
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_content;
