import { set, get, camelCase, PropertyPath } from 'lodash'
import { Action } from '../utils/types'
import { produce } from 'immer'

function isNumber(str: string): boolean {
  return !isNaN(parseFloat(str)) && isFinite(Number(str))
}

const formReducer = produce((draft: any, action: Action) => {
  const {
    type,
    payload: { target },
  } = action

  let path: string[] | null

  if (!!target?.name) {
    if (!Array.isArray(target.name)) {
      path = target.name.split('.')
    } else {
      path = target.name
    }
  } else {
    path = null
  }

  if (type === 'added') {
    if (get(draft, path as PropertyPath)) {
      if (!target.value) {
        get(draft, path as PropertyPath).push({})
      } else {
        set(draft, path as PropertyPath, target.value)
      }
    } else {
      set(draft, path as PropertyPath, !!target.value ? target.value : [{}])
    }
  } else if (type === 'removed') {
    if (path && path.length > 0) {
      const lastKey = path[path.length - 1]
      if (!isNumber(lastKey)) {
        const newPath = path
        if (get(draft, newPath)) {
          set(draft, newPath, undefined)
        }
      } else {
        const newPath = path.slice(0, -1) // Remove the last key
        if (get(draft, newPath)) {
          set(
            draft,
            newPath,
            get(draft, newPath).filter(
              (_: any, index: number) => index !== Number(lastKey)
            )
          )
        }
      }
    }
  } else if (type === 'reset') {
    return target
  } else {
    set(draft, path as PropertyPath, target.value)
    if (path && path[path.length - 1] === 'value') {
      if (path.length === 1) {
        set(draft, 'name', camelCase(target.value))
      } else {
        path.pop()
        path.push('name')
        set(draft, path, camelCase(target.value))
      }
    }
  }
})

export default formReducer
