-- Party inventory mutations and custody transfers use the owner-only Campaign audit stream.
UPDATE public.campaign_events
SET visibility = 'OWNER'
WHERE kind = 'CUSTODY_TRANSFER'
  AND visibility <> 'OWNER';

DELETE FROM public.campaign_events
WHERE visibility = 'OWNER'
  AND kind IN ('CUSTODY_TRANSFER', 'PARTY_ITEM_ADD', 'PARTY_ITEM_UPDATE', 'PARTY_ITEM_CONSUME', 'PARTY_ITEM_REMOVE', 'PARTY_CURRENCY_ADJUST')
  AND created_at < now() - interval '180 days';

CREATE INDEX IF NOT EXISTS campaign_events_inventory_retention_idx
  ON public.campaign_events (campaign_id, created_at DESC, id DESC)
  WHERE kind IN ('CUSTODY_TRANSFER', 'PARTY_ITEM_ADD', 'PARTY_ITEM_UPDATE', 'PARTY_ITEM_CONSUME', 'PARTY_ITEM_REMOVE', 'PARTY_CURRENCY_ADJUST');

CREATE OR REPLACE FUNCTION public.prune_campaign_inventory_audit_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  DELETE FROM public.campaign_events
  WHERE campaign_id = NEW.campaign_id
    AND visibility = 'OWNER'
    AND kind IN ('CUSTODY_TRANSFER', 'PARTY_ITEM_ADD', 'PARTY_ITEM_UPDATE', 'PARTY_ITEM_CONSUME', 'PARTY_ITEM_REMOVE', 'PARTY_CURRENCY_ADJUST')
    AND created_at < now() - interval '180 days';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prune_campaign_inventory_audit_events() FROM PUBLIC;
DROP TRIGGER IF EXISTS campaign_events_prune_inventory_audit ON public.campaign_events;
CREATE TRIGGER campaign_events_prune_inventory_audit
  AFTER INSERT ON public.campaign_events
  FOR EACH ROW
  WHEN (NEW.kind IN ('CUSTODY_TRANSFER', 'PARTY_ITEM_ADD', 'PARTY_ITEM_UPDATE', 'PARTY_ITEM_CONSUME', 'PARTY_ITEM_REMOVE', 'PARTY_CURRENCY_ADJUST'))
  EXECUTE FUNCTION public.prune_campaign_inventory_audit_events();
