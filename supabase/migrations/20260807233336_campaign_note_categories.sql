ALTER TABLE public.campaign_note_sections
  ADD COLUMN category text NOT NULL DEFAULT 'GENERAL'
  CHECK (category IN ('GENERAL', 'PEOPLE', 'PLACES'));
