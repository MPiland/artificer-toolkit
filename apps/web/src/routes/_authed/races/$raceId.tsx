import { createFileRoute } from '@tanstack/react-router'
import Race from '../../../domains/races/Race'
import Loading from '~components/Loading/Loading'
import { fetchRace } from '~apis'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_authed/races/$raceId')({
  beforeLoad: () => {
    return { form: { type: 'races' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchRace(params.raceId)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Race,
})
