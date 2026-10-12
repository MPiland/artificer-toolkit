import { Alert, Avatar, Loader, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  publicProfileDtoSchema,
  type PublicProfileDto
} from '@artificer-toolkit/schema/api/account'
import { usernameInputSchema } from '@artificer-toolkit/schema/api/auth'
import { useProfileAvatarImage } from '#app/data/media'
import * as styles from './PublicProfilePage.css'

export function PublicProfilePage({ username }: { username: string }) {
  const validUsername = usernameInputSchema.safeParse(username).success
  const profile = useQuery(
    convexQuery(api.account.publicProfile, validUsername ? { username } : 'skip')
  )

  if (!validUsername || profile.data === null) return <ProfileUnavailable />
  if (profile.isError)
    return <Alert color='red'>This profile could not be loaded. Reload to try again.</Alert>
  if (profile.isPending) return <Loader aria-label='Loading profile' size='sm' />
  const parsed = publicProfileDtoSchema.safeParse(profile.data)
  if (!parsed.success) return <ProfileUnavailable />
  return <PublicProfile profile={parsed.data} />
}

function ProfileUnavailable() {
  return (
    <section className={styles.narrowPage} aria-labelledby='public-profile-title'>
      <div className={styles.panel}>
        <Title id='public-profile-title' order={1}>
          Profile unavailable
        </Title>
        <Text>This profile is private or doesn&apos;t exist.</Text>
      </div>
    </section>
  )
}

function PublicProfile({ profile }: { profile: PublicProfileDto }) {
  const avatar = useProfileAvatarImage(profile.username, profile.avatarRevision)
  return (
    <section className={styles.narrowPage} aria-labelledby='public-profile-title'>
      <div className={styles.panel}>
        <div className={styles.identity}>
          <Avatar alt='' radius='md' size={96} src={avatar.data?.url ?? null} />
          <Title id='public-profile-title' order={1}>
            {profile.username}
          </Title>
        </div>
        {profile.bio ? <Text className={styles.bio}>{profile.bio}</Text> : null}
      </div>
    </section>
  )
}
