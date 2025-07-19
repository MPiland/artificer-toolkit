import { sprinkles } from '@/css/sprinkles.css'
import parse from 'html-react-parser'
import Collapsible from '@/components/Collapse'
import { parseDiceRoll } from '@/components/Dice'
import { Grid, Button, Tabs } from '@mantine/core'
import { useSystemData, useClassData, useFeatureData, useGetFeatures, useFieldUpdates } from '@/hooks'
import { ClassInputSchema } from '@/schemas'
import {
  withFieldGroup,
  class_title,
  card_header,
  option_dropdown,
  CharacterFeatures,
  CharacterProficiencies,
  ClassSpells,
} from '@/components/Form'
import type {
  CharacterFeatureInput,
  CharacterModifierInput,
  CharacterExpertiseInput,
  CharacterProficiencyInput,
  CharacterSenseInput,
  CharacterFeatInput,
  CharacterSpellcastingInput,
  CharacterAbilitiesInput,
  CharacterClassInput,
} from 'gql/types'
import { Categories } from '@/enums'
import { useStore } from '@tanstack/react-form'

type CharacterClassProps = {
  classIndex: number
  removeFn: () => void
}

const CharacterClass = withFieldGroup({
  defaultValues: {
    classInput: {} as CharacterClassInput | null | undefined,
    features: [] as CharacterFeatureInput[] | null | undefined,
    modifiers: [] as CharacterModifierInput[] | null | undefined,
    expertise: [] as CharacterExpertiseInput[] | null | undefined,
    proficiencies: [] as CharacterProficiencyInput[] | null | undefined,
    senses: [] as CharacterSenseInput[] | null | undefined,
    feats: [] as CharacterFeatInput[] | null | undefined,
    spellcasting: {} as CharacterSpellcastingInput | null | undefined,
    abilities: {} as CharacterAbilitiesInput | null | undefined,
  },
  props: {
    classIndex: 0,
    removeFn: () => undefined,
  } as CharacterClassProps,
  render: function Render({ group, classIndex, removeFn }) {
    const { AppField, Subscribe } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({
      data: 'form',
      replaceFn: (name) => name.replace('classInput', `classes[${classIndex}]`),
    })

    const { system } = useSystemData()

    const {
      classes: { findClass },
      subclasses: { findByParent, findSubclass },
    } = useClassData()

    const {
      features: { findFeature },
    } = useFeatureData()

    const { createFeatures } = useGetFeatures()
    const { uClass } = useStore(group.store, (state) => ({
      uClass: state.values.classInput,
    }))

    if (!uClass) return <></>

    const subclasses = findByParent(uClass.id)

    const fullClass = findClass(uClass.id)

    const features = createFeatures({ data: ClassInputSchema.parse(fullClass) })

    const minLevelSpellcasting = fullClass?.levelAttributes?.find(
      (levelAttribute) => levelAttribute?.spellSlots?.length
    )?.level

    const hitPointAbility = system.abilities.find((ability) => fullClass?.hitpoint?.ability === ability.id)

    const { quantity, die } = parseDiceRoll(fullClass?.hitpoint?.dieConfig)

    return (
      <Grid.Col>
        <Grid className={sprinkles({ mb: 'space-4' })}>
          <Grid.Col>
            <h1 className={class_title}>{fullClass?.label}</h1>
            <Button color='danger' variant='outline' onClick={removeFn}>
              Remove Class
            </Button>
          </Grid.Col>
          <AppField
            name='classInput.level'
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
            {minLevelSpellcasting && fullClass?.spellcasting && uClass.level >= minLevelSpellcasting && (
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
              {fullClass?.proficiencies?.length && (
                <CharacterProficiencies
                  form={group}
                  fields={{
                    classInput: 'classInput',
                    proficiencies: 'proficiencies',
                  }}
                  classIndex={classIndex}
                />
              )}
              {fullClass?.features?.length && (
                <>
                  <Grid.Col>
                    <Grid>
                      {features
                        .filter(
                          (feature) => Number(feature.level) <= Number(uClass.level) && feature.classId === uClass.id
                        )
                        .sort((a, b) => Number(a.level) - Number(b.level))
                        .map((f, i) => {
                          return (
                            <>
                              {f?.category === Categories.SUBCLASS && f?.detail && parse(f?.detail)}
                              {f?.desc && parse(f?.desc)}
                              {f?.category === Categories.SUBCLASS && uClass && classIndex && subclasses?.length && (
                                <>
                                  <AppField name='classInput.subclass.id' listeners={fieldListeners}>
                                    {({ DropdownField }) => (
                                      <Grid.Col>
                                        <DropdownField
                                          className={option_dropdown}
                                          label={'Subclass Option'}
                                          options={subclasses}
                                        />
                                      </Grid.Col>
                                    )}
                                  </AppField>
                                  <Subscribe selector={(state) => state.values.classInput?.subclass}>
                                    {(subclass) => {
                                      const fullSubclass = findSubclass(subclass?.id)
                                      if (fullSubclass?.subtypes?.length) {
                                        return (
                                          <AppField name='classInput.subclass.subtype' listeners={fieldListeners}>
                                            {({ DropdownField }) => (
                                              <Grid.Col>
                                                <DropdownField
                                                  className={option_dropdown}
                                                  label={'Subtype Option'}
                                                  options={fullSubclass?.subtypes ?? []}
                                                />
                                              </Grid.Col>
                                            )}
                                          </AppField>
                                        )
                                      }
                                    }}
                                  </Subscribe>
                                </>
                              )}
                              <CharacterFeatures
                                uClass={uClass}
                                key={i}
                                form={group}
                                fields={{
                                  features: 'features',
                                  modifiers: 'modifiers',
                                  expertise: 'expertise',
                                  proficiencies: 'proficiencies',
                                  senses: 'senses',
                                  feats: 'feats',
                                  spellcasting: 'spellcasting',
                                  abilities: 'abilities',
                                }}
                              />
                            </>
                          )
                        })}
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
                          .filter(
                            (feature) =>
                              feature?.level && feature?.level > uClass.level && feature.classId === uClass.id
                          )
                          .sort((a, b) => Number(a.level) - Number(b.level))
                          .map((feature, fIndex) => {
                            const fullFeature = findFeature(feature.id)
                            if (fullFeature) {
                              return (
                                <Grid.Col key={feature.id && fIndex}>
                                  <Collapsible
                                    props={{
                                      trigger: {
                                        title: `(${feature.level}) ${fullFeature.label}`,
                                        className: card_header,
                                      },
                                    }}
                                  >
                                    <Grid>
                                      {fullFeature.category === Categories.SUBCLASS &&
                                        fullFeature?.detail &&
                                        parse(fullFeature?.detail)}
                                      {fullFeature.desc && parse(fullFeature.desc)}
                                    </Grid>
                                  </Collapsible>
                                </Grid.Col>
                              )
                            }
                          })}
                      </Grid>
                    </Collapsible>
                  </Grid.Col>
                </>
              )}
            </Grid>
          </Tabs.Panel>
          {minLevelSpellcasting && fullClass?.spellcasting && uClass.level >= minLevelSpellcasting && (
            <Tabs.Panel value='classSpells'>
              <Grid>
                <ClassSpells
                  form={group}
                  fields={{
                    classInput: 'classInput',
                    spellcasting: 'spellcasting',
                  }}
                />
              </Grid>
            </Tabs.Panel>
          )}
        </Tabs>
      </Grid.Col>
    )
  },
})

export default CharacterClass
