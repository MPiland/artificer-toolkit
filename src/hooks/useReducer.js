import { set, get, camelCase } from 'lodash'
import { produce } from 'immer'

const formReducer = produce((draft, action) => {
  const {
    type,
    payload: { target },
  } = action

  function isNumber(str) {
    return !isNaN(parseFloat(str)) && isFinite(str)
  }

  let path

  if (!!target?.name) {
    path = target.name.split('.')
  } else {
    path = null
  }

  if (type === 'added') {
    if (get(draft, path)) {
      if (!target.value) {
        get(draft, path).push({})
      } else {
        set(draft, path, target.value)
      }
    } else {
      set(draft, path, !!target.value ? target.value : [{}])
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
            get(draft, newPath).filter((_, index) => index !== Number(lastKey))
          )
        }
      }
    }
  } else if (type === 'reset') {
    return target
  } else {
    set(draft, path, target.value)
    if (path[path.length - 1] === 'value') {
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
