import { createFileRoute } from '@tanstack/react-router'
import RaceForm from '~/pages/races/RaceForm'
import { fetchRace } from '~/apis'
import Loading from '~/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/races/$action/$_raceId')({
  beforeLoad: () => {
    return { form: { type: 'races' } }
  },
  loader: async ({ params, context }) => {
    const { _raceId: raceId } = params
    if (raceId) {
      return context.queryClient.ensureQueryData(fetchRace(raceId))
    }
  },
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: RaceForm,
})
