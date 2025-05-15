import { createFileRoute } from '@tanstack/react-router'
import SpellForm from '@/pages/spells/SpellForm'
import { fetchSpell } from '@/apis/spellsApi'
import { FormProvider } from '@/components/Form'

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
  component: () => (
    <FormProvider>
      <SpellForm />
    </FormProvider>
  ),
})
