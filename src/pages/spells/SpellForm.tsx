import { useEffect, use } from 'react'
import { useAddNewSpellMutation, useUpdateSpellMutation } from '../../apis/spellsApi'
import { Step } from '../../types/form'
import Form from '../../components/Form/Form'
import { FormContext } from '../../components/Form/FormContext'
import { isEqual } from 'lodash'
import { Route } from '../../routes/_protected/spells/$action/$_spellId'
import useSpellData from '../../hooks/useSpellData'

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
    if (action === 'new' && spell) {
      if (Object.keys(formStore.data).length === 0) {
        formStore.reinitData(spell)
      }
    }
    if (action === 'edit' && spell) {
      if (formStore.data?.id !== spell.id) {
        formStore.reinitData(spell)
      }
    }
  }, [, stepsArray, steps, formStore, spell, action])

  return <Form useAddNewItemMutation={useAddNewSpellMutation} useUpdateItemMutation={useUpdateSpellMutation} />
}

export default SpellForm
