import type { FormDataType, CharacterInput, SpellInput } from '~types'
import Accordion from '~components/Accordion'
import { startCase } from 'lodash-es'
import { SECTION_STEPS, Modifiers, Proficiencies, Expertise, Senses, Spells, Feats } from '~components/Form'
import { ScrollArea } from '@mantine/core'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import type { UnionToIntersection, SetOptional } from 'type-fest'
import { useFormField } from '~hooks'
import { useMemo, useCallback } from 'react'

type FeaturePath =
  | `ancestry.options[${number}].features[${number}]`
  | `ancestry.options[${number}].features[${number}].options[${number}]`
  | `features[${number}]`
  | `features[${number}].options[${number}]`

type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput | SpellInput>, '__kind'>>

const SectionsList = () => {
  const store = useTypedFormStore<StoreType>()

  const { AppField } = useFormField({ store })

  const { sectionIndex, setEditing, meta, stateKind } = useOptimizedSelector(store, (state) => ({
    sectionIndex: state.meta.editing.sectionIndex || 0,
    setEditing: state.setEditing,
    meta: state.meta,
    stateKind: state.current?.__kind,
  }))

  const computePath = useCallback(() => {
    const segments: string[] = []

    if (meta.editing.ancestryOptionIndex && stateKind === 'RaceInput') {
      segments.push(`ancestry.options[${meta.editing.ancestryOptionIndex}]`)
    }

    if (meta.editing.featureIndex !== undefined) {
      segments.push(`features[${meta.editing.featureIndex}]`)
    }

    if (meta.editing.optionIndex !== undefined) {
      segments.push(`options[${meta.editing.optionIndex}]`)
    }

    return segments.join('.') + '.'
  }, [meta, stateKind])

  const formPath = useMemo(() => {
    return computePath()
  }, [computePath]) as FeaturePath

  const sectionMap = {
    modifiers: <Modifiers />,
    spells: <Spells />,
    proficiencies: <Proficiencies />,
    expertise: <Expertise />,
    senses: <Senses />,
    feats: <Feats />,
  }

  return (
    <ScrollArea scrollbars='y'>
      <Accordion disableSort={true}>
        {SECTION_STEPS.map((sectionStep, i) => {
          return (
            <Accordion.Item key={`${sectionStep}-${i}`} itemId={String(i)} value={String(i)}>
              <AppField name={`${formPath}.${sectionStep}`} key={`${sectionStep}-${i}`} mode='array'>
                {(sectionArray) =>
                  sectionArray.state.value?.length && (
                    <Accordion disableSort={true}>
                      {sectionArray.state.value?.map((section, sI) => (
                        <Accordion.Item key={`${sectionStep}-${i}-${sI}`} itemId={String(sI)} value={section.id}>
                          <Accordion.Trigger
                            key={sI}
                            removeFn={() => sectionArray.removeValue(sI)}
                            title={`${startCase(sectionStep)} ${sI + 1}`}
                            onClick={() => setEditing({ sectionIndex: sI, sectionType: sectionStep })}
                          />
                          <Accordion.Content>{sectionIndex === sI && sectionMap[sectionStep]}</Accordion.Content>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  )
                }
              </AppField>
            </Accordion.Item>
          )
        })}
      </Accordion>
    </ScrollArea>
  )
}

export default SectionsList
