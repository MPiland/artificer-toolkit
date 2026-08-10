import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const profileSchema = readFileSync(
  resolve(process.cwd(), 'packages/db/src/domains/utils/tables/user_management.sql'),
  'utf8'
)

describe('account profile trigger', () => {
  it('persists a claimed username while allowing pending invitations', () => {
    expect(profileSchema).toContain('username   text,')
    expect(profileSchema).not.toContain('username   text NOT NULL')
    expect(profileSchema).toContain('AFTER INSERT ON auth.users')
    expect(profileSchema).toContain(
      'INSERT INTO public.profiles (id, username, full_name, avatar_url)'
    )
    expect(profileSchema).toContain("NULLIF(trim(NEW.raw_user_meta_data ->> 'username'), '')")
    expect(profileSchema).not.toContain('Username is required for non-invited accounts.')
    expect(profileSchema).toContain("'admin', 'moderator', 'support', 'system', 'root'")
    expect(profileSchema).toContain("NULLIF(trim(auth_user.raw_user_meta_data ->> 'username'), '')")
    expect(profileSchema).not.toContain('handle_invitation_completion')
    expect(profileSchema).not.toContain('pending_profile_username')
  })
})
