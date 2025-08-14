import { createFileRoute } from '@tanstack/react-router'
import Character from '~/pages/characters/Character'
import { fetchCharacter } from '~/apis'
import Loading from '~/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/characters/$characterId')({
  beforeLoad: async () => {
    return { form: { type: 'characters' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchCharacter(params.characterId)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Character,
})
