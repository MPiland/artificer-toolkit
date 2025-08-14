import {
  card_header,
  option_dropdown,
  CharacterFeatures,
  ClassSpells,
  class_title,
  CharacterProficiencies,
} from '~/components/Form'
import { Grid, Tabs, Button } from '@mantine/core'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import type { CharacterInput } from '~/types'
import { Categories } from '~/enums'
import parse from 'html-react-parser'
import Collapsible from '~/components/Collapse'
import { useFieldUpdates, useFormField } from '~/hooks'
import { useGetFeature, useGetClass, useListClasses } from '~/apis'
import { useSystemData } from '~/hooks'
import { parseDiceRoll } from '~/components/Dice'

const CharacterClasses = () => {
  const store = useTypedFormStore<CharacterInput>()
  const { AppField } = useFormField({ store })

  const { level, features, updateField } = useOptimizedSelector(store, (state) => ({
    level: state.current?.classes?.[0]?.level || 1,
    features: state.current?.features || [],
    updateField: state.updateField,
  }))

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const CharacterClass = ({ removeFn, classIndex }: { removeFn: () => void; classIndex: number }) => {
    const { classId } = useOptimizedSelector(store, (state) => ({
      classId: state.current?.classes?.[classIndex]?.id || '',
    }))
    const { data: fullClass } = useGetClass(classId)
    const { system } = useSystemData()
    const minLevelSpellcasting = fullClass?.levelAttributes?.find(
      (levelAttribute) => levelAttribute?.spellSlots?.length
    )?.level

    const hitPointAbility = system.abilities.find((ability) => fullClass?.hitpoint?.ability === ability.id)

    const { quantity, die } = parseDiceRoll(fullClass?.hitpoint?.dieConfig)
    return (
      <>
        <Grid>
          <Grid.Col>
            <h1 className={class_title}>{fullClass?.label}</h1>
            <Button
              color='danger'
              variant='outline'
              onClick={() => {
                removeFn()
              }}
            >
              Remove Class
            </Button>
          </Grid.Col>
          <AppField
            name={`classes[${classIndex}].level`}
            validators={fieldValidators({
              onChange: { type: 'number', min: 1, name: 'Level' },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col span={2}>
                <TextField label='Level' />
              </Grid.Col>
            )}
          </AppField>
        </Grid>
        <Tabs variant='outline' keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value='classFeatures'>Features</Tabs.Tab>
            {minLevelSpellcasting && fullClass?.spellcasting && level >= minLevelSpellcasting && (
              <Tabs.Tab value='classSpells'>Spells</Tabs.Tab>
            )}
          </Tabs.List>
          <Tabs.Panel value='classFeatures'>
            <Grid>
              <Grid.Col>
                <Collapsible
                  props={{
                    trigger: {
                      title: 'Hit Points',
                      className: card_header,
                    },
                  }}
                >
                  <>
                    {fullClass?.hitpoint?.dieConfig && quantity && die ?
                      <>
                        <div>
                          <strong>{'Hit Dice: '}</strong>
                          {`${fullClass?.hitpoint?.dieConfig} per ${fullClass?.label} level`}
                        </div>
                        <div>
                          <strong>{'Hit Points at 1st Level: '}</strong>
                          {`${quantity * die} + your ${hitPointAbility?.label} modifier`}
                        </div>
                        <div>
                          <strong>{'Hit Points at Higher Levels: '}</strong>
                          {`${fullClass?.hitpoint?.dieConfig} (or ${Math.round(quantity * (die / 2) + 0.5)}) + your ${
                            hitPointAbility?.label
                          } modifier per ${fullClass?.label} level after 1st`}
                        </div>
                      </>
                    : <div>
                        <strong>Class is missing hit point configuration</strong>
                      </div>
                    }
                  </>
                </Collapsible>
              </Grid.Col>
              {classIndex === 0 && fullClass?.proficiencies?.length && (
                <Grid.Col key={`character-proficiencies-${classIndex}`}>
                  <CharacterProficiencies index={classIndex} />
                </Grid.Col>
              )}
              {fullClass?.features?.length && (
                <>
                  <Grid.Col>
                    <Grid>
                      {features
                        ?.filter(
                          (feature) => Number(feature.level) <= Number(level) && feature.classId === fullClass.id
                        )
                        .sort((a, b) => Number(a.level) - Number(b.level))
                        .map((f, i) => (
                          <ClassFeature
                            key={`character-feature-${i}`}
                            id={f.id}
                            type='available'
                            classId={fullClass.id}
                            index={classIndex}
                          />
                        ))}
                    </Grid>
                  </Grid.Col>
                  <Grid.Col>
                    <hr />
                  </Grid.Col>
                  <Grid.Col>
                    <Collapsible
                      props={{
                        trigger: {
                          title: 'Features Available at Higher Levels',
                          className: card_header,
                        },
                      }}
                    >
                      <Grid>
                        {features
                          ?.filter(
                            (feature) => feature?.level && feature?.level > level && feature.classId === fullClass.id
                          )
                          .sort((a, b) => Number(a.level) - Number(b.level))
                          .map((f, fIndex) => (
                            <ClassFeature
                              key={`character-feature-${fIndex}`}
                              id={f.id}
                              type='unavailable'
                              classId={fullClass.id}
                              index={classIndex}
                            />
                          ))}
                      </Grid>
                    </Collapsible>
                  </Grid.Col>
                </>
              )}
            </Grid>
          </Tabs.Panel>
          {minLevelSpellcasting && fullClass?.spellcasting && level >= minLevelSpellcasting && (
            <Tabs.Panel value='classSpells'>
              <Grid>
                <ClassSpells index={classIndex} />
              </Grid>
            </Tabs.Panel>
          )}
        </Tabs>
      </>
    )
  }

  const ClassFeature = ({
    classId,
    id,
    index,
    type,
  }: {
    classId: string
    id: string
    index: number
    type: 'available' | 'unavailable'
  }) => {
    const { subclassId, featureLevel } = useOptimizedSelector(store, (state) => ({
      subclassId: state.current?.classes?.[index]?.subclass?.id || '',
      featureLevel: state.current?.classes?.[index]?.level || 1,
    }))

    const { data: feature } = useGetFeature(id)
    const { data: subclass } = useGetClass(subclassId)
    const {
      data: { classes, metaData },
    } = useListClasses()

    const subclassIds = metaData?.parentClasses?.filter((c) => c.classIds?.includes(classId)).map((c) => c.id)

    const subclasses = classes?.filter((c) => subclassIds?.includes(c.id))

    return type === 'available' ?
        <>
          {feature?.category === Categories.SUBCLASS && feature?.detail && parse(feature?.detail)}
          {feature?.desc && parse(feature?.desc)}
          {feature?.category === Categories.SUBCLASS && level && subclasses?.length && (
            <>
              <AppField name={`classes[${index}].subclass.id`} listeners={fieldListeners}>
                {({ DropdownField }) => (
                  <Grid.Col>
                    <DropdownField className={option_dropdown} label={'Subclass Option'} options={subclasses} />
                  </Grid.Col>
                )}
              </AppField>
              {subclass?.subtypes?.length && (
                <AppField name={`classes[${index}].subclass.subtype`} listeners={fieldListeners}>
                  {({ DropdownField }) => (
                    <Grid.Col>
                      <DropdownField
                        className={option_dropdown}
                        label={'Subtype Option'}
                        options={subclass?.subtypes || []}
                      />
                    </Grid.Col>
                  )}
                </AppField>
              )}
            </>
          )}
          <CharacterFeatures classId={classId} key={`character-class-features-${index}`} />
        </>
      : <Grid.Col>
          <Collapsible
            props={{
              trigger: {
                title: `(${featureLevel}) ${feature?.label}`,
                className: card_header,
              },
            }}
          >
            <Grid>
              {feature?.category === Categories.SUBCLASS && feature?.detail && parse(feature?.detail)}
              {feature?.desc && parse(feature?.desc)}
            </Grid>
          </Collapsible>
        </Grid.Col>
  }

  return (
    <AppField name='classes' mode='array'>
      {(classes) =>
        classes.state.value?.length &&
        classes.state.value?.map((_, i) => {
          return (
            <CharacterClass
              key={`character-class-${i}`}
              classIndex={i}
              removeFn={() => {
                updateField({ path: `classes[${i}]`, value: undefined })
                classes.removeValue(i)
              }}
            />
          )
        })
      }
    </AppField>
  )
}
export default CharacterClasses
