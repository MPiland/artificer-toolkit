ALTER TABLE public.campaign_play_settings
ADD COLUMN IF NOT EXISTS automation_mode text NOT NULL DEFAULT 'ASSISTED',
ADD COLUMN IF NOT EXISTS manual_reminder_mode text NOT NULL DEFAULT 'OFF';

ALTER TABLE public.campaign_play_settings
DROP CONSTRAINT IF EXISTS campaign_play_settings_automation_mode_check,
ADD CONSTRAINT campaign_play_settings_automation_mode_check
  CHECK (automation_mode IN ('AUTOMATIC', 'ASSISTED', 'MANUAL')),
DROP CONSTRAINT IF EXISTS campaign_play_settings_manual_reminder_mode_check,
ADD CONSTRAINT campaign_play_settings_manual_reminder_mode_check
  CHECK (manual_reminder_mode IN ('OFF', 'SUBTLE'));

ALTER TABLE public.encounters
ADD COLUMN IF NOT EXISTS automation_mode text NOT NULL DEFAULT 'ASSISTED',
ADD COLUMN IF NOT EXISTS manual_reminder_mode text NOT NULL DEFAULT 'OFF';

ALTER TABLE public.encounters
DROP CONSTRAINT IF EXISTS encounters_automation_mode_check,
ADD CONSTRAINT encounters_automation_mode_check
  CHECK (automation_mode IN ('AUTOMATIC', 'ASSISTED', 'MANUAL')),
DROP CONSTRAINT IF EXISTS encounters_manual_reminder_mode_check,
ADD CONSTRAINT encounters_manual_reminder_mode_check
  CHECK (manual_reminder_mode IN ('OFF', 'SUBTLE'));
