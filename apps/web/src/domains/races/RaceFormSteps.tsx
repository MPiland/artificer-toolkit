import { Text } from '@mantine/core'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema'
import { RACE_CATEGORY_CODE, RACE_NODE_MAP } from '@artificer-toolkit/shared'
import {
  AuthoredFormSection
} from '#components/Form/AuthoredFormLayout'
import {
  defaultSourceOptionResolver,
  getRuntimeNodeOptions,
  getRuntimeNodeRequired,
  getRuntimeNodeVisible,
  requiredSelect,
  requiredString,
  validatorsFor,
  withForm
} from '#components/Form/runtime'
import {
  AncestrySection,
  DetailsSection,
  FeaturesSection,
  SpeedsSection
} from './RaceCollectionEditors'
import {
  createEmptyRace,
  type RaceFormStep,
  type RaceFormValues
} from './raceAuthoring.utils'
import * as styles from './raceAuthoring.css'

export const raceSteps = [
  {
    id: 'basics',
    label: 'Basics',
    description: 'Name, category, and player-facing copy'
  },
  {
    id: 'content',
    label: 'Content',
    description: 'Parent, heritages, size, and speeds'
  },
  {
    id: 'ancestry',
    label: 'Ancestry',
    description: 'Base-race choices and options'
  },
  {
    id: 'details',
    label: 'Details',
    description: 'Lore and worldbuilding prompts'
  },
  {
    id: 'features',
    label: 'Features',
    description: 'Race-owned feature basics'
  }
] as const satisfies readonly {
  id: RaceFormStep
  label: string
  description: string
}[]

export const raceFormDefaults = createEmptyRace({ systemId: '', userId: '' })

export const raceStepFields = {
  basics: ['label', 'category', 'quote', 'description'],
  content: ['parentRaceId', 'heritageIds', 'selectionMode', 'size', 'speeds'],
  ancestry: ['ancestry'],
  details: ['details'],
  features: ['features']
} satisfies Record<RaceFormStep, readonly string[]>

export const BasicsStep = withForm({
  defaultValues: raceFormDefaults,
  props: {
    readOnly: false,
    runtimeModel: undefined as NodeRuntimeResolveResponseDto | undefined
  },
  render: function BasicsStepRender({ form, readOnly, runtimeModel }) {
    return (
      <>
        <AuthoredFormSection
          description='Start with the race record type and the name players will see.'
          title='Basics'
          titleId='race-basics-heading'
        >
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <div className={styles.fieldGrid}>
                <div className={styles.singleField}>
                  <form.AppField
                    name='label'
                    validators={validatorsFor(requiredString('Name'))}
                  >
                    {(field) => <field.TextField label='Name' readOnly={readOnly} required />}
                  </form.AppField>
                </div>
                <div className={styles.singleField}>
                  <form.AppField
                    name='category'
                    validators={validatorsFor(requiredSelect('Category'))}
                  >
                    {(field) => (
                      <field.SelectField
                        label='Category'
                        readOnly={readOnly}
                        required
                        data={getRaceOptions('category', values, runtimeModel)}
                      />
                    )}
                  </form.AppField>
                </div>
              </div>
            )}
          </form.Subscribe>
        </AuthoredFormSection>
        <AuthoredFormSection
          description='Write the short player-facing concept and the longer description shown in content pages.'
          title='Description'
          titleId='race-description-heading'
        >
          <div className={styles.fieldGrid}>
            <div className={styles.wide}>
              <form.AppField name='description'>
                {(field) => <field.TextareaField label='Description' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.wide}>
              <form.AppField name='quote'>
                {(field) => <field.TextareaField label='Quote' readOnly={readOnly} />}
              </form.AppField>
            </div>
          </div>
        </AuthoredFormSection>
      </>
    )
  }
})

export const ContentStep = withForm({
  defaultValues: raceFormDefaults,
  props: {
    readOnly: false,
    resolveRuntime: true,
    runtimeModel: undefined as NodeRuntimeResolveResponseDto | undefined
  },
  render: function ContentStepRender({ form, readOnly, resolveRuntime, runtimeModel }) {
    return (
      <form.Subscribe selector={(state) => state.values}>
        {(values) => values.category === RACE_CATEGORY_CODE.SUBRACE
          ? (
              <>
                <AuthoredFormSection
                  description='Choose the base race this subrace inherits from.'
                  title='Parent Race'
                  titleId='race-parent-heading'
                >
                  <div className={styles.singleField}>
                    <form.AppField
                      name='parentRaceId'
                      validators={validatorsFor(requiredSelect('Parent Race'))}
                    >
                      {(field) => (
                        <field.SelectField
                          label='Parent Race'
                          readOnly={readOnly}
                          required={getRuntimeNodeRequired(runtimeModel, 'parentRaceId') ?? true}
                          data={getRaceOptions('parentRaceId', values, runtimeModel)}
                        />
                      )}
                    </form.AppField>
                  </div>
                </AuthoredFormSection>
                <InheritedContentSummary hasParent={Boolean(values.parentRaceId)} />
              </>
            )
          : (
              <>
                <AuthoredFormSection
                  description='Set the base race structure players choose from.'
                  title='Classification'
                  titleId='race-classification-heading'
                >
                  <div className={styles.fieldGrid}>
                    {getRuntimeNodeVisible(runtimeModel, 'selectionMode')
                      ? (
                          <div className={styles.singleField}>
                            <form.AppField
                              name='selectionMode'
                              validators={validatorsFor(requiredSelect('Selection Mode'))}
                            >
                              {(field) => (
                                <field.SelectField
                                  label='Selection Mode'
                                  readOnly={readOnly}
                                  required={getRuntimeNodeRequired(runtimeModel, 'selectionMode') ?? true}
                                  data={getRaceOptions('selectionMode', values, runtimeModel)}
                                />
                              )}
                            </form.AppField>
                          </div>
                        )
                      : null}
                    {getRuntimeNodeVisible(runtimeModel, 'size')
                      ? (
                          <div className={styles.singleField}>
                            <form.AppField
                              name='size'
                              validators={validatorsFor(requiredSelect('Size'))}
                            >
                              {(field) => (
                                <field.SelectField
                                  label='Size'
                                  readOnly={readOnly}
                                  required={getRuntimeNodeRequired(runtimeModel, 'size') ?? true}
                                  data={getRaceOptions('size', values, runtimeModel)}
                                />
                              )}
                            </form.AppField>
                          </div>
                        )
                      : null}
                    {getRuntimeNodeVisible(runtimeModel, 'heritageIds')
                      ? (
                          <div className={styles.wide}>
                            <form.AppField name='heritageIds'>
                              {(field) => (
                                <field.MultiSelectField
                                  label='Heritages'
                                  readOnly={readOnly}
                                  data={getRaceOptions('heritageIds', values, runtimeModel)}
                                />
                              )}
                            </form.AppField>
                          </div>
                        )
                      : null}
                  </div>
                </AuthoredFormSection>
                <form.Subscribe selector={(state) => state.values.speeds ?? []}>
                  {(speeds) => (
                    <SpeedsSection
                      items={speeds}
                      readOnly={readOnly}
                      resolveRuntime={resolveRuntime}
                      onChange={(next) => form.setFieldValue('speeds', next)}
                    />
                  )}
                </form.Subscribe>
              </>
            )}
      </form.Subscribe>
    )
  }
})

export const AncestryStep = withForm({
  defaultValues: raceFormDefaults,
  props: {
    readOnly: false
  },
  render: function AncestryStepRender({ form, readOnly }) {
    return (
      <form.Subscribe selector={(state) => ({
        ancestry: state.values.ancestry,
        category: state.values.category
      })}
      >
        {({ ancestry, category }) => category === RACE_CATEGORY_CODE.SUBRACE
          ? <InheritedContentSummary hasParent />
          : (
              <AncestrySection
                ancestry={ancestry}
                readOnly={readOnly}
                onChange={(next) => form.setFieldValue('ancestry', next)}
              />
            )}
      </form.Subscribe>
    )
  }
})

export const DetailsStep = withForm({
  defaultValues: raceFormDefaults,
  props: {
    readOnly: false
  },
  render: function DetailsStepRender({ form, readOnly }) {
    return (
      <form.Subscribe selector={(state) => state.values.details ?? []}>
        {(details) => (
          <DetailsSection
            items={details}
            readOnly={readOnly}
            onChange={(next) => form.setFieldValue('details', next)}
          />
        )}
      </form.Subscribe>
    )
  }
})

export const FeaturesStep = withForm({
  defaultValues: raceFormDefaults,
  props: {
    readOnly: false
  },
  render: function FeaturesStepRender({ form, readOnly }) {
    return (
      <form.Subscribe selector={(state) => state.values.features ?? []}>
        {(features) => (
          <FeaturesSection
            items={features}
            readOnly={readOnly}
            onChange={(next) => form.setFieldValue('features', next)}
          />
        )}
      </form.Subscribe>
    )
  }
})

function InheritedContentSummary({ hasParent }: { hasParent: boolean }) {
  return (
    <AuthoredFormSection
      description='Subraces inherit baseline content from their parent race. Add only the content this subrace changes or grants.'
      title='Inherited From Base Race'
      titleId='race-inherited-heading'
    >
      <div className={styles.inheritedPanel}>
        {!hasParent
          ? <Text className={styles.emptyCopy}>Choose a parent race to preview inherited content.</Text>
          : null}
        <div className={styles.inheritedGrid}>
          <InheritedItem label='Size & Speed' value={hasParent ? 'Inherited from parent race' : 'Pending parent race'} />
          <InheritedItem label='Heritages' value={hasParent ? 'Inherited from parent race' : 'Pending parent race'} />
          <InheritedItem label='Base Features' value={hasParent ? 'Inherited from parent race' : 'Pending parent race'} />
        </div>
      </div>
    </AuthoredFormSection>
  )
}

function InheritedItem({ label, value }: { label: string, value: string }) {
  return (
    <div className={styles.inheritedItem}>
      <Text className={styles.inheritedLabel}>{label}</Text>
      <Text className={styles.inheritedValue}>{value}</Text>
    </div>
  )
}

function getRaceOptions(
  nodeId: keyof typeof RACE_NODE_MAP.nodes,
  values: RaceFormValues,
  runtimeModel: NodeRuntimeResolveResponseDto | undefined
) {
  const node = RACE_NODE_MAP.nodes[nodeId]

  if (node.kind !== 'INPUT' || (node.type !== 'SELECT_SINGLE' && node.type !== 'SELECT_MULTI')) {
    return []
  }

  return getRuntimeNodeOptions(
    runtimeModel,
    nodeId,
    defaultSourceOptionResolver<RaceFormValues>({
      source: node.source,
      values
    })
  )
}
