import { ReactNode, useEffect, useMemo } from 'react'
import Collapsible from '@/components/Collapsible'
import { Attributes } from '@/enums'
import Input from '@/components/Input'
import { useEnumChecks } from '@/hooks'
import { Grid } from '@mantine/core'
import type { OnChange, Class } from '@/types'

const LevelAttributes = ({
  formStore: { data, updateField, addField },
}: {
  formStore: {
    data: Class
    updateField: OnChange<Class>['updateField']
    addField: OnChange<Class>['addField']
  }
}) => {
  const { isSpellcaster, hasResourcePoints, limitKnownSpells } = useEnumChecks({ data })

  // Add level attribute table
  useEffect(() => {
    if (
      !data.levelAttributes &&
      (isSpellcaster || (hasResourcePoints && data.resource?.method === Attributes.SET_PER_LEVEL))
    ) {
      addField({ path: 'levelAttributes' })
    }
  }, [data.levelAttributes, addField, data.category, isSpellcaster, hasResourcePoints, data.resource?.method])

  // Memoize spell slot labels
  const spellSlotLabels = useMemo(() => {
    const spellLabels: ReactNode[] = []
    if (data?.spellcasting?.maxSpellLevel) {
      for (let i = 0; i < data?.spellcasting?.maxSpellLevel; i++) {
        spellLabels.push(
          <Grid.Col key={`spell-label-${i}`} >
            <span>{i + 1}</span>
          </Grid.Col>
        )
      }
    }
    return spellLabels
  }, [data?.spellcasting?.maxSpellLevel])

  // Memoize level attribute rows with all inputs
  const levelAttributeRows = useMemo(() => {
    if (!data?.levelAttributes?.length) {
      return []
    }

    return data.levelAttributes.map((setLevel, index) => {
      // Create spell slot inputs for this level
      const spellSlotInputs: ReactNode[] = []
      if (isSpellcaster && data?.spellcasting?.maxSpellLevel) {
        for (let i = 0; i < data.spellcasting.maxSpellLevel; i++) {
          spellSlotInputs.push(
            <Grid.Col key={`spell-input-${index}-${i}`} >
              <Input
                name={`levelAttributes.${index}.spellSlots.${i}.slotCount`}
                value={data.levelAttributes?.[index]?.spellSlots?.[i]?.slotCount}
                validation='num'
                errorMsg='Please enter a whole number'
                onChange={{ updateField }}
                required={true}
              />
            </Grid.Col>
          )
        }
      }

      return (
        <Grid.Col key={`level-row-${index}`}>
          <Grid>
            <Grid.Col >
              <Input
                name={`levelAttributes.${index}.level`}
                value={setLevel.level}
                validation='num'
                errorMsg='Please enter a whole number'
                onChange={{ updateField }}
                required={true}
              />
            </Grid.Col>
            {hasResourcePoints && (
              <Grid.Col >
                <Input
                  name={`levelAttributes.${index}.resourcePoints`}
                  value={setLevel.resourcePoints}
                  validation='num'
                  errorMsg='Please enter a whole number'
                  onChange={{ updateField }}
                  required={true}
                />
              </Grid.Col>
            )}
            {isSpellcaster && (
              <>
                <Grid.Col >
                  <Input
                    name={`levelAttributes.${index}.cantripsKnownLimit`}
                    value={setLevel.cantripsKnownLimit}
                    validation='num'
                    errorMsg='Please enter a whole number'
                    onChange={{ updateField }}
                    required={true}
                  />
                </Grid.Col>
                {limitKnownSpells && (
                  <Grid.Col >
                    <Input
                      name={`levelAttributes.${index}.spellsKnownLimit`}
                      value={setLevel.spellsKnownLimit}
                      validation='num'
                      errorMsg='Please enter a whole number'
                      onChange={{ updateField }}
                      required={true}
                    />
                  </Grid.Col>
                )}
                {spellSlotInputs}
              </>
            )}
          </Grid>
        </Grid.Col>
      )
    })
  }, [data, isSpellcaster, hasResourcePoints, limitKnownSpells, updateField])

  return (
    <Grid.Col>
      <Collapsible defaultOpen={data.id == null}>
        <Collapsible.Trigger title={'Level Attributes'} />
        <Collapsible.Content>
          <Grid>
            <Grid.Col>
              <Grid>
                <Grid.Col >Level</Grid.Col>
                {hasResourcePoints && (
                  <Grid.Col >{data.resource?.label ?? 'Resource'} Points</Grid.Col>
                )}
                {isSpellcaster && (
                  <>
                    <Grid.Col >Cantrips Known</Grid.Col>
                    {limitKnownSpells && <Grid.Col >Spells Known</Grid.Col>}
                    {spellSlotLabels}
                  </>
                )}
              </Grid>
            </Grid.Col>
            {levelAttributeRows}
          </Grid>
        </Collapsible.Content>
      </Collapsible>
    </Grid.Col>
  )
}

export default LevelAttributes
