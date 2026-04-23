import { createFileRoute } from '@tanstack/react-router'
import { Modal } from '@mantine/core'

import Loading from '@components/Loading/Loading'
import Character from '../../../domains/characters/Character'
import { getCharacterSheet } from '../../../data/characters'

export const Route = createFileRoute('/_authed/characters/$characterId')({
  beforeLoad: async () => {
    return { form: { type: 'characters' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(getCharacterSheet(params.characterId)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Character,
})
