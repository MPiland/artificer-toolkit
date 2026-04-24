import { createFileRoute } from '@tanstack/react-router'
import { Modal } from '@mantine/core'

import Loading from '@components/Loading/Loading'
import Characters from '../../../domains/characters/Characters'
import { getCharacterList } from '../../../data/characters'

export const Route = createFileRoute('/_authed/characters/')({
  beforeLoad: async () => {
    return { form: { type: 'characters' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(getCharacterList()),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Characters,
})
