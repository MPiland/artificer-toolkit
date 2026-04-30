import { useState } from 'react'
import { Button, Group, Stack, Text, Title } from '@mantine/core'
import type { EffectDto } from '@artificer-toolkit/schema'
import { withFieldGroup } from '#components/Form/runtime'
import { FullscreenModal } from '#app/ui/overlays/Modal/FullscreenModal'
import { EffectSummaryCard } from './components/EffectSummaryCard'
import { EffectEditorModalBridge } from './modal/EffectEditorModalBridge'
import type { EffectEditorReferenceData } from './effectEditor.types'
import { sectionPanel } from './EffectEditor.css'
import { createDefaultEffect, getEffectEditorTitleId } from './effectEditor.utils'

type EffectEditorFieldGroupValues = {
  effects?: EffectDto[]
}

const effectEditorDefaultValues: EffectEditorFieldGroupValues = {
  effects: []
}

const emptyReferences: EffectEditorReferenceData = {
  damageTypes: [],
  conditionTypes: [],
  creatures: []
}

export const EffectEditorFieldGroup = withFieldGroup({
  defaultValues: effectEditorDefaultValues,
  props: {
    references: emptyReferences,
    readOnly: false,
    sourceLabel: ''
  },
  render: function EffectEditorFieldGroupRender({ group, references, readOnly, sourceLabel }) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null)

    return (
      <group.Subscribe selector={(state) => state.values.effects}>
        {(values) => {
          const effects = values ?? []
          const activeEffect = activeIndex == null ? null : effects[activeIndex]
          const modalTitleId = activeEffect ? getEffectEditorTitleId(activeEffect.id) : undefined

          return (
            <section className={sectionPanel} aria-labelledby='effects-heading'>
              <Group justify='space-between' align='flex-start'>
                <Stack gap={4}>
                  <Title id='effects-heading' order={2}>Effects</Title>
                  <Text c='dimmed' size='sm'>
                    Define how this content is used in play: invocation, outcome paths, and the results that happen.
                  </Text>
                </Stack>
                <Button
                  disabled={readOnly}
                  onClick={() => {
                    group.setFieldValue('effects', [...effects, createDefaultEffect(effects.length + 1)])
                    setActiveIndex(effects.length)
                  }}
                >
                  Add effect
                </Button>
              </Group>

              {effects.length === 0
                ? (
                    <Text c='dimmed'>No effects yet. Add one when this content needs engine-backed play behavior.</Text>
                  )
                : (
                    <Stack gap='md'>
                      {effects.map((effect, index) => (
                        <EffectSummaryCard
                          key={effect.id}
                          effect={effect}
                          index={index}
                          readOnly={readOnly}
                          onEdit={() => setActiveIndex(index)}
                          onRemove={() => {
                            group.setFieldValue('effects', effects.filter((item) => item.id !== effect.id))
                          }}
                        />
                      ))}
                    </Stack>
                  )}

              <FullscreenModal
                opened={activeEffect != null}
                onClose={() => setActiveIndex(null)}
                labelledBy={modalTitleId}
              >
                {activeEffect && activeIndex != null
                  ? (
                      <EffectEditorModalBridge
                        key={activeEffect.id}
                        effect={activeEffect}
                        index={activeIndex}
                        references={references}
                        readOnly={readOnly}
                        sourceLabel={sourceLabel}
                        titleId={modalTitleId}
                        onChange={(nextEffect: EffectDto) => {
                          group.setFieldValue('effects', effects.map((effect, effectIndex) => (
                            effectIndex === activeIndex ? nextEffect : effect
                          )))
                        }}
                        onClose={() => setActiveIndex(null)}
                      />
                    )
                  : null}
              </FullscreenModal>
            </section>
          )
        }}
      </group.Subscribe>
    )
  }
})
