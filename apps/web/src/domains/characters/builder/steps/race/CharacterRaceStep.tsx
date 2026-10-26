import { useEffect, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import { useSelector } from '@tanstack/react-form'
import { withForm } from '#forms/app-form/AppForm'
import type { CharacterBuilderGrantSummaryItemDto } from '@artificer-toolkit/schema/api/characters'
import { AppSelect } from '#ui/primitives/Select'
import type { CharacterFormValues } from '../../core/characterBuilder.types'
import { EMPTY_CHARACTER_FORM_VALUES } from '../../shared/formNormalization'
import { clearRaceDependents } from '../../shared/dependencyClearing'
import { choiceOptions, getAllChosenGrantChoices } from '../../choices/choiceOptions'
import * as styles from '../../shared/builderShared.css'
import {
  CHARACTER_BUILDER_TIMING_MARK,
  CHARACTER_BUILDER_TIMING_MEASURE,
  completeCharacterBuilderTiming,
  startCharacterBuilderTiming
} from '../../core/characterBuilder.performance'
import { CharacterSelectionModal } from '../../selection/CharacterSelectionModal'
import { buildRaceSelectionGroups } from '../../selection/characterSelectionOptions'
import { CharacterChosenGrantChoices } from '../../choices/CharacterChosenGrantChoices'
import { CharacterGrantedFeatures } from '../../choices/CharacterGrantedFeatures'
import { mergeRaceFeaturePresentation } from './raceFeaturePresentation'
import type { CharacterBuilderStepProps } from '../../core/CharacterBuilderStep.types'

export const CharacterRaceStep = withForm({
  defaultValues: EMPTY_CHARACTER_FORM_VALUES,
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterRace({ form, payload, readOnly }) {
    const [raceChooserOpened, setRaceChooserOpened] = useState(false)
    const [stagedRaceId, setStagedRaceId] = useState<string | null>(null)
    const raceIntent = useSelector(form.store, (state) => state.values.intent.race)
    const ancestrySelections = useSelector(
      form.store,
      (state) => state.values.intent.ancestrySelections
    )
    const measuredAncestryOptionRef = useRef<string | undefined>(undefined)
    const raceView = payload.view.race
    const selectedRaceId = raceIntent.subraceId ?? raceIntent.raceId ?? null
    const selectedRace = payload.references.races.find((race) => race.id === selectedRaceId)
    const selectedRaceLabel =
      selectedRace?.label ??
      [...raceView.raceOptions, ...raceView.subraceOptions].find(
        (option) => option.id === selectedRaceId
      )?.label
    const raceSelectionGroups = buildRaceSelectionGroups(payload.references.races, [
      ...raceView.raceOptions,
      ...raceView.subraceOptions
    ])
    const hasAncestryFeature = raceView.ancestry
      ? raceView.features.some((feature) => isAncestryFeature(feature, raceView.ancestry?.label))
      : false
    const featureGrantChoices = raceView.grantChoices.filter((choice) => choice.ownerFeatureId)
    const standaloneGrantChoices = raceView.grantChoices.filter((choice) => !choice.ownerFeatureId)
    const selectedAncestryOptionId = raceView.ancestry
      ? getSelectedAncestryOptionId(ancestrySelections, raceView.ancestry.ancestryId, raceIntent)
      : undefined
    const previewFeatures = selectedRace?.ancestry?.options.find(
      (option) => option.id === selectedAncestryOptionId
    )?.features
    const raceFeatures = mergeRaceFeaturePresentation(
      selectedAncestryOptionId && selectedAncestryOptionId !== raceView.ancestry?.selectedOptionId
        ? [
            ...raceView.features.filter((feature) => feature.source.kind !== 'ANCESTRY'),
            ...(previewFeatures ?? [])
          ]
        : raceView.features
    )
    const allGrantChoices = getAllChosenGrantChoices(payload.view)

    useEffect(() => {
      if (!selectedAncestryOptionId || !previewFeatures?.length) return
      if (measuredAncestryOptionRef.current === selectedAncestryOptionId) return

      measuredAncestryOptionRef.current = selectedAncestryOptionId
      completeCharacterBuilderTiming({
        endMark: CHARACTER_BUILDER_TIMING_MARK.ANCESTRY_PREVIEW,
        measure: CHARACTER_BUILDER_TIMING_MEASURE.ANCESTRY_PREVIEW,
        startMark: CHARACTER_BUILDER_TIMING_MARK.ANCESTRY_INTENT
      })
    }, [previewFeatures, selectedAncestryOptionId])

    return (
      <section className={styles.section} aria-labelledby='character-race-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-race-title' className={styles.sectionTitle}>
            {selectedRaceLabel ?? 'No race selected'}
          </h3>
          {!readOnly ? (
            <Button
              type='button'
              onClick={() => {
                setStagedRaceId(null)
                setRaceChooserOpened(true)
              }}
            >
              {selectedRaceId ? 'Change Race' : 'Choose Race'}
            </Button>
          ) : null}
        </div>
        {raceView.ancestry && !hasAncestryFeature ? (
          <div className={styles.inlinePanel}>{renderAncestryChoiceControl()}</div>
        ) : null}
        <form.AppField name='intent.chosenGrantSelections'>
          {(field) => (
            <>
              <CharacterChosenGrantChoices
                allChoices={allGrantChoices}
                choices={standaloneGrantChoices}
                selections={field.state.value}
                readOnly={readOnly}
                onChange={field.handleChange}
              />
              <form.AppField name='intent.featureAcquisitions'>
                {(featureField) => (
                  <CharacterGrantedFeatures
                    features={raceFeatures}
                    choices={raceView.featureChoices}
                    acquisitions={featureField.state.value}
                    readOnly={readOnly}
                    showTitle={false}
                    showSourceBadge={false}
                    renderFeatureControls={(feature) => (
                      <>
                        {isAncestryFeature(feature, raceView.ancestry?.label)
                          ? renderAncestryChoiceControl()
                          : null}
                        <CharacterChosenGrantChoices
                          allChoices={allGrantChoices}
                          choices={featureGrantChoices.filter(
                            (choice) => choice.ownerFeatureId === feature.id
                          )}
                          presentation='controls'
                          selections={field.state.value}
                          readOnly={readOnly}
                          onChange={field.handleChange}
                        />
                      </>
                    )}
                    onChange={featureField.handleChange}
                  />
                )}
              </form.AppField>
            </>
          )}
        </form.AppField>
        <CharacterSelectionModal
          title='Choose a race'
          description='Compare playable races and subraces before adding one to this character.'
          actionLabel={selectedRaceId ? 'Change Race' : 'Choose Race'}
          currentId={selectedRaceId}
          groups={raceSelectionGroups}
          opened={raceChooserOpened}
          selectedId={stagedRaceId}
          onSelectedIdChange={setStagedRaceId}
          onClose={() => {
            setStagedRaceId(null)
            setRaceChooserOpened(false)
          }}
          onCommit={(nextRaceId) => {
            const nextRace = payload.references.races.find((race) => race.id === nextRaceId)
            if (!nextRace || readOnly) return
            if (nextRaceId === selectedRaceId) {
              setStagedRaceId(null)
              setRaceChooserOpened(false)
              return
            }
            const clearedCharacter = clearRaceDependents(form.state.values)

            form.setFieldValue('intent', {
              ...clearedCharacter.intent,
              race:
                nextRace.category === 'SUBRACE' && nextRace.parentRaceId
                  ? { raceId: nextRace.parentRaceId, subraceId: nextRace.id }
                  : { raceId: nextRace.id }
            })
            setStagedRaceId(null)
            setRaceChooserOpened(false)
          }}
        />
      </section>
    )

    function renderAncestryChoiceControl() {
      const ancestry = raceView.ancestry
      if (!ancestry) return null

      return (
        <form.AppField name='intent.ancestrySelections'>
          {(field) => {
            const selectedAncestryOptionId = getSelectedAncestryOptionId(
              field.state.value,
              ancestry.ancestryId,
              raceIntent
            )

            return (
              <AppSelect
                label={`${ancestry.label} option`}
                data={choiceOptions(ancestry.options)}
                value={selectedAncestryOptionId}
                required
                disabled={readOnly}
                onChange={(value) => {
                  if (!value || readOnly) return
                  startCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.ANCESTRY_INTENT)
                  field.handleChange([
                    {
                      id: crypto.randomUUID(),
                      ancestryId: ancestry.ancestryId,
                      optionId: value,
                      source: raceIntent.subraceId
                        ? { kind: 'SUBRACE', subraceId: raceIntent.subraceId }
                        : { kind: 'RACE', raceId: raceIntent.raceId },
                      timing: { kind: 'IMMEDIATE' }
                    }
                  ])
                }}
              />
            )
          }}
        </form.AppField>
      )
    }
  }
})

function isAncestryFeature(
  feature: CharacterBuilderGrantSummaryItemDto,
  ancestryLabel: string | undefined
): boolean {
  return Boolean(
    ancestryLabel &&
    feature.label === ancestryLabel &&
    (feature.source.kind === 'RACE' || feature.source.kind === 'SUBRACE')
  )
}

function getSelectedAncestryOptionId(
  selections: CharacterFormValues['intent']['ancestrySelections'],
  ancestryId: string,
  raceIntent: CharacterFormValues['intent']['race']
): string | undefined {
  return selections?.find(
    (selection) =>
      selection.ancestryId === ancestryId && isCurrentAncestrySource(selection.source, raceIntent)
  )?.optionId
}

function isCurrentAncestrySource(
  source: NonNullable<CharacterFormValues['intent']['ancestrySelections']>[number]['source'],
  raceIntent: CharacterFormValues['intent']['race']
): boolean {
  if (source.kind === 'SUBRACE') return source.subraceId === raceIntent.subraceId
  if (source.kind === 'RACE') return source.raceId === raceIntent.raceId && !raceIntent.subraceId

  return false
}
