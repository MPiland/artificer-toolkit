import { useEffect } from 'react'
import ScrollArea from '../../ScrollArea/ScrollArea'
import Accordion from '../../Accordion/Accordion'
import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Spinner from '../../Spinner/Spinner'
import Button from '../../Button/Button'
import { sprinkles } from '../../../css/sprinkles.css'
import Group from '../../Group/Group'
import { isEqual, startCase } from 'lodash'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { useListEquipmentQuery } from '../../../features/equipment/equipmentApi'
import { useIsFetching } from '@tanstack/react-query'
import { Class, SectionEnum } from '../../../../amplify/API'
import { Attributes, Measurement } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import FormContext from '../FormContext'

const Proficiencies = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Class
    updateFormData: (state: UpdateState<Class>) => void
  }

  const isLoading = useIsFetching() > 0

  const { data: system } = useGetSystemQuery()
  const { data: equipment } = useListEquipmentQuery()

  useEffect(() => {
    if (formData?.proficiencies?.length > 0) {
      const formClone: Class = JSON.parse(JSON.stringify(formData))
      formClone?.proficiencies?.forEach((proficiency, index) => {
        if (
          !proficiency?.level ||
          (proficiency?.level !== Measurement.full && proficiency?.level !== Measurement.half)
        ) {
          const proficiencyLevel = system.proficiencies.levels.find((level) => level.id === Measurement.full)
          formClone.proficiencies[index].level = proficiencyLevel.id
        }
      })
      if (!isEqual(formClone, formData)) {
        updateFormData({
          type: 'reset',
          value: formClone,
        })
      }
    }
  }, [system.proficiencies.levels, formData, updateFormData])

  return isLoading || !system || !equipment ? (
    <Spinner />
  ) : (
    <>
      <Group>
        <Button
          color='primary'
          style='outline'
          onClick={() => {
            updateFormData({ type: 'add', path: 'proficiencies' })
          }}
          className={sprinkles({ mb: 'space-2' })}
        >
          Add Proficiency
        </Button>
      </Group>

      <ScrollArea scrollDirection='vertical'>
        {formData.proficiencies && (
          <Accordion dataArray={formData.proficiencies} name='proficiencies' onChange={updateFormData}>
            {formData.proficiencies?.map((proficiency, index) => {
              const multipleOptions = proficiency.attributes?.some(
                (attribute) => attribute === Attributes.providesOptions
              )
              const categoryName = system.categories.find((category) => category.id === proficiency.category).value as
                | 'abilities'
                | 'skills'
                | 'properties'
                | 'equipment'
                | 'languages'
                | 'saveAbilities'
              return (
                <Accordion.Wrapper key={index} itemId={String(index)}>
                  <Accordion.Header
                    handleRemove={() =>
                      updateFormData({
                        type: 'remove',
                        path: `proficiencies.${index}`,
                      })
                    }
                  >
                    {`Proficiency ${index + 1}`}
                  </Accordion.Header>
                  <Accordion.Content>
                    <Row>
                      <Dropdown
                        multiSelect={true}
                        name={`proficiencies.${index}.attributes`}
                        options={system.attributes.filter(
                          (attribute) =>
                            attribute?.sections.includes(SectionEnum.all) &&
                            attribute?.sections.includes(SectionEnum.subclasses)
                        )}
                        label='Proficiency Attribute'
                        value={proficiency.attributes}
                        onChange={updateFormData}
                      />
                      <Dropdown
                        name={`proficiencies.${index}.category`}
                        label='Proficiency Category'
                        value={proficiency.category}
                        options={system.proficiencies.categories}
                        required={true}
                        onChange={updateFormData}
                      />
                      {categoryName != null &&
                        categoryName !== 'abilities' &&
                        (categoryName !== 'properties' && categoryName !== 'equipment' ? (
                          <Dropdown
                            name={`proficiencies.${index}.saveAbilities`}
                            multiSelect={true}
                            label={`${startCase(categoryName)} Type`}
                            value={proficiency[categoryName]}
                            options={categoryName === 'saveAbilities' ? system.abilities : system[categoryName]}
                            required={true}
                            onChange={updateFormData}
                          />
                        ) : (
                          <>
                            <Dropdown
                              name={`proficiencies.${index}.${categoryName}.category`}
                              label='Item Category'
                              value={proficiency[categoryName]?.category}
                              options={system.equipment.categories}
                              required={true}
                              onChange={updateFormData}
                            />
                            <Dropdown
                              name={`proficiencies.${index}.${categoryName}.${
                                categoryName === 'equipment' ? 'properties' : 'ids'
                              }`}
                              multiSelect={true}
                              label='Item Properties'
                              value={
                                categoryName === 'equipment'
                                  ? proficiency.equipment?.properties
                                  : proficiency.properties.ids
                              }
                              options={equipment}
                              filters={[
                                {
                                  key: 'category',
                                  dataObject: proficiency[categoryName],
                                  mapKey: 'properties',
                                  type: 'equal',
                                },
                              ]}
                              onChange={updateFormData}
                              required={categoryName === 'equipment' ? false : true}
                            />
                            {categoryName === 'equipment' && (
                              <>
                                <Dropdown
                                  name={`proficiencies.${index}.${categoryName}.ids`}
                                  multiSelect={true}
                                  label='Item'
                                  value={proficiency[categoryName]?.ids}
                                  options={equipment}
                                  filters={[
                                    {
                                      key: 'category.id',
                                      dataObject: proficiency[categoryName],
                                      type: 'equal',
                                    },
                                    {
                                      key: 'properties.ids',
                                      dataObject: proficiency[categoryName],
                                      type: 'equal',
                                    },
                                  ]}
                                  onChange={updateFormData}
                                  required={true}
                                />
                              </>
                            )}
                          </>
                        ))}
                      {proficiency.attributes?.some((attribute) => attribute === Attributes.subtypeSpecific) && (
                        <Dropdown
                          name={`proficiencies.${index}.subtype`}
                          label='Subtype'
                          value={proficiency?.subtype}
                          options={formData.subtypes}
                          required={true}
                          onChange={updateFormData}
                        />
                      )}
                      {multipleOptions && (
                        <Input
                          validation='num'
                          name={`proficiencies.${index}.selectionCount`}
                          label='# of Selections'
                          autoComplete='off'
                          value={proficiency.selectionCount}
                          errorMsg='Must contain only numbers'
                          required={true}
                          onChange={updateFormData}
                        />
                      )}
                    </Row>
                  </Accordion.Content>
                </Accordion.Wrapper>
              )
            })}
          </Accordion>
        )}
      </ScrollArea>
    </>
  )
}

export default Proficiencies
