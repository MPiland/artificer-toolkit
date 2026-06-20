export type InitialAuthoringValuesOptions<TValues extends object> = {
  activeValues?: TValues | null
  createEmptyValues: () => TValues
  draftValues?: TValues | null
}

export function chooseInitialAuthoringFormValues<TValues extends object>({
  activeValues,
  createEmptyValues,
  draftValues
}: InitialAuthoringValuesOptions<TValues>): TValues {
  return structuredClone(draftValues ?? activeValues ?? createEmptyValues())
}
