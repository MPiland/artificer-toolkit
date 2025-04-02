import { ReactNode, useEffect } from 'react'
import Collapse from '../../Collapse/Collapse'
import { UpdateState } from '../../../types/form'
import { Class } from '../../../../amplify/gql/types'
import { Attributes } from '../../../types/enums'
import Input from '../../Input/Input'
import { useEnumChecks } from '../../../hooks/useEnumChecks'
import Grid from '../../Grid/Grid'

const LevelAttributes = ({
  formData,
  updateFormData,
}: {
  formData: Class
  updateFormData: (arg: UpdateState<Class>) => void
}) => {
  const { isSpellcaster, hasResourcePoints, limitKnownSpells } = useEnumChecks({ data: formData })

  // Add level attribute table
  useEffect(() => {
    if (
      !formData.levelAttributes &&
      (isSpellcaster || (hasResourcePoints && formData.resource?.method === Attributes.setPerLevel))
    ) {
      updateFormData({
        type: 'add',
        path: 'levelAttributes',
      })
    }
  }, [
    formData.levelAttributes,
    updateFormData,
    formData.category,
    isSpellcaster,
    hasResourcePoints,
    formData.resource?.method,
  ])

  const spellSlots = (index?: number) => {
    const labels: ReactNode[] = []
    const inputs: ReactNode[] = []
    if (index && formData?.spellcasting?.maxSpellLevel) {
      for (let i = 0; i < formData?.spellcasting?.maxSpellLevel; i++) {
        labels.push(<span>{i + 1}</span>)
        inputs.push(
          <Input
            key={`${index}-${i}`}
            name={`spellSlots.${i}.count`}
            value={formData.levelAttributes?.[index]?.spellSlots?.[i]?.slotCount}
            validation='num'
            required={true}
          />
        )
      }
    }

    return { labels, inputs }
  }

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header title={'Level Attributes'} startOpened={formData.id == null} />
        <Collapse.Body>
          <Grid>
            <Grid.Item>
              <Grid>
                <Grid.Item colSpan={'auto'}>Level</Grid.Item>
                {hasResourcePoints && (
                  <Grid.Item colSpan={'auto'}>{formData.resource?.label ?? 'Resource'} Points</Grid.Item>
                )}
                {isSpellcaster && (
                  <>
                    <Grid.Item colSpan={'auto'}>Cantrips Known</Grid.Item>
                    {limitKnownSpells && <Grid.Item colSpan={'auto'}>Spells Known</Grid.Item>}
                    {formData.spellcasting?.maxSpellLevel &&
                      spellSlots().labels.map((label, lIndex) => (
                        <Grid.Item key={lIndex} colSpan={'auto'}>
                          {label}
                        </Grid.Item>
                      ))}
                  </>
                )}
              </Grid>
            </Grid.Item>
            {formData?.levelAttributes?.map((setLevel, index) => (
              <Grid.Item key={index}>
                <Grid>
                  <Grid.Item colSpan={'auto'}>
                    <Input
                      name={`levelAttributes.${index}.level`}
                      value={setLevel.level}
                      validation='num'
                      errorMsg='Please enter a whole number'
                      onChange={updateFormData}
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
                        onChange={updateFormData}
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
                          onChange={updateFormData}
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
                            onChange={updateFormData}
                            required={true}
                          />
                        </Grid.Item>
                      )}
                      {formData.spellcasting?.maxSpellLevel &&
                        spellSlots(index).inputs.map((input, iIndex) => (
                          <Grid.Item key={iIndex} colSpan={'auto'}>
                            {input}
                          </Grid.Item>
                        ))}
                    </>
                  )}
                </Grid>
              </Grid.Item>
            ))}
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}

export default LevelAttributes
