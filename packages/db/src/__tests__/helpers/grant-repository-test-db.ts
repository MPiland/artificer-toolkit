type RowMap = Record<string, unknown[]>

export function createGrantRepositoryTestDb(rowsByTable: RowMap) {
  return {
    selectFrom(table: string) {
      const state = {
        filtered: [...(rowsByTable[table] ?? [])]
      }

      const builder = {
        select() {
          return builder
        },
        selectAll() {
          return builder
        },
        where(column: string, op: string, value: string | string[]) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
            if (op === 'in' && Array.isArray(value)) {
              return value.includes(String(record[column]))
            }

            return record[column] === value
          })
          return builder
        },
        orderBy(column: string) {
          state.filtered = [...state.filtered].sort((left, right) => {
            const leftValue = (left as Record<string, number | string>)[column]
            const rightValue = (right as Record<string, number | string>)[column]
            return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
          })
          return builder
        },
        async execute() {
          return state.filtered
        },
        async executeTakeFirst() {
          return state.filtered[0] ?? undefined
        }
      }

      return builder
    }
  }
}
