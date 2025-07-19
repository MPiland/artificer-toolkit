import type { SectionFormDataType, FeatureOptionInput, FeatureInput } from '@/types'
import Accordion from '@/components/Accordion'
import { sprinkles } from '@/css/sprinkles.css'
import { startCase } from 'lodash'
import { SECTION_STEPS, withFieldGroup } from '@/components/Form'
import parse from 'html-react-parser'
import { useFeatureStore } from '@/store'
import { Group, Grid } from '@mantine/core'
import { useGetSections } from '@/hooks'
import { description } from '../Feature.css'

type SectionsListProps = {
  __kind?: 'FeatureInput' | 'FeatureOptionInput' | 'AncestryFeatureInput'
}

const defaultValues: {
  modifiers?: FeatureInput['modifiers']
  spells?: FeatureInput['spells']
  proficiencies?: FeatureInput['proficiencies']
  expertise?: FeatureInput['expertise']
  senses?: FeatureInput['senses']
  feats?: FeatureInput['feats']
  options?: FeatureInput['options']
} = {
  modifiers: undefined,
  spells: undefined,
  proficiencies: undefined,
  expertise: undefined,
  senses: undefined,
  feats: undefined,
  options: undefined,
}

const SectionsList = withFieldGroup({
  defaultValues,
  props: {
    __kind: undefined,
  } as SectionsListProps,
  render: function Render({ group, __kind }) {
    const { AppField } = group
    const featureStore = useFeatureStore()
    const { sectionTypeMap } = useGetSections()

    const handleEdit = (
      sectionStep: (typeof SECTION_STEPS)[number] | 'options',
      sectionItem: SectionFormDataType | FeatureOptionInput
    ) => {
      const sectionObject = sectionTypeMap(sectionStep).schema.parse(sectionItem)
      sectionTypeMap(sectionStep, sectionObject).setCurrent()
      featureStore.setStep(sectionStep)
    }

    const sectionsAndOptions = [...SECTION_STEPS, 'options'] as const

    return (
      <>
        {sectionsAndOptions.map((sectionStep, i) => {
          return (
            <AppField name={sectionStep} key={`${i}-${sectionStep}`} mode='array'>
              {(sectionArray) =>
                sectionArray.state.value?.length && (
                  <Grid.Col>
                    <Accordion dataArray={sectionArray.state.value} onChange={(dataArray) => sectionArray.handleChange(dataArray as string[])} disableSort={__kind !== 'FeatureOptionInput'}>
                      {sectionArray.state.value?.map((s, sI) => {
                        const sectionData = sectionTypeMap(sectionStep).get(s)
                        const section = sectionTypeMap(sectionStep).schema.parse(sectionData)
                        return (
                          section && (
                            <Accordion.Item key={`${i}-${sI}-${sectionStep}`} itemId={String(sI)} value={section.id}>
                              <Accordion.Trigger
                                key={sI}
                                removeFn={() => sectionArray.removeValue(sI)}
                                editFn={() => handleEdit(sectionStep, section)}
                              >
                                {`${startCase(sectionStep)} ${sI + 1}`}
                                {section.__kind === 'FeatureOptionInput' && (
                                  <>
                                    {section?.label}
                                    <Accordion.Content>
                                      <div className={description}>{section?.desc && parse(section?.desc)}</div>
                                    </Accordion.Content>
                                    <Group>
                                      {SECTION_STEPS.map((fSectionStep, fSIndex) => {
                                        return (
                                          <span
                                            key={fSIndex}
                                            className={sprinkles({
                                              me: 'space-3',
                                            })}
                                          >
                                            {section?.[fSectionStep]?.length ?
                                              <strong key={fSIndex}>
                                                {startCase(fSectionStep.charAt(0))}:{section[fSectionStep]?.length}
                                              </strong>
                                            : `${startCase(fSectionStep.charAt(0))}: 0`}
                                          </span>
                                        )
                                      })}
                                    </Group>
                                  </>
                                )}
                              </Accordion.Trigger>
                            </Accordion.Item>
                          )
                        )
                      })}
                    </Accordion>
                  </Grid.Col>
                )
              }
            </AppField>
          )
        })}
      </>
    )
  },
})

export default SectionsList
