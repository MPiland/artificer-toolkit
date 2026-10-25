import { useEffect, useState, type ComponentProps } from 'react'
import { GuidedBackgroundAuthoring } from '#domains/backgrounds/guided/GuidedBackgroundAuthoring'
import { GuidedClassAuthoring } from '#domains/classes/guided/GuidedClassAuthoring'
import { GuidedCreatureAuthoring } from '#domains/creatures/guided/GuidedCreatureAuthoring'
import { GuidedEquipmentAuthoring } from '#domains/equipment/guided/GuidedEquipmentAuthoring'
import { GuidedFeatAuthoring } from '#domains/feats/guided/GuidedFeatAuthoring'
import { GuidedRaceAuthoring } from '#domains/races/guided/GuidedRaceAuthoring'
import { GuidedSpellAuthoring } from '#domains/spells/guided/GuidedSpellAuthoring'
import { GuidedVehicleAuthoring } from '#domains/vehicles/guided/GuidedVehicleAuthoring'
import type { AuthoredFormSession } from '../factories/authoredFormFactories.types'
import type { GuidedAuthoringStateHandler } from './guidedAuthoring.types'
import { GuidedStartChoice } from './GuidedStartChoice'
import { isRecord } from '#forms/utils/valueGuards'

type GuidedAuthoringProps = {
  form: ComponentProps<typeof GuidedSpellAuthoring>['form']
  onAdvanced: (() => void) | undefined
  onStateChange: GuidedAuthoringStateHandler
  session: AuthoredFormSession
}

export function GuidedAuthoring({
  form,
  onAdvanced,
  onStateChange,
  session
}: GuidedAuthoringProps) {
  const [started, setStarted] = useState(
    () => session.mode !== 'create' || hasMeaningfulGuidedValues(form.state.values)
  )

  useEffect(() => {
    if (!started) onStateChange({ isReview: false, showPreview: false })
  }, [onStateChange, started])

  if (!started) {
    return (
      <GuidedStartChoice
        domain={session.domain}
        domainLabel={session.subjectKindLabel}
        systemId={session.systemId}
        onAdvanced={onAdvanced}
        onFresh={() => setStarted(true)}
      />
    )
  }

  const { system } = session
  if (!system) return null

  switch (session.domain) {
    case 'background':
      return (
        <GuidedBackgroundAuthoring
          form={form}
          onAdvanced={onAdvanced}
          onStateChange={onStateChange}
          session={session}
          system={system}
        />
      )
    case 'class':
      return (
        <GuidedClassAuthoring
          form={form}
          onAdvanced={onAdvanced}
          onStateChange={onStateChange}
          session={session}
          system={system}
        />
      )
    case 'creature':
      return (
        <GuidedCreatureAuthoring
          form={form}
          onAdvanced={onAdvanced}
          onStateChange={onStateChange}
          session={session}
          system={system}
        />
      )
    case 'equipment':
      return (
        <GuidedEquipmentAuthoring
          form={form}
          onAdvanced={onAdvanced}
          onStateChange={onStateChange}
          session={session}
          system={system}
        />
      )
    case 'feat':
      return (
        <GuidedFeatAuthoring
          form={form}
          onAdvanced={onAdvanced}
          onStateChange={onStateChange}
          session={session}
          system={system}
        />
      )
    case 'race':
      return (
        <GuidedRaceAuthoring
          form={form}
          onAdvanced={onAdvanced}
          onStateChange={onStateChange}
          session={session}
          system={system}
        />
      )
    case 'spell':
      return (
        <GuidedSpellAuthoring
          form={form}
          isExistingDraft={session.mode === 'edit'}
          onAdvanced={onAdvanced}
          onStateChange={onStateChange}
          system={system}
        />
      )
    case 'vehicle':
      return (
        <GuidedVehicleAuthoring
          form={form}
          onAdvanced={onAdvanced}
          onStateChange={onStateChange}
          session={session}
          system={system}
        />
      )
  }
}

function hasMeaningfulGuidedValues(values: object) {
  const record: Record<string, unknown> = isRecord(values) ? values : {}
  return (
    (typeof record.label === 'string' && record.label.trim().length > 0) ||
    ['effects', 'features', 'details'].some(
      (key) => Array.isArray(record[key]) && record[key].length > 0
    )
  )
}
