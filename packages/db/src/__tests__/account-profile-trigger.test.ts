import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const profileSchema = readFileSync(
  resolve(process.cwd(), 'packages/db/src/domains/utils/tables/user_management.sql'),
  'utf8'
)

describe('account profile trigger', () => {
  it('accepts invitation usernames only through trusted app metadata', () => {
    expect(profileSchema).toContain('AFTER INSERT ON auth.users')
    expect(profileSchema).toContain('BEFORE UPDATE OF raw_app_meta_data ON auth.users')
    expect(profileSchema).toContain(
      "requested_username text := trim(NEW.raw_app_meta_data ->> 'pending_profile_username')"
    )
    expect(profileSchema).toContain("NEW.raw_app_meta_data, '{}'::jsonb)")
    expect(profileSchema).toContain("- 'pending_profile_username'")
    expect(profileSchema).not.toContain('UPDATE OF raw_user_meta_data ON auth.users')
  })
})
