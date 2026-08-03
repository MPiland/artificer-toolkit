ALTER TABLE public.effect_path_roll_table_rows
ADD COLUMN resolution_kind text NOT NULL DEFAULT 'RESULT',
ADD COLUMN repeat_config jsonb,
ALTER COLUMN result_block_id
DROP NOT NULL;

ALTER TABLE public.effect_path_roll_table_rows
ADD CONSTRAINT effect_path_roll_table_rows_resolution_chk CHECK (
  (
    resolution_kind = 'RESULT'
    AND result_block_id IS NOT NULL
    AND repeat_config IS NULL
  )
  OR (
    resolution_kind = 'REPEAT_TABLE'
    AND result_block_id IS NULL
    AND repeat_config IS NOT NULL
  )
);
