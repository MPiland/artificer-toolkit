import {
  createSocialRepository,
  type DBLike,
  type SocialProfileRecord
} from '@artificer-toolkit/db'
import type {
  AcceptSocialEligibilityInput,
  SocialEligibilityDto,
  SocialProfileDto,
  UpdateSocialContentPreferenceInput
} from '@artificer-toolkit/schema/api/socialHub'
import { SocialEligibilityError, SocialNotFoundError, SocialValidationError } from './errors.js'
import { isAtLeast18 } from './ageAttestation.js'
import { mapSocialProfile, socialIso } from './mapping.js'

export function hasActiveSocialEligibility(profile: SocialProfileRecord): boolean {
  return (
    profile.status === 'ACTIVE' && profile.adultAttestedAt !== null && profile.usAttestedAt !== null
  )
}

function mapEligibility(profile: SocialProfileRecord | null): SocialEligibilityDto {
  return {
    eligible: profile ? hasActiveSocialEligibility(profile) : false,
    profilePublicId: profile?.id ?? null,
    adultAttestedAt: profile?.adultAttestedAt ? socialIso(profile.adultAttestedAt) : null,
    usAttestedAt: profile?.usAttestedAt ? socialIso(profile.usAttestedAt) : null,
    contentPreference: profile?.contentPreference ?? 'STANDARD',
    status: profile?.status ?? null
  }
}

export async function requireActiveSocialProfile(
  db: DBLike,
  userId: string
): Promise<SocialProfileRecord> {
  const profile = await createSocialRepository(db).findSocialProfileByUser(userId)
  if (!profile || !hasActiveSocialEligibility(profile)) throw new SocialEligibilityError()
  return profile
}

export async function getSocialEligibility(
  db: DBLike,
  userId: string
): Promise<SocialEligibilityDto> {
  const profile = await createSocialRepository(db).findSocialProfileByUser(userId)
  return mapEligibility(profile)
}

export async function acceptSocialEligibility(
  db: DBLike,
  userId: string,
  input: AcceptSocialEligibilityInput
): Promise<SocialEligibilityDto> {
  const existing = await createSocialRepository(db).findSocialProfileByUser(userId)
  if (
    !existing?.adultAttestedAt &&
    (!input.birthDate || !isAtLeast18(input.birthDate, new Date()))
  ) {
    throw new SocialValidationError(
      'Enter a birth date that confirms you are at least 18 years old.'
    )
  }
  const profile = await createSocialRepository(db).attestSocialEligibility(
    userId,
    new Date().toISOString()
  )
  return mapEligibility(profile)
}

export async function updateSocialContentPreference(
  db: DBLike,
  userId: string,
  input: UpdateSocialContentPreferenceInput
): Promise<SocialEligibilityDto> {
  const repository = createSocialRepository(db)
  const existing = await repository.findSocialProfileByUser(userId)
  const now = new Date()
  let adultAttestedAt: string | null = null

  if (input.contentPreference === 'MATURE' && !existing?.adultAttestedAt) {
    if (!input.birthDate || !isAtLeast18(input.birthDate, now)) {
      throw new SocialValidationError(
        'Mature content requires age verification using your birth date.'
      )
    }
    adultAttestedAt = now.toISOString()
  }

  return mapEligibility(
    await repository.setSocialContentPreference(
      userId,
      input.contentPreference,
      adultAttestedAt,
      now.toISOString()
    )
  )
}

export async function getSocialProfile(
  db: DBLike,
  userId: string,
  profilePublicId: string
): Promise<SocialProfileDto> {
  const viewer = await requireActiveSocialProfile(db, userId)
  const profile = await createSocialRepository(db).findActiveSocialProfile(
    viewer.id,
    profilePublicId
  )
  if (!profile) throw new SocialNotFoundError()
  return mapSocialProfile(profile)
}
