import { createFileRoute } from '@tanstack/react-router'
import Races from '~/pages/races/Races'
import { fetchRaces } from '~/apis'
import Loading from '~/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/races/')({
  beforeLoad: () => {
    return { form: { type: 'races' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchRaces(context.systemPref)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Races,
})
