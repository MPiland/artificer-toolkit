import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike, SocialProfileRecord } from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  findSocialProfileByUser: vi.fn(),
  setSocialContentPreference: vi.fn(),
  attestSocialEligibility: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return { ...actual, createSocialRepository: () => mocks }
})

const { acceptSocialEligibility, updateSocialContentPreference } =
  await import('./profileService.js')

const profile = {
  id: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  username: 'player-one',
  adultAttestedAt: null,
  usAttestedAt: null,
  contentPreference: 'STANDARD',
  status: 'ACTIVE',
  version: 0,
  createdAt: '2026-08-10T12:00:00.000Z',
  updatedAt: '2026-08-10T12:00:00.000Z'
} satisfies SocialProfileRecord

describe('Social profile preferences', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findSocialProfileByUser.mockResolvedValue(profile)
  })

  it('stores only an adult-attestation timestamp when Mature is enabled', async () => {
    mocks.setSocialContentPreference.mockImplementation(
      async (
        _userId: string,
        contentPreference: SocialProfileRecord['contentPreference'],
        adultAttestedAt: string | null
      ) => ({ ...profile, adultAttestedAt, contentPreference })
    )

    const result = await updateSocialContentPreference({} as DBLike, profile.userId, {
      contentPreference: 'MATURE',
      birthDate: '2000-01-01'
    })

    expect(result.contentPreference).toBe('MATURE')
    expect(result.adultAttestedAt).not.toBeNull()
    expect(mocks.setSocialContentPreference).toHaveBeenCalledWith(
      profile.userId,
      'MATURE',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    )
    expect(JSON.stringify(mocks.setSocialContentPreference.mock.calls)).not.toContain('2000-01-01')
  })

  it('rejects a Mature preference when the birth date does not attest to 18+', async () => {
    await expect(
      updateSocialContentPreference({} as DBLike, profile.userId, {
        contentPreference: 'MATURE',
        birthDate: '2020-01-01'
      })
    ).rejects.toThrow('Mature content requires age verification')

    expect(mocks.setSocialContentPreference).not.toHaveBeenCalled()
  })

  it('reuses an existing adult attestation without requiring another birth date', async () => {
    const attested = { ...profile, adultAttestedAt: '2026-08-10T12:00:00.000Z' }
    mocks.findSocialProfileByUser.mockResolvedValue(attested)
    mocks.setSocialContentPreference.mockResolvedValue({
      ...attested,
      contentPreference: 'MATURE'
    })

    await updateSocialContentPreference({} as DBLike, profile.userId, {
      contentPreference: 'MATURE'
    })

    expect(mocks.setSocialContentPreference).toHaveBeenCalledWith(
      profile.userId,
      'MATURE',
      null,
      expect.any(String)
    )
  })

  it('lets an adult-attested user complete the separate US Social gate', async () => {
    const attested = { ...profile, adultAttestedAt: '2026-08-10T12:00:00.000Z' }
    mocks.findSocialProfileByUser.mockResolvedValue(attested)
    mocks.attestSocialEligibility.mockResolvedValue({
      ...attested,
      usAttestedAt: '2026-08-10T12:01:00.000Z'
    })

    await acceptSocialEligibility({} as DBLike, profile.userId, { isCurrentlyInUs: true })

    expect(mocks.attestSocialEligibility).toHaveBeenCalledWith(profile.userId, expect.any(String))
  })
})
