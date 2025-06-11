import { createFileRoute } from '@tanstack/react-router'
import BackgroundForm from '@/pages/backgrounds/BackgroundForm'
import { fetchBackground } from '@/apis/backgrounds.api'

export const Route = createFileRoute('/_protected/backgrounds/$action/$_backgroundId')({
  beforeLoad: () => {
    return { form: { type: 'backgrounds' } }
  },
  loader: async ({ params, context }) => {
    const { _backgroundId: backgroundId } = params
    if (backgroundId) {
      return context.queryClient.ensureQueryData(fetchBackground(backgroundId))
    }
  },
  component: BackgroundForm,
})
