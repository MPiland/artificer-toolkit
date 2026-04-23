import { createFileRoute } from '@tanstack/react-router'
import { Modal } from '@mantine/core'

import Loading from '@components/Loading/Loading'
import CharacterForm from '../../../../domains/characters/form/CharacterForm'
import { getCharacterBuilder } from '../../../../data/characters'

export const Route = createFileRoute('/_authed/characters/$action/$_characterId')({
  beforeLoad: async () => {
    return { form: { type: 'characters' } }
  },
  loader: async ({ params, context }) => {
    if (params.action === 'edit' && params._characterId) {
      return context.queryClient.ensureQueryData(getCharacterBuilder(params._characterId))
    }

    return null
  },
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: CharacterForm
})
