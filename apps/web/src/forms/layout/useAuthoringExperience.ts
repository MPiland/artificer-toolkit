import { useCallback, useEffect, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { useRouter } from '@tanstack/react-router'
import { getSupabaseBrowserClient } from '#supabase/client'
import {
  AUTHORING_EXPERIENCE_METADATA_KEY,
  readAuthoringExperience,
  type AuthoringExperience
} from './authoringExperience'

export function useAuthoringExperience() {
  const router = useRouter()
  const user = router.options.context.user
  const [experience, setExperienceState] = useState(() => readAuthoringExperience(user))
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setExperienceState(readAuthoringExperience(user))
  }, [user])

  const setExperience = useCallback(
    async (nextExperience: AuthoringExperience) => {
      if (nextExperience === experience || isUpdating) return

      setExperienceState(nextExperience)
      setIsUpdating(true)

      const { error } = await getSupabaseBrowserClient().auth.updateUser({
        data: {
          ...user?.user_metadata,
          [AUTHORING_EXPERIENCE_METADATA_KEY]: nextExperience
        }
      })

      if (error) {
        notifications.show({
          color: 'red',
          message: 'Your choice works for now, but it could not be saved for next time.'
        })
      } else {
        await router.invalidate()
      }

      setIsUpdating(false)
    },
    [experience, isUpdating, router, user?.user_metadata]
  )

  return { experience, isUpdating, setExperience }
}
