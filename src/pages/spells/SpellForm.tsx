import { useEffect, use } from 'react'
import { useAddNewSpellMutation, useUpdateSpellMutation } from '@/apis/spells.api'
import { Step, type SpellInput } from '@/types'
import Form, { FormContext } from '@/components/Form'
import { isEqual } from 'lodash'
import { Route } from '@/routes/_protected/spells/$action/$_spellId'
import { useSpellData } from '@/hooks'
import { SpellInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'

const SpellForm = () => {
  const { _spellId: spellId, action } = Route.useParams()
  const {
    spells: { findSpell },
  } = useSpellData()
  const spell = findSpell(spellId)
  const { steps, formStore } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'attributes', label: 'Attributes' },
  ] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      formStore.setSteps(stepsArray)
    }
    if (action === 'new') {
      let dataObj: SpellInput
      if (spell) {
        dataObj = SpellInputSchema.parse({
          ...spell,
          id: uuidv4(),
          label: '',
          masterId: undefined,
        })
      } else {
        dataObj = SpellInputSchema.parse({
          __kind: 'SpellInput',
          id: uuidv4(),
        })
      }
      formStore.reinitState(dataObj)
    }
    if (action === 'edit' && spell) {
      const dataObj = SpellInputSchema.parse(spell)
      formStore.reinitState(dataObj)
    }
  }, [stepsArray, steps, formStore, spell, action])

  return <Form useAddNewItemMutation={useAddNewSpellMutation} useUpdateItemMutation={useUpdateSpellMutation} />
}

export default SpellForm
