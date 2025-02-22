import { ReactNode, useEffect } from 'react'
import Collapse from '../../Collapse/Collapse'
import { UpdateState } from '../../../types/form'
import { Class } from '../../../../amplify/gql/types'
import { Attributes } from '../../../types/enums'
import Row from '../../Row/Row'
import Input from '../../Input/Input'
import { useEnumChecks } from '../../../hooks/useEnumChecks'

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
    for (let i = 0; i < formData.spellcasting?.maxSpellLevel; i++) {
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

    return { labels, inputs }
  }

  return (
    <Collapse>
      <Collapse.Header title={'Level Attributes'} startOpened={formData.id == null} />
      <Collapse.Body>
        <Row spacing='spaceBetween' cellSize='auto'>
          <span>Level</span>
          {hasResourcePoints && <span>{formData.resource?.label ?? 'Resource'} Points</span>}
          {isSpellcaster && (
            <>
              <span>Cantrips Known</span>
              {limitKnownSpells && <span>Spells Known</span>}

              {formData.spellcasting?.maxSpellLevel && spellSlots().labels.map((label) => label)}
            </>
          )}
        </Row>
        {formData?.levelAttributes?.map((setLevel, index) => (
          <Row key={index} spacing='spaceBetween' cellSize='auto'>
            <Input
              name={`levelAttributes.${index}.level`}
              value={setLevel.level}
              validation='num'
              errorMsg='Please enter a whole number'
              onChange={updateFormData}
              required={true}
            />
            {hasResourcePoints && (
              <Input
                name={`levelAttributes.${index}.resourcePoints`}
                value={setLevel.resourcePoints}
                validation='num'
                errorMsg='Please enter a whole number'
                onChange={updateFormData}
                required={true}
              />
            )}
            {isSpellcaster && (
              <>
                <Input
                  name={`levelAttributes.${index}.cantripsKnownLimit`}
                  value={setLevel.cantripsKnownLimit}
                  validation='num'
                  errorMsg='Please enter a whole number'
                  onChange={updateFormData}
                  required={true}
                />
                {limitKnownSpells && (
                  <Input
                    name={`levelAttributes.${index}.spellsKnownLimit`}
                    value={setLevel.spellsKnownLimit}
                    validation='num'
                    errorMsg='Please enter a whole number'
                    onChange={updateFormData}
                    required={true}
                  />
                )}
                {formData.spellcasting?.maxSpellLevel && spellSlots(index).inputs.map((input) => input)}
              </>
            )}
          </Row>
        ))}
      </Collapse.Body>
    </Collapse>
  )
}

export default LevelAttributes
