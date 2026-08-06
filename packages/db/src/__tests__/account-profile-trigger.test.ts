import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const profileSchema = readFileSync(
  resolve(process.cwd(), 'packages/db/src/domains/utils/tables/user_management.sql'),
  'utf8'
)

describe('account profile trigger', () => {
  it('creates a profile for every auth user without requiring a username', () => {
    expect(profileSchema).toContain('username   text,')
    expect(profileSchema).not.toContain('username   text NOT NULL')
    expect(profileSchema).toContain('AFTER INSERT ON auth.users')
    expect(profileSchema).toContain('INSERT INTO public.profiles (id, full_name, avatar_url)')
    expect(profileSchema).not.toContain('handle_invitation_completion')
    expect(profileSchema).not.toContain('pending_profile_username')
  })
})
