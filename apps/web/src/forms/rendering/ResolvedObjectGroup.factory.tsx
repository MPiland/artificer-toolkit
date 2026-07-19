import { Button, Group, Modal, Text } from '@mantine/core'
import { Plus, Trash2 } from 'lucide-react'
import type { NodeRuntimeObjectGroupNodeDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { withForm } from '../app-form/AppForm'
import { toAuthoringFieldName, toTypedAuthoringGroupFieldName } from '../utils/pathUtils'
import {
  getResolvedAuthoringScope,
  isLeafAuthoringFieldGroup
} from '../authoring-schema/resolvedAuthoringScope'
import {
  createDefaultAuthoringObjectItem,
  type AuthoringGroupValues
} from './authoringNodeDefaults'
import { getObjectGroupPresentation } from './collectionPresentation'
import { useAuthoringRendererInteractions, useAuthoringRendererScope } from './FormRenderer.context'
import * as styles from './FormRenderer.css'
import { ResolvedLeafFieldGroup } from './ResolvedLeafFieldGroup'
import { AuthoringActionControl } from './AuthoringActionControl'
import { dispatchCollectionAction } from './authoringActionDispatcher'
import {
  resolveAuthoringSurfaceStyle,
  resolveAuthoringTextStyle
} from './authoringPresentationAdapter'
import { useAuthoringPresentationContext } from './useAuthoringPresentationContext'

type ResolvedObjectGroupProps = {
  hideHeading?: boolean
  node: NodeRuntimeObjectGroupNodeDto
}

export function createResolvedObjectGroup<TValues extends object>(defaultValues: TValues) {
  return withForm({
    defaultValues,
    props: {} as ResolvedObjectGroupProps,
    render: function ResolvedObjectGroup({ form, hideHeading = false, node }) {
      const { childAncestors, fieldPathPrefix, model, readOnly, renderChild, values } =
        useAuthoringRendererScope()
      const { groupRemoval, setGroupRemoval } = useAuthoringRendererInteractions()
      const presentationContext = useAuthoringPresentationContext()

      const childMapId = node.childMapId
      const nodeReadOnly = readOnly
      const fieldName = toTypedAuthoringGroupFieldName<TValues, AuthoringGroupValues>(
        fieldPathPrefix,
        node.path
      )
      const fieldPrefix = toAuthoringFieldName(fieldPathPrefix, node.path)
      const groupPresentation = getObjectGroupPresentation(node)
      const childModel = getResolvedAuthoringScope(model, childMapId, fieldPrefix)
      const usesFieldGroup = node.presentation === 'inline' && isLeafAuthoringFieldGroup(childModel)

      return (
        <form.AppField name={fieldName}>
          {(field) => {
            const hasValue = isGroupObjectValue(field.state.value)
            const canRemoveValue =
              hasValue &&
              !node.required &&
              !hideHeading &&
              groupPresentation.removeAction !== undefined &&
              !(node.path.length === 1 && !fieldPathPrefix)

            return (
              <div
                className={styles.wideField}
                style={resolveAuthoringSurfaceStyle(
                  node.authoring.appearance?.surface,
                  presentationContext
                )}
              >
                <Group
                  justify={hideHeading ? 'flex-end' : 'space-between'}
                  align='center'
                  mb={hideHeading && hasValue ? 0 : 'xs'}
                >
                  {hideHeading ? null : (
                    <Text
                      fw={700}
                      style={resolveAuthoringTextStyle(
                        node.authoring.appearance?.heading,
                        presentationContext
                      )}
                    >
                      {node.label}
                    </Text>
                  )}
                  {!nodeReadOnly ? (
                    canRemoveValue && groupPresentation.removeAction ? (
                      <AuthoringActionControl
                        action={groupPresentation.removeAction}
                        className={styles.inlineArrayRemoveAction}
                        icon={<Trash2 size={16} aria-hidden='true' />}
                        onClick={(event) =>
                          dispatchCollectionAction(groupPresentation.removeAction!, event, {
                            'collection.remove': () =>
                              setGroupRemoval({
                                fieldName: String(fieldName),
                                label: node.label
                              })
                          })
                        }
                      />
                    ) : !hasValue && groupPresentation.addAction ? (
                      <AuthoringActionControl
                        action={groupPresentation.addAction}
                        icon={<Plus size={15} aria-hidden='true' />}
                        onClick={(event) =>
                          dispatchCollectionAction(groupPresentation.addAction!, event, {
                            'collection.add': () =>
                              field.handleChange(
                                createDefaultAuthoringObjectItem(node) as Parameters<
                                  typeof field.handleChange
                                >[0]
                              )
                          })
                        }
                      />
                    ) : null
                  ) : null}
                </Group>
                {hasValue ? (
                  <div className={styles.nestedShell}>
                    {usesFieldGroup && childModel ? (
                      <ResolvedLeafFieldGroup
                        fields={fieldName}
                        form={form}
                        model={childModel}
                        readOnly={nodeReadOnly}
                      />
                    ) : (
                      renderChild({
                        ancestors: [values, ...(childAncestors ?? [])],
                        fieldPathPrefix: fieldPrefix,
                        mapId: childMapId,
                        parentValues: values,
                        readOnly: nodeReadOnly,
                        renderAllSteps: true
                      })
                    )}
                  </div>
                ) : (
                  <Text size='sm' c='dimmed'>
                    {groupPresentation.emptyLabel}
                  </Text>
                )}
                <Modal
                  opened={groupRemoval?.fieldName === String(fieldName)}
                  onClose={() => setGroupRemoval(undefined)}
                  centered
                  title={`Remove ${node.label}?`}
                >
                  <Text size='sm'>This will discard all configured values for this section.</Text>
                  <Group justify='flex-end' mt='md'>
                    <Button variant='default' onClick={() => setGroupRemoval(undefined)}>
                      Cancel
                    </Button>
                    <Button
                      color='red'
                      onClick={() => {
                        field.handleChange(undefined as Parameters<typeof field.handleChange>[0])
                        setGroupRemoval(undefined)
                      }}
                    >
                      Remove
                    </Button>
                  </Group>
                </Modal>
              </div>
            )
          }}
        </form.AppField>
      )
    }
  })
}

function isGroupObjectValue(value: unknown): value is AuthoringGroupValues {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
