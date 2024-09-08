import { set, get, camelCase, PropertyPath, merge } from 'lodash'
import { produce } from 'immer'
import { ReducerActionType } from '../utils/types'

function isNumber(str: string): boolean {
  return !isNaN(parseFloat(str)) && isFinite(Number(str))
}

const formReducer = produce((draft: any, action: ReducerActionType) => {
  let path: string[] | null

  if (action?.target?.name) {
    if (!Array.isArray(action.target.name)) {
      path = action.target.name.split('.')
    } else {
      path = action.target.name
    }
  } else {
    path = null
  }

  if (action?.type === 'added') {
    if (get(draft, path as PropertyPath)) {
      if (!action.target.value) {
        get(draft, path as PropertyPath).push({})
      } else {
        set(draft, path as PropertyPath, action.target.value)
      }
    } else {
      set(draft, path as PropertyPath, action.target.value ? action.target.value : [{}])
    }
  } else if (action?.type === 'removed') {
    if (path && path.length > 0) {
      const lastKey = path[path.length - 1]
      if (!isNumber(lastKey)) {
        const newPath = [...path]
        newPath.pop()
        if (path.length > 1) {
          const newObject = { ...get(draft, newPath) }
          delete newObject[path[path.length - 1]]
          set(draft, newPath, newObject)
        } else {
          const newObject = { ...draft }
          delete newObject[path[0]]
          return newObject
        }
      } else {
        const newPath = path.slice(0, -1)
        set(
          draft,
          newPath,
          get(draft, newPath).filter((_: any, index: number) => index !== Number(lastKey))
        )
      }
    }
  } else if (action?.type === 'reset') {
    return action?.target?.value
  } else {
    let newData: any
    if (typeof action?.target?.value === 'object') {
      const currentData = get(draft, path as PropertyPath, {})
      newData = merge(currentData, action?.target?.value)
    }
    if (typeof action?.target?.value === 'string') {
      newData = action.target?.value
    }
    set(draft, path as PropertyPath, newData)

    if (path && path[path.length - 1] === 'value') {
      if (path.length === 1) {
        set(draft, 'name', camelCase(action?.target?.value))
      } else {
        const newPath = [...path]
        newPath.pop()
        newPath.push('name')
        set(draft, newPath, camelCase(action?.target?.value))
      }
    }
  }
})

export default formReducer
