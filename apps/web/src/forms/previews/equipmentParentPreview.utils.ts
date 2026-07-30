import type { ReactNode } from 'react'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { EquipmentFormValues } from '#domains/equipment/equipmentAuthoring.utils'
import type { AuthoredFormPreviewContext } from '../factories/authoredFormFactories.types'
import { authoredPreviewFactories } from './authoredPreviewFactories'

export function renderEquipmentPreview(
  context: AuthoredFormPreviewContext<EquipmentFormValues>,
  parentEquipment?: EquipmentAuthoredDto | null
): ReactNode {
  const inheritedEconomy =
    parentEquipment &&
    context.values.category === 'VARIANT' &&
    parentEquipment.category !== 'VARIANT' &&
    context.values.parentEquipmentId === parentEquipment.id
      ? {
          cost: parentEquipment.cost,
          weight: parentEquipment.weight
        }
      : undefined

  return authoredPreviewFactories.equipment({
    ...context,
    values: {
      ...context.values,
      ...inheritedEconomy
    }
  })
}
