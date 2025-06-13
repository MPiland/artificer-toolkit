import { z } from 'zod/v4'
import { useMemo, type ReactNode } from 'react'
import { withFieldGroup } from '../../utils/factory'
import { LevelAttributeInputSchema } from '@/schemas'

const defaultValues: z.input<typeof LevelAttributeInputSchema> = LevelAttributeInputSchema.parse({})

const LevelAttributes = withFieldGroup({
  defaultValues,
  props: {
    isSpellcaster: false,
    hasResourcePoints: false,
    limitKnownSpells: false,
    maxSpellLevel: 0,
    index: 0,
  },
  render: function Render({ group, isSpellcaster, hasResourcePoints, limitKnownSpells, maxSpellLevel, index }) {
    const { AppField } = group

    const spellSlotFields = useMemo(() => {
      const spellSlotInputs: ReactNode[] = []
      if (isSpellcaster && maxSpellLevel) {
        for (let i = 0; i < maxSpellLevel; i++) {
          spellSlotInputs.push(
            <AppField
              key={`${index}-spellSlots[${i}].slotCount`}
              name={`spellSlots[${i}].slotCount`}
              validators={{
                onSubmit: ({ value }) => !value && 'Please enter a number of spell slots',
                onChange: z
                  .int('Spell slots must be a whole number')
                  .gte(0, 'Spell slots must be greater than or equal to 0'),
              }}
            >
              {({ TextField }) => <TextField required={true} />}
            </AppField>
          )
        }
      }
    }, [AppField, index, isSpellcaster, maxSpellLevel])

    return (
      <>
        <AppField
          name='level'
          validators={{
            onSubmit: ({ value }) => !value && 'Please enter a level',
            onChange: z.int('Level must be a whole number').gte(1, 'Level must be greater than 0'),
          }}
        >
          {({ TextField }) => <TextField required={true} />}
        </AppField>
        {hasResourcePoints && (
          <AppField
            name='resourcePoints'
            validators={{
              onSubmit: ({ value }) => !value && 'Please enter a resource use amount',
              onChange: z
                .int('Resource use amount must be a whole number')
                .gte(1, 'Resource use amount must be greater than 0'),
            }}
          >
            {({ TextField }) => <TextField required={true} />}
          </AppField>
        )}
        {isSpellcaster && (
          <>
            <AppField
              name='cantripsKnownLimit'
              validators={{
                onSubmit: ({ value }) => !value && 'Please enter a cantrip limit ',
                onChange: z.int('Cantrip limit must be a whole number').gte(1, 'Cantrip limit must be greater than 0'),
              }}
            >
              {({ TextField }) => <TextField required={true} />}
            </AppField>
            {limitKnownSpells && (
              <AppField
                name='spellsKnownLimit'
                validators={{
                  onSubmit: ({ value }) => !value && 'Please enter a spell limit ',
                  onChange: z.int('Spell limit must be a whole number').gte(1, 'Spell limit must be greater than 0'),
                }}
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
