import { createFileRoute } from '@tanstack/react-router'
import SpellForm from '@/pages/spells/SpellForm'
import { fetchSpell } from '@/apis/spells.api'
import Loading from '@/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/spells/$action/$_spellId')({
  beforeLoad: () => {
    return { form: { type: 'spells' } }
  },
  loader: async ({ params, context }) => {
    const { _spellId: spellId } = params
    if (spellId) {
      return context.queryClient.ensureQueryData(fetchSpell(spellId))
    }
  },
  pendingComponent: () => (
    <Modal withCloseButton={false}  opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: SpellForm,
})
