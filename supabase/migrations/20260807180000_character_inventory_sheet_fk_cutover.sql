-- Character Sheet item state follows canonical inventory ownership.
ALTER TABLE public.character_item_adjustments
  DROP CONSTRAINT IF EXISTS character_item_adjustments_item_fkey;
ALTER TABLE public.character_sheet_resource_usage
  DROP CONSTRAINT IF EXISTS character_sheet_resource_usage_item_fkey;

-- Remove rows that cannot be represented by the canonical owner-scoped item FK.
DELETE FROM public.character_item_adjustments AS adjustment
WHERE NOT EXISTS (
  SELECT 1
  FROM public.inventory_items AS item
  JOIN public.inventory_owners AS inventory_owner ON inventory_owner.id = item.owner_id
  WHERE item.id = adjustment.item_instance_id
    AND inventory_owner.kind = 'CHARACTER'
    AND inventory_owner.character_id = adjustment.character_id
);
DELETE FROM public.character_sheet_resource_usage AS usage
WHERE usage.item_instance_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.inventory_items AS item
    JOIN public.inventory_owners AS inventory_owner ON inventory_owner.id = item.owner_id
    WHERE item.id = usage.item_instance_id
      AND inventory_owner.kind = 'CHARACTER'
      AND inventory_owner.character_id = usage.character_id
  );

ALTER TABLE public.character_item_adjustments
  ADD CONSTRAINT character_item_adjustments_item_fkey
  FOREIGN KEY (item_instance_id)
  REFERENCES public.inventory_items (id)
  ON DELETE CASCADE;
ALTER TABLE public.character_sheet_resource_usage
  ADD CONSTRAINT character_sheet_resource_usage_item_fkey
  FOREIGN KEY (item_instance_id)
  REFERENCES public.inventory_items (id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.assert_character_inventory_item_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.item_instance_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_items AS item
    JOIN public.inventory_owners AS inventory_owner ON inventory_owner.id = item.owner_id
    WHERE item.id = NEW.item_instance_id
      AND inventory_owner.kind = 'CHARACTER'
      AND inventory_owner.character_id = NEW.character_id
    FOR KEY SHARE OF item, inventory_owner
  ) THEN
    RAISE EXCEPTION 'Inventory item % does not belong to character %.',
      NEW.item_instance_id,
      NEW.character_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_character_item_sheet_state_on_inventory_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  source_character_id uuid;
BEGIN
  IF OLD.owner_id = NEW.owner_id THEN
    RETURN NEW;
  END IF;

  SELECT inventory_owner.character_id
  INTO source_character_id
  FROM public.inventory_owners AS inventory_owner
  WHERE inventory_owner.id = OLD.owner_id
    AND inventory_owner.kind = 'CHARACTER'
  FOR KEY SHARE;

  IF source_character_id IS NOT NULL THEN
    DELETE FROM public.character_item_adjustments
    WHERE character_id = source_character_id
      AND item_instance_id = OLD.id;

    DELETE FROM public.character_sheet_resource_usage
    WHERE character_id = source_character_id
      AND item_instance_id = OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_character_inventory_item_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_character_item_sheet_state_on_inventory_transfer() FROM PUBLIC;

DROP TRIGGER IF EXISTS character_item_adjustments_inventory_owner ON public.character_item_adjustments;
CREATE TRIGGER character_item_adjustments_inventory_owner
  BEFORE INSERT OR UPDATE OF character_id, item_instance_id ON public.character_item_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.assert_character_inventory_item_owner();

DROP TRIGGER IF EXISTS character_sheet_resource_usage_inventory_owner ON public.character_sheet_resource_usage;
CREATE TRIGGER character_sheet_resource_usage_inventory_owner
  BEFORE INSERT OR UPDATE OF character_id, item_instance_id ON public.character_sheet_resource_usage
  FOR EACH ROW EXECUTE FUNCTION public.assert_character_inventory_item_owner();

DROP TRIGGER IF EXISTS inventory_items_clear_character_item_sheet_state ON public.inventory_items;
CREATE TRIGGER inventory_items_clear_character_item_sheet_state
  AFTER UPDATE OF owner_id ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.clear_character_item_sheet_state_on_inventory_transfer();
