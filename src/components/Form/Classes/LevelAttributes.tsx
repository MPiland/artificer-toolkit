import { ReactNode, useEffect } from 'react'
import Collapse from '../../Collapse/Collapse'
import { UpdateState } from '../../../types/form'
import { Class } from '../../../../amplify/API'
import { Attributes } from '../../../types/enums'
import { use } from 'react'
import FormContext from '../FormContext'
import Row from '../../Row/Row'
import Input from '../../Input/Input'

const LevelAttributes = ({
  formData,
  updateFormData,
}: {
  formData: Class
  updateFormData: (arg: UpdateState<Class>) => void
}) => {
  const { context } = use(FormContext)
  // Add level attribute table
  useEffect(() => {
    if (
      !formData.levelAttributes &&
      (formData.attributes?.some((attribute) => attribute === Attributes.spellcaster) ||
        (formData.attributes?.some((attribute) => attribute === Attributes.hasResourcePoints) &&
          formData.resource?.method === Attributes.setPerLevel))
    ) {
      updateFormData({
        type: 'add',
        path: 'levelAttributes',
      })
    }
  }, [formData.levelAttributes, updateFormData, formData.category, formData.attributes, formData.resource?.method])

  const spellSlots = (index?: number) => {
    const labels: ReactNode[] = []
    const inputs: ReactNode[] = []
    for (let i = 0; i < formData.spellcasting?.maxSpellLevel; i++) {
      labels.push(<span>`${i + 1}`</span>)
      inputs.push(
        <Input
          name={`spellSlots.${i}.count`}
          value={formData.levelAttributes[index].spellSlots[i].count}
          validation='num'
          required={true}
        />
      )
    }

    return { labels, inputs }
  }

  return (
    (formData.attributes?.some((attributeItem: any) => attributeItem.name === 'spellCaster') ||
      (formData.attributes?.some((attributeItem: any) => attributeItem.name === 'resource') &&
        formData.resource?.method === Attributes.setPerLevel)) && (
      <>
        <Collapse>
          <Collapse.Header title={'Level Attributes'} startOpened={context.type === 'new'} />
          <Collapse.Body>
            <Row spacing='spaceBetween' cellSize='auto'>
              <span>Level</span>
              {formData.attributes?.some((attributeItem: any) => attributeItem.name === 'resource') && (
                <span>`${formData.resource?.label ?? 'Resource'} Points`</span>
              )}
              {formData.attributes?.some((attributeItem: any) => attributeItem.name === 'spellCaster') && (
                <>
                  <span>Cantrips Known</span>
                  {formData.spellcasting?.attributes?.some(
                    (attribute) => attribute === Attributes.limitKnownSpells
                  ) && <span>Spells Known</span>}

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
                {formData.attributes?.some((attribute) => attribute === Attributes.hasResourcePoints) && (
                  <Input
                    name={`levelAttributes.${index}.resourcePoints`}
                    value={setLevel.resourcePoints}
                    validation='num'
                    errorMsg='Please enter a whole number'
                    onChange={updateFormData}
                    required={true}
                  />
                )}
                {formData.attributes?.some((attribute) => attribute === Attributes.spellcaster) && (
                  <>
                    <Input
                      name={`levelAttributes.${index}.cantripsKnownLimit`}
                      value={setLevel.cantripsKnownLimit}
                      validation='num'
                      errorMsg='Please enter a whole number'
                      onChange={updateFormData}
                      required={true}
                    />
                    {formData.spellcasting?.attributes?.some(
                      (attribute) => attribute === Attributes.limitKnownSpells
                    ) && (
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
      </>
    )
  )
}

export default LevelAttributes
