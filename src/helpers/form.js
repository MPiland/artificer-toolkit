const PWD_REGEX =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/s
const USER_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEL_REGEX = /^DELETE$/

const isValidUser = (value) => USER_REGEX.test(value)
const isValidPassword = (value) => PWD_REGEX.test(value)
const isValidDeletion = (value) => DEL_REGEX.test(value)

const addClassToTab = (validTabs) => {
  let validParentTabs = {}
  Object.keys(validTabs).forEach((tabId) => {
    const tab = document.getElementById(`${tabId}Tab`)
    if (tab) {
      if (tabId === 'main1') {
        console.log('validTab', validTabs[tabId])
      }
      if (validTabs[tabId] === false && !tab.classList.contains('is-invalid')) {
        tab.classList.add('is-invalid')
      } else if (
        validTabs[tabId] === true &&
        tab.classList.contains('is-invalid')
      ) {
        tab.classList.remove('is-invalid')
      }

      let parentTab = tab.closest('.tab-pane')
      const parentId = parentTab?.id?.replace('TabPane', '')
      if (parentId) {
        if (validParentTabs[parentId] == null) {
          if (validTabs[parentId] != null) {
            validParentTabs[parentId] = validTabs[tabId] && validTabs[parentId]
          } else {
            validParentTabs[parentId] = validTabs[tabId]
          }
        } else {
          if (validTabs[parentId] != null) {
            validParentTabs[parentId] =
              validTabs[tabId] &&
              validTabs[parentId] &&
              validParentTabs[parentId]
          } else {
            validParentTabs[parentId] =
              validTabs[tabId] && validParentTabs[parentId]
          }
        }
      }
    }
  })

  if (Object.keys(validParentTabs)?.length > 0) {
    addClassToTab(validParentTabs)
  }
}

export const handleValidation = (resetValidation = false) => {
  let isValid = true
  let validTabs = {}

  const requiredElements = document.querySelectorAll('[required]')
  requiredElements.forEach((element) => {
    if (resetValidation) {
      element.classList.remove('is-valid', 'is-invalid')
    } else {
      if (element) {
        let isValidInput
        if (element.tagName === 'BUTTON') {
          const selectValue = element.getAttribute('data-atp-options')
          isValidInput = selectValue === 'false' ? false : true
        } else {
          if (element.hasAttribute('validation')) {
            const validation = element.getAttribute('validation')
            const value = element.value.trim()
            const isEmptyAndRequired =
              value === '' && element.hasAttribute('required')

            isValidInput =
              !isEmptyAndRequired &&
              ((validation === 'user' && isValidUser(value)) ||
                (validation === 'pwd' && isValidPassword(value)) ||
                (validation === 'del' && isValidDeletion(value)) ||
                validation === 'num' ||
                validation === 'cur')
          } else {
            const value = element.value
            isValidInput =
              value !== null && typeof value === 'string' && value.trim() !== ''
          }
        }

        element.classList.toggle('is-invalid', !isValidInput)
        element.classList.toggle('is-valid', isValidInput)
        isValid = isValidInput && isValid

        let tabPane = element.closest('.tab-pane')
        if (tabPane) {
          const tabId = tabPane.id.replace('TabPane', '')
          if (tabId) {
            if (validTabs[tabId] != null) {
              validTabs[tabId] = validTabs[tabId] && isValidInput
            } else {
              validTabs[tabId] = isValidInput
            }
          }

          if (!isValidInput) {
            console.log('tabId', tabId, 'element', element)
          }
        }
      }
    }
  })

  addClassToTab(validTabs)

  return isValid
}
