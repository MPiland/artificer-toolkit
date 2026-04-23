/* -----------------------------------------------------------------------------
 * LEGACY BRANCH ENTRY DISPLAY METADATA
 * Branch-backed effect tables have been retired in favor of path/result-block
 * persistence. This migration now remains as a historical no-op so local
 * migration replay stays linear.
 * -----------------------------------------------------------------------------
 */

DO $$
BEGIN
  NULL;
END;
$$;
