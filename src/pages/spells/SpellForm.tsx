import { z } from 'zod/v4'
import { useEffect, useMemo, useState } from 'react'
import { useAddNewSpellMutation, useUpdateSpellMutation } from '@/apis/spells.api'
import { Route } from '@/routes/_protected/spells/$action/$_spellId'
import { useSpellData } from '@/hooks'
import { SpellInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, { SpellAttributes, SpellDetails } from '@/components/Form'
import { useFormStore } from '@/store'
import { isEqual } from 'lodash'

const SpellForm = () => {
  const { _spellId: spellId, action } = Route.useParams()
  const {
    spells: { findSpell },
  } = useSpellData()
  const spell = findSpell(spellId)
  const formStore = useFormStore((state) => state)

  const data: z.input<typeof SpellInputSchema> = useMemo(
    () =>
      spell ?
        action === 'new' ?
          SpellInputSchema.parse({
            ...spell,
            id: uuidv4(),
            label: '',
            masterId: undefined,
          })
        : SpellInputSchema.parse(spell)
      : SpellInputSchema.parse({
          __kind: 'SpellInput',
          id: uuidv4(),
        }),
    [spell, action]
  )

  useEffect(() => {
    formStore.setCurrent(data)
  }, [formStore, data])

  const [steps] = useState([
    { id: 'details', label: 'Details' },
    { id: 'attributes', label: 'Attributes' },
  ])

  useEffect(() => {
    if (!isEqual(formStore.steps, steps)) formStore.setSteps(steps)
  }, [formStore, steps])

  const stepComponentMap = {
    details: <SpellDetails />,
    attributes: <SpellAttributes />,
  }

  return (
    <Form useAddNewItemMutation={useAddNewSpellMutation} useUpdateItemMutation={useUpdateSpellMutation}>
      {stepComponentMap[formStore.steps[formStore.stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}

export default SpellForm
