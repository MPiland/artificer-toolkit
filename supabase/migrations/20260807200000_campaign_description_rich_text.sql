ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_description_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_description_rich_text_length_check
  CHECK (description IS NULL OR char_length(description) <= 100000);
