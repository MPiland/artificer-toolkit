ALTER TABLE public.effect_paths
  DROP CONSTRAINT IF EXISTS effect_paths_result_block_id_fkey;

ALTER TABLE public.effect_path_choice_options
  DROP CONSTRAINT IF EXISTS effect_path_choice_options_result_block_id_fkey;

ALTER TABLE public.effect_path_roll_table_rows
  DROP CONSTRAINT IF EXISTS effect_path_roll_table_rows_result_block_id_fkey;

ALTER TABLE public.effect_result_block_outcomes
  DROP CONSTRAINT IF EXISTS effect_result_block_outcomes_result_block_id_fkey;

ALTER TABLE public.effect_result_blocks
  ALTER COLUMN id TYPE text USING id::text;

ALTER TABLE public.effect_paths
  ALTER COLUMN result_block_id TYPE text USING result_block_id::text;

ALTER TABLE public.effect_path_choice_options
  ALTER COLUMN result_block_id TYPE text USING result_block_id::text;

ALTER TABLE public.effect_path_roll_table_rows
  ALTER COLUMN result_block_id TYPE text USING result_block_id::text;

ALTER TABLE public.effect_result_block_outcomes
  ALTER COLUMN result_block_id TYPE text USING result_block_id::text;

ALTER TABLE public.effect_paths
  ADD CONSTRAINT effect_paths_result_block_id_fkey
  FOREIGN KEY (result_block_id)
  REFERENCES public.effect_result_blocks (id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.effect_path_choice_options
  ADD CONSTRAINT effect_path_choice_options_result_block_id_fkey
  FOREIGN KEY (result_block_id)
  REFERENCES public.effect_result_blocks (id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.effect_path_roll_table_rows
  ADD CONSTRAINT effect_path_roll_table_rows_result_block_id_fkey
  FOREIGN KEY (result_block_id)
  REFERENCES public.effect_result_blocks (id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.effect_result_block_outcomes
  ADD CONSTRAINT effect_result_block_outcomes_result_block_id_fkey
  FOREIGN KEY (result_block_id)
  REFERENCES public.effect_result_blocks (id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;
