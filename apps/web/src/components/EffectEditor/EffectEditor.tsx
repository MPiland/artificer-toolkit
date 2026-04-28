import { useState } from 'react'
import { Button, Group, Stack, Text, Title } from '@mantine/core'
import type { EffectDto } from '@artificer-toolkit/schema'
import { FullscreenModal } from '#components/Modal/FullscreenModal'
import { EffectEditorModal, getEffectEditorTitleId } from './EffectEditorModal'
import { EffectSummaryCard } from './EffectSummaryCard'
import type { EffectEditorFormApi, EffectEditorReferenceData } from './effectEditor.types'
import { sectionPanel } from './EffectEditor.css'
import { createDefaultEffect } from './effectEditor.utils'

export type { EffectEditorReferenceData } from './effectEditor.types'

export function EffectEditor({
  effects,
  form,
  references,
  readOnly,
  sourceLabel = 'Content'
}: {
  effects: EffectDto[]
  form: EffectEditorFormApi
  references: EffectEditorReferenceData
  readOnly?: boolean
  sourceLabel?: string
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activeEffect = activeIndex == null ? null : effects[activeIndex]
  const modalTitleId = activeEffect ? getEffectEditorTitleId(activeEffect.id) : undefined

  function updateEffects(next: EffectDto[]) {
    if (!readOnly) form.setFieldValue('effects', next)
  }

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
            updateEffects([...effects, createDefaultEffect(effects.length + 1)])
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
                  onRemove={() => updateEffects(effects.filter((item) => item.id !== effect.id))}
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
              <EffectEditorModal
                effect={activeEffect}
                index={activeIndex}
                references={references}
                readOnly={readOnly}
                sourceLabel={sourceLabel}
                titleId={modalTitleId}
                onChange={(next) => updateEffects(effects.map((item, itemIndex) => itemIndex === activeIndex ? next : item))}
                onClose={() => setActiveIndex(null)}
              />
            )
          : null}
      </FullscreenModal>
    </section>
  )
}
