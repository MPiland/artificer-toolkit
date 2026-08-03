import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const profileSchema = readFileSync(
  resolve(process.cwd(), 'packages/db/src/domains/utils/tables/user_management.sql'),
  'utf8'
)

describe('account profile trigger', () => {
  it('creates a missing profile during the same auth metadata update', () => {
    expect(profileSchema).toContain(
      'AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users'
    )
    expect(profileSchema).toContain('SELECT 1 FROM public.profiles WHERE id = NEW.id')
    expect(profileSchema).toContain("requested_username text := trim(NEW.raw_user_meta_data ->> 'username')")
  })
})
