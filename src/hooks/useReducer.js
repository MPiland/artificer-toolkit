import { set, get, camelCase } from 'lodash'
import { produce } from 'immer'

const formReducer = produce((draft, action) => {
  const {
    type,
    payload: { target },
  } = action

  const path = target.name.split('.')

  if (type === 'added') {
    if (!!get(draft, path)) {
      get(draft, path).push({})
    } else {
      set(draft, path, [!!target.value ? target.value : {}])
    }
  } else if (type === 'removed') {
    const newPath = path.filter((_, index) => index !== path.length - 1)
    set(
      draft,
      newPath,
      get(draft, newPath).filter(
        (_, index) => index !== Number(path[path.length - 1])
      )
    )
  } else {
    console.log('path', path)
    console.log('value', target.value)
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
