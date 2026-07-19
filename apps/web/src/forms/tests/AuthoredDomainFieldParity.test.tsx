import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useMemo } from 'react'
import { useStore } from '@tanstack/react-form'
import { afterEach, describe, expect, it } from 'vitest'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { backgroundAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import {
  authoredRouteStoryRecords,
  authoredRouteStorySystem,
  seedStorySystemId,
  seedStoryUserId
} from '#domains/authoredRouteStory.fixtures'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { authoredFormFactories } from '../factories/authoredFormFactories'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'
import { AuthoringLayout } from '../layout/AuthoringLayout'
import { createStaticResolvedFormModel } from '../node-map/staticResolvedModel'
import { FormRenderer } from '../rendering/FormRenderer'
import { isRenderableNode } from '../rendering/FormRenderer.utils'
import { useAppForm } from '../app-form/AppForm'

type BranchScenario = {
  domain: AuthoredFormDomain
  label: string
  record: Record<string, unknown>
}

type ResolvedContext = {
  model: NodeRuntimeResolveResponseDto
  values: Record<string, unknown>
}

const SYSTEM_MANAGED_PATH_KEYS = new Set([
  'grantKind',
  'id',
  'kind',
  'order',
  'status',
  'systemId',
  'userId'
])

const scenarios = createBranchScenarios()
const RegistrationRenderer = FormRenderer<Record<string, unknown>>({ defaultValues: {} })

afterEach(cleanup)

describe('authored domain schema, adapter, node, and field parity', () => {
  it.each(scenarios)(
    '$label exposes every populated authored field through its node tree',
    (scenario) => {
      const parsedRecord = parseScenarioRecord(scenario)
      const formValues = toActualFormValues(scenario.domain, parsedRecord)
      const { authoredPaths, contexts, systemPaths } = collectResolvedParity(
        scenario.domain,
        formValues
      )
      const formPaths = collectValueLeafPaths(formValues).filter(
        (path) => !isSystemManagedPath(path) && !systemPaths.has(path)
      )

      expect(contexts.length).toBeGreaterThan(0)
      expect([...formPaths].filter((path) => !authoredPaths.has(path))).toEqual([])
    }
  )

  for (const scenario of scenarios) {
    it(
      `${scenario.label} registers every visible resolved node with TanStack Form`,
      async () => {
        const parsedRecord = parseScenarioRecord(scenario)
        const formValues = toActualFormValues(scenario.domain, parsedRecord)
        const { contexts } = collectResolvedParity(scenario.domain, formValues)

        render(
          <TestRouterProvider>
            {contexts.map((context, index) => (
              <RegistrationHarness
                key={`${context.model.mapId}-${index}`}
                index={index}
                model={context.model}
                values={context.values}
              />
            ))}
          </TestRouterProvider>
        )

        await waitFor(() => {
          contexts.forEach((context, index) => {
            const registered = new Set<string>(
              JSON.parse(screen.getByTestId(`registered-fields-${index}`).textContent ?? '[]')
            )
            const expectedFieldNames = getDirectRenderableFieldNames(context.model)
            expect(expectedFieldNames.filter((fieldName) => !registered.has(fieldName))).toEqual([])
          })
        })
      },
      scenario.label === 'spell material and deep effects'
        ? 15_000
        : scenario.domain === 'equipment'
          ? 15_000
          : 5_000
    )
  }
})

function RegistrationHarness({
  index,
  model,
  values
}: {
  index: number
  model: NodeRuntimeResolveResponseDto
  values: Record<string, unknown>
}) {
  const defaultValues = useMemo(() => structuredClone(values), [values])
  const form = useAppForm({
    defaultValues,
    onSubmit: async () => undefined
  })
  const registeredFields = useStore(form.store, (state) => Object.keys(state.fieldMeta).sort())

  return (
    <AuthoringLayout>
      <form.AppForm>
        <RegistrationRenderer
          form={form}
          mapId={model.mapId}
          model={model}
          renderAllSteps
          resolveModel={false}
          updateAuthoringState={false}
        />
        <output data-testid={`registered-fields-${index}`}>
          {JSON.stringify(registeredFields)}
        </output>
      </form.AppForm>
    </AuthoringLayout>
  )
}

function createBranchScenarios(): BranchScenario[] {
  const wizard = authoredRouteStoryRecords.class
  const {
    startingGold: _startingGold,
    startingEquipment: _startingEquipment,
    hitpoint: _hitpoint,
    multiclass: _multiclass,
    ...classCommon
  } = wizard
  const creature = authoredRouteStoryRecords.creature
  const equipment = authoredRouteStoryRecords.equipment
  const dragonborn = authoredRouteStoryRecords.race
  const fireball = authoredRouteStoryRecords.spell

  return [
    { domain: 'background', label: 'background', record: authoredRouteStoryRecords.background },
    { domain: 'class', label: 'class base', record: wizard },
    {
      domain: 'class',
      label: 'class subclass',
      record: {
        ...classCommon,
        id: 'story-subclass',
        label: 'School of Tests',
        category: 'SUBCLASS',
        parentClassId: wizard.id,
        specializations: [{ id: 'story-specialization', label: 'Test School', order: 1 }]
      }
    },
    {
      domain: 'creature',
      label: 'creature monster',
      record: { ...creature, id: 'story-monster', label: 'Test Monster', category: 'MONSTER' }
    },
    {
      domain: 'creature',
      label: 'creature beast profiles',
      record: {
        ...creature,
        id: 'story-beast',
        label: 'Test Beast',
        category: 'BEAST',
        cost: { amount: 25, currencyId: authoredRouteStorySystem.currencies[0]!.id },
        carryingCapacity: { amount: 300, unit: 'POUNDS' },
        logisticsNotes: ['Requires feed'],
        mountProfile: {
          mountType: 'CONTROLLED',
          capacity: 2,
          riderCount: 1,
          notes: 'Trained mount'
        }
      }
    },
    {
      domain: 'creature',
      label: 'creature npc profile',
      record: {
        ...creature,
        npcProfile: {
          bonds: ['The temple'],
          flaws: ['Too trusting'],
          ideals: ['Charity'],
          personalityTraits: ['Patient']
        }
      }
    },
    {
      domain: 'creature',
      label: 'creature companion profile',
      record: {
        ...creature,
        id: 'story-companion',
        label: 'Test Companion',
        category: 'COMPANION',
        companionProfile: {
          bondType: 'ANIMAL_COMPANION',
          initiativeMode: 'USES_PC_INITIATIVE',
          notes: 'Stays close'
        }
      }
    },
    {
      domain: 'creature',
      label: 'creature summon profile',
      record: {
        ...creature,
        id: 'story-summon',
        label: 'Test Summon',
        category: 'SUMMON',
        companionProfile: {
          bondType: 'SUMMON',
          initiativeMode: 'OWN_INITIATIVE',
          notes: 'Temporary ally'
        }
      }
    },
    { domain: 'equipment', label: 'equipment base', record: equipment },
    {
      domain: 'equipment',
      label: 'equipment stackable',
      record: {
        ...equipment,
        id: 'story-stackable-equipment',
        label: 'Test Ammunition',
        attributes: ['STACKABLE'],
        maxStack: 20
      }
    },
    {
      domain: 'equipment',
      label: 'equipment limited use',
      record: {
        ...equipment,
        id: 'story-limited-equipment',
        label: 'Test Charged Item',
        attributes: ['LIMITED_USE'],
        charges: {
          id: 'story-equipment-charges',
          resetKind: 'MANUAL',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 3,
          bonuses: []
        }
      }
    },
    {
      domain: 'equipment',
      label: 'equipment variant',
      record: {
        kind: 'EQUIPMENT',
        id: 'story-equipment-variant',
        label: 'Test Longsword Variant',
        description: 'A variant used by the authoring parity gate.',
        status: 'ACTIVE',
        rarityId: equipment.rarityId,
        userId: seedStoryUserId,
        systemId: seedStorySystemId,
        category: 'VARIANT',
        parentEquipmentId: equipment.id,
        properties: ['MAGIC'],
        requiresAttunement: true
      }
    },
    { domain: 'feat', label: 'feat', record: authoredRouteStoryRecords.feat },
    {
      domain: 'race',
      label: 'race base ancestry',
      record: {
        ...dragonborn,
        ancestry: {
          id: 'story-ancestry',
          label: 'Draconic Ancestry',
          description: 'Choose a draconic ancestor.',
          options: [
            {
              id: 'story-ancestry-red',
              label: 'Red Dragon',
              description: 'Fire ancestry.',
              order: 1,
              features: dragonborn.features
            }
          ]
        }
      }
    },
    {
      domain: 'race',
      label: 'race subrace',
      record: {
        id: 'story-subrace',
        label: 'Test Subrace',
        description: 'A subrace used by the authoring parity gate.',
        status: 'ACTIVE',
        category: 'SUBRACE',
        parentRaceId: dragonborn.id,
        details: dragonborn.details,
        features: dragonborn.features,
        userId: seedStoryUserId,
        systemId: seedStorySystemId
      }
    },
    { domain: 'spell', label: 'spell material and deep effects', record: fireball },
    {
      domain: 'spell',
      label: 'spell without material',
      record: {
        ...fireball,
        id: 'story-spell-no-material',
        label: 'Test Cantrip',
        components: ['VERBAL', 'SOMATIC'],
        materialDescription: undefined,
        effects: []
      }
    },
    { domain: 'vehicle', label: 'vehicle', record: authoredRouteStoryRecords.vehicle }
  ]
}

function parseScenarioRecord({ domain, record }: BranchScenario): Record<string, unknown> {
  switch (domain) {
    case 'background':
      return backgroundAuthoringInputDtoSchema.parse(record)
    case 'class':
      return classAuthoringInputDtoSchema.parse(record)
    case 'creature':
      return creatureAuthoringInputDtoSchema.parse(record)
    case 'equipment':
      return equipmentAuthoringInputDtoSchema.parse(record)
    case 'feat':
      return featAuthoringInputDtoSchema.parse(record)
    case 'race':
      return raceAuthoringInputDtoSchema.parse(record)
    case 'spell':
      return spellAuthoringInputDtoSchema.parse(record)
    case 'vehicle':
      return vehicleAuthoringInputDtoSchema.parse(record)
  }
}

function toActualFormValues(
  domain: AuthoredFormDomain,
  record: Record<string, unknown>
): Record<string, unknown> {
  const session = authoredFormFactories[domain].createSession?.({
    data: {
      draft: null,
      response: {
        item: record,
        permissions: { canCopy: true, canDelete: true, canEdit: true }
      },
      subjectId: String(record.id),
      system: authoredRouteStorySystem
    },
    mode: 'edit'
  })

  expect(session).toBeDefined()
  return session!.initialValues as Record<string, unknown>
}

function collectResolvedParity(mapId: string, values: Record<string, unknown>) {
  const authoredPaths = new Set<string>()
  const systemPaths = new Set<string>()
  const contexts: ResolvedContext[] = []

  collectResolvedContext({
    ancestors: [],
    authoredPaths,
    systemPaths,
    contexts,
    mapId,
    parentValues: undefined,
    pathPrefix: [],
    values
  })

  return { authoredPaths, contexts, systemPaths }
}

function collectResolvedContext({
  ancestors,
  authoredPaths,
  systemPaths,
  contexts,
  mapId,
  parentValues,
  pathPrefix,
  values
}: {
  ancestors: readonly Record<string, unknown>[]
  authoredPaths: Set<string>
  systemPaths: Set<string>
  contexts: ResolvedContext[]
  mapId: string
  parentValues?: Record<string, unknown>
  pathPrefix: readonly (string | number)[]
  values: Record<string, unknown>
}) {
  const model = createStaticResolvedFormModel(mapId, {
    ancestors,
    parentValues,
    system: authoredRouteStorySystem,
    values
  })

  expect(model, `Missing static node map ${mapId}`).toBeDefined()
  contexts.push({ model: model!, values })

  for (const node of model!.steps.flatMap((step) =>
    step.sections.flatMap((section) => section.nodes)
  )) {
    const localPath = [...node.path]
    const completePath = [...pathPrefix, ...localPath]
    if (node.authoring?.exposure === 'system') {
      systemPaths.add(normalizePath(completePath))
      continue
    }
    if (!isRenderableNode(node)) continue

    if (node.kind === 'INPUT') {
      authoredPaths.add(normalizePath(completePath))
      continue
    }

    if (!node.childMapId) continue
    const childValue = readPath(values, localPath)
    if (Array.isArray(childValue)) {
      childValue.forEach((row, index) => {
        if (!isRecord(row)) return
        collectResolvedContext({
          ancestors: [values, ...ancestors],
          authoredPaths,
          systemPaths,
          contexts,
          mapId: node.childMapId!,
          parentValues: values,
          pathPrefix: [...completePath, index],
          values: row
        })
      })
      continue
    }

    if (isRecord(childValue)) {
      collectResolvedContext({
        ancestors: [values, ...ancestors],
        authoredPaths,
        systemPaths,
        contexts,
        mapId: node.childMapId,
        parentValues: values,
        pathPrefix: completePath,
        values: childValue
      })
    }
  }
}

function collectValueLeafPaths(value: unknown, path: readonly (string | number)[] = []): string[] {
  if (value === undefined) return []
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    if (value.every((item) => !isRecord(item) && !Array.isArray(item))) {
      return [normalizePath(path)]
    }
    return value.flatMap((item, index) => collectValueLeafPaths(item, [...path, index]))
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      collectValueLeafPaths(child, [...path, key])
    )
  }
  return path.length > 0 ? [normalizePath(path)] : []
}

function getDirectRenderableFieldNames(model: NodeRuntimeResolveResponseDto) {
  return model.steps
    .flatMap((step) => step.sections.flatMap((section) => section.nodes))
    .filter(isRenderableNode)
    .map((node) => node.path.join('.'))
}

function readPath(values: Record<string, unknown>, path: readonly (string | number)[]) {
  let current: unknown = values
  for (const segment of path) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined
    current = current[segment as keyof typeof current]
  }
  return current
}

function normalizePath(path: readonly (string | number)[]) {
  return path.map((segment) => (typeof segment === 'number' ? '[]' : segment)).join('.')
}

function isSystemManagedPath(path: string) {
  const finalKey = path.split('.').at(-1)
  return finalKey !== undefined && SYSTEM_MANAGED_PATH_KEYS.has(finalKey)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
