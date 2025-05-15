import { FunctionRecord } from './resolverFactory'

export function pluralize(word: string): string {
  // Handle special cases
  const specialCases: Record<string, string> = {
    Equipment: 'Equipment',
    MasterEquipment: 'MasterEquipment',
    MasterClass: 'MasterClasses',
    Class: 'Classes',
  }

  if (specialCases[word]) {
    return specialCases[word]
  }

  // Default case: add 's'
  return `${word}s`
}

// Define the operation types for better type safety
export type OperationType = 'get' | 'list' | 'create' | 'update' | 'delete' | 'batchCreate'

export const operations = (prefix: string) => {
  const pluralPrefix = pluralize(prefix)

  return {
    get: `Get${prefix}`,
    list: `List${pluralPrefix}`,
    create: `Create${prefix}`,
    update: `Update${prefix}`,
    delete: `Delete${prefix}`,
    batchCreate: `BatchCreate${pluralPrefix}`,
  }
}

export const tableToFunctionsMap: Record<string, string[]> = {
  Character: [
    operations('Character').get,
    operations('Character').list,
    operations('Character').create,
    operations('Character').update,
    operations('Character').delete,
  ],
  // For other tables, include all operations
  Equipment: Object.values(operations('Equipment')),
  MasterEquipment: Object.values(operations('MasterEquipment')),
  Spell: Object.values(operations('Spell')),
  MasterSpell: Object.values(operations('MasterSpell')),
  Class: Object.values(operations('Class')),
  MasterClass: Object.values(operations('MasterClass')),
  Feat: Object.values(operations('Feat')),
  MasterFeat: Object.values(operations('MasterFeat')),
  Background: Object.values(operations('Background')),
  MasterBackground: Object.values(operations('MasterBackground')),
  Race: Object.values(operations('Race')),
  MasterRace: Object.values(operations('MasterRace')),
  System: Object.values(operations('System')),
  MasterSystem: Object.values(operations('MasterSystem')),
}

// Define the default operations
export const defaultOperations: OperationType[] = ['get', 'list', 'create', 'update', 'delete', 'batchCreate']

// Helper function to validate the functions object
export function validateFunctions(functions: FunctionRecord, prefix: string): void {
  // Get the list of required functions for this table
  const requiredFunctions =
    tableToFunctionsMap[prefix] ||
    defaultOperations.map((op) => {
      // Use type assertion to tell TypeScript this is a valid key
      return operations(prefix)[op as keyof ReturnType<typeof operations>]
    })

  for (const funcName of requiredFunctions) {
    if (!functions[funcName]) {
      throw new Error(`Missing required function: ${funcName}`)
    }
  }
}
