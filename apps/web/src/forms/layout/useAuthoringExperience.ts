import { useCallback, useEffect, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { useMatch, useRouter } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { readAuthoringExperience, type AuthoringExperience } from './authoringExperience'

export function useAuthoringExperience() {
  const router = useRouter()
  const convex = useConvex()
  const user =
    useMatch({
      from: '__root__',
      shouldThrow: false,
      select: (match) => match.context.user
    }) ?? router.options.context.user
  const [experience, setExperienceState] = useState(() => readAuthoringExperience(user))
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setExperienceState(readAuthoringExperience(user))
  }, [user])

  const setExperience = useCallback(
    async (nextExperience: AuthoringExperience) => {
      if (nextExperience === experience || isUpdating) return

      setExperienceState(nextExperience)
      // Unauthenticated form previews have no account preference to persist.
      if (!user) return
      setIsUpdating(true)
      try {
        await convex.mutation(api.account.setAuthoringExperience, { experience: nextExperience })
        await router.invalidate()
      } catch {
        notifications.show({
          color: 'red',
          message: 'Your choice works for now, but it could not be saved for next time.'
        })
      } finally {
        setIsUpdating(false)
      }
    },
    [convex, experience, isUpdating, router, user]
  )

  return { experience, isUpdating, setExperience }
}
