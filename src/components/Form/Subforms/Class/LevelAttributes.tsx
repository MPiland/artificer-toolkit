import { ReactNode, useEffect, useMemo } from 'react'
import Collapse from '../../../Collapse/Collapse'
import type { Class } from '../../../../../amplify/gql/types'
import { Attributes } from '../../../../types/enums'
import Input from '../../../Input/Input'
import { useEnumChecks } from '../../../../hooks/useEnumChecks'
import Grid from '../../../Grid/Grid'
import type { OnChange } from '../../../../types/form'

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
      (isSpellcaster || (hasResourcePoints && data.resource?.method === Attributes.setPerLevel))
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
          <Grid.Item key={`spell-label-${i}`} colSpan={'auto'}>
            <span>{i + 1}</span>
          </Grid.Item>
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
            <Grid.Item key={`spell-input-${index}-${i}`} colSpan={'auto'}>
              <Input
                name={`levelAttributes.${index}.spellSlots.${i}.slotCount`}
                value={data.levelAttributes?.[index]?.spellSlots?.[i]?.slotCount}
                validation='num'
                errorMsg='Please enter a whole number'
                onChange={{ updateField }}
                required={true}
              />
            </Grid.Item>
          )
        }
      }

      return (
        <Grid.Item key={`level-row-${index}`}>
          <Grid>
            <Grid.Item colSpan={'auto'}>
              <Input
                name={`levelAttributes.${index}.level`}
                value={setLevel.level}
                validation='num'
                errorMsg='Please enter a whole number'
                onChange={{ updateField }}
                required={true}
              />
            </Grid.Item>
            {hasResourcePoints && (
              <Grid.Item colSpan={'auto'}>
                <Input
                  name={`levelAttributes.${index}.resourcePoints`}
                  value={setLevel.resourcePoints}
                  validation='num'
                  errorMsg='Please enter a whole number'
                  onChange={{ updateField }}
                  required={true}
                />
              </Grid.Item>
            )}
            {isSpellcaster && (
              <>
                <Grid.Item colSpan={'auto'}>
                  <Input
                    name={`levelAttributes.${index}.cantripsKnownLimit`}
                    value={setLevel.cantripsKnownLimit}
                    validation='num'
                    errorMsg='Please enter a whole number'
                    onChange={{ updateField }}
                    required={true}
                  />
                </Grid.Item>
                {limitKnownSpells && (
                  <Grid.Item colSpan={'auto'}>
                    <Input
                      name={`levelAttributes.${index}.spellsKnownLimit`}
                      value={setLevel.spellsKnownLimit}
                      validation='num'
                      errorMsg='Please enter a whole number'
                      onChange={{ updateField }}
                      required={true}
                    />
                  </Grid.Item>
                )}
                {spellSlotInputs}
              </>
            )}
          </Grid>
        </Grid.Item>
      )
    })
  }, [data, isSpellcaster, hasResourcePoints, limitKnownSpells, updateField])

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header title={'Level Attributes'} startOpened={data.id == null} />
        <Collapse.Body>
          <Grid>
            <Grid.Item>
              <Grid>
                <Grid.Item colSpan={'auto'}>Level</Grid.Item>
                {hasResourcePoints && (
                  <Grid.Item colSpan={'auto'}>{data.resource?.label ?? 'Resource'} Points</Grid.Item>
                )}
                {isSpellcaster && (
                  <>
                    <Grid.Item colSpan={'auto'}>Cantrips Known</Grid.Item>
                    {limitKnownSpells && <Grid.Item colSpan={'auto'}>Spells Known</Grid.Item>}
                    {spellSlotLabels}
                  </>
                )}
              </Grid>
            </Grid.Item>
            {levelAttributeRows}
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}

export default LevelAttributes
