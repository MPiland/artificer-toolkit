import { createFileRoute } from '@tanstack/react-router'
import Spell from '../../../domains/spells/Spell'
import { fetchSpell } from '@apis'
import Loading from '@components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_authed/spells/$spellId')({
  beforeLoad: () => {
    return { form: { type: 'spells' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchSpell(params.spellId)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Spell,
})
