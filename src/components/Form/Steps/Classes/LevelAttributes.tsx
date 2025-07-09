import { useMemo, type ReactNode } from 'react'
import { withFieldGroup } from '@/components/Form'
import { useFieldUpdates } from '@/hooks'
import type { LevelAttributeInput } from 'gql/types'

const LevelAttributes = withFieldGroup({
  defaultValues: {} as LevelAttributeInput,
  props: {
    isSpellcaster: false,
    hasResourcePoints: false,
    limitKnownSpells: false,
    maxSpellLevel: 0,
    index: 0,
  },
  render: function Render({ group, isSpellcaster, hasResourcePoints, limitKnownSpells, maxSpellLevel, index }) {
    const { AppField } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'form', path: `levelAttributes[${index}]` })

    const spellSlotFields = useMemo(() => {
      const spellSlotInputs: ReactNode[] = []
      if (isSpellcaster && maxSpellLevel) {
        for (let i = 0; i < maxSpellLevel; i++) {
          spellSlotInputs.push(
            <AppField
              key={`${index}-spellSlots[${i}].slotCount`}
              name={`spellSlots[${i}].slotCount`}
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
    }, [AppField, index, isSpellcaster, maxSpellLevel, fieldListeners, fieldValidators])

    return (
      <>
        <AppField
          name='level'
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
            name='resourcePoints'
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
              name='cantripsKnownLimit'
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
                name='spellsKnownLimit'
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
  },
})

export default LevelAttributes
