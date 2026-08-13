import { Button, Group, Select, TextInput } from '@mantine/core'

export function RuleModelToolbar({
  editable,
  keys,
  value,
  onSelect,
  onAdd,
  onRename,
  onRemove
}: {
  editable: boolean
  keys: string[]
  value: string
  onSelect: (value: string | null) => void
  onAdd: () => void
  onRename: () => void
  onRemove: () => void
}) {
  return (
    <Group align='flex-end'>
      <Select data={keys} label='Model' value={value} onChange={onSelect} />
      <Button disabled={!editable} variant='default' onClick={onAdd}>
        Add model
      </Button>
      <Button disabled={!editable} variant='default' onClick={onRename}>
        Rename
      </Button>
      <Button
        color='red'
        disabled={!editable || keys.length === 1}
        variant='default'
        onClick={onRemove}
      >
        Remove
      </Button>
    </Group>
  )
}
