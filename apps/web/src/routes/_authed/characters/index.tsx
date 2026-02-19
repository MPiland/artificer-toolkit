import { createFileRoute } from '@tanstack/react-router'
import Characters from '../../../domains/characters/Characters'
import { fetchCharacters } from '@apis'
import Loading from '@components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_authed/characters/')({
  beforeLoad: async () => {
    return { form: { type: 'characters' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchCharacters(context.systemPref)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Characters,
})
