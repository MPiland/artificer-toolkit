import { useQuery } from '@tanstack/react-query'
import { getEquipment } from '#app/data/equipment/queries'
import type { EquipmentFormValues } from '#domains/equipment/equipmentAuthoring.utils'
import type { AuthoredFormPreviewContext } from '../factories/authoredFormFactories.types'
import { renderEquipmentPreview } from './equipmentParentPreview.utils'

type EquipmentParentPreviewProps = {
  context: AuthoredFormPreviewContext<EquipmentFormValues>
  parentEquipmentId: string
}

export function EquipmentParentPreview({
  context,
  parentEquipmentId
}: EquipmentParentPreviewProps) {
  const { data } = useQuery(getEquipment(parentEquipmentId))

  return renderEquipmentPreview(context, data?.item)
}
