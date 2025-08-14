import { useMemo, type ReactNode } from 'react'
import { useFieldUpdates, useEnumChecks, useFormField } from '~/hooks'
import { ClassInput } from '~/types'
import { useOptimizedSelector, useTypedFormStore } from '~/store'

const LevelAttributes = ({ index }: { index: number }) => {
  const store = useTypedFormStore<ClassInput>()

  const { AppField } = useFormField({ store })

  const { formAttributes, maxSpellLevel } = useOptimizedSelector(store, (state) => ({
    formAttributes: state.current?.attributes,
    maxSpellLevel: state.current?.spellcasting?.maxSpellLevel,
  }))

  const { getAttributes } = useEnumChecks()

  const { isSpellcaster, hasResourcePoints, limitKnownSpells } = getAttributes({
    attributes: formAttributes || undefined,
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const spellSlotFields = useMemo(() => {
    const spellSlotInputs: ReactNode[] = []
    if (isSpellcaster && maxSpellLevel) {
      for (let i = 0; i < maxSpellLevel; i++) {
        spellSlotInputs.push(
          <AppField
            key={`spellSlots[${i}].slotCount`}
            name={`levelAttributes[${index}].spellSlots[${i}].slotCount`}
            validators={fieldValidators({
              onBlur: `Please enter a number of spell slots for level ${i + 1}`,
              onChange: { type: 'integer', name: `Spell slots for level ${i + 1}`, min: 0 },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => <TextField required={true} />}
          </AppField>
        )
      }
    }
  }, [AppField, isSpellcaster, maxSpellLevel, fieldListeners, fieldValidators, index])

  return (
    <>
      <AppField
        name={`levelAttributes[${index}].level`}
        validators={fieldValidators({
          onBlur: 'Please enter a level',
          onChange: { type: 'integer', name: 'Level', min: 1 },
        })}
        listeners={fieldListeners}
      >
        {({ TextField }) => <TextField required={true} />}
      </AppField>
      {hasResourcePoints && (
        <AppField
          name={`levelAttributes[${index}].resourcePoints`}
          validators={fieldValidators({
            onBlur: 'Please enter a resource use amount',
            onChange: { type: 'integer', name: 'Resource use amount', min: 1 },
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => <TextField required={true} />}
        </AppField>
      )}
      {isSpellcaster && (
        <>
          <AppField
            name={`levelAttributes[${index}].cantripsKnownLimit`}
            validators={fieldValidators({
              onBlur: 'Please enter a cantrip limit ',
              onChange: { type: 'integer', name: 'Cantrip limit', min: 1 },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => <TextField required={true} />}
          </AppField>
          {limitKnownSpells && (
            <AppField
              name={`levelAttributes[${index}].spellsKnownLimit`}
              validators={fieldValidators({
                onBlur: 'Please enter a spell limit ',
                onChange: { type: 'integer', name: 'Spell limit', min: 1 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => <TextField required={true} />}
            </AppField>
          )}
          {spellSlotFields}
        </>
      )}
    </>
  )
}
export default LevelAttributes
