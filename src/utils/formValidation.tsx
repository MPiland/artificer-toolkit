const PWD_REGEX: RegExp =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/s
const USER_REGEX: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEL_REGEX: RegExp = /^DELETE$/
const NUM_REGEX = /^(\d+)(, ?\d+)*(,)?$/
const CUR_REGEX = /^\d*\.?\d*$/

export const validate = (resetValidation: boolean = false): boolean => {
  if (resetValidation) {
    document.dispatchEvent(new CustomEvent('setErrorState', { detail: false }))
  }

  let isValid: boolean = true

  const requiredDropdowns: NodeListOf<Element> =
    document.querySelectorAll('[aria-required]')

  requiredDropdowns.forEach((element: Element) => {
    if (element && element.getAttribute('aria-required') === 'true') {
      let isValidDropdown: boolean
      if (element.hasAttribute('data-atapp-options')) {
        isValidDropdown =
          element.getAttribute('data-atapp-options') === 'true' ? true : false

        element.dispatchEvent(
          new CustomEvent('setErrorState', {
            detail: isValidDropdown ? false : true,
          })
        )
        isValid = isValid && isValidDropdown
      }
    }
  })

  const requiredInputs: NodeListOf<Element> =
    document.querySelectorAll('[required]')

  requiredInputs.forEach((element: Element) => {
    if (element) {
      let isValidInput: boolean

      const value: string = (element as HTMLInputElement).value
      const valid: boolean = value !== '' && element.hasAttribute('required')

      if (element.hasAttribute('data-atapp-validation')) {
        const validation: string | null = element.getAttribute(
          'data-atapp-validation'
        )

        isValidInput =
          valid &&
          ((validation === 'user' && USER_REGEX.test(value)) ||
            (validation === 'pwd' && PWD_REGEX.test(value)) ||
            (validation === 'del' && DEL_REGEX.test(value)) ||
            (validation === 'num' && NUM_REGEX.test(value)) ||
            (validation === 'cur' && CUR_REGEX.test(value)))

        element.dispatchEvent(
          new CustomEvent('setErrorState', {
            detail: isValidInput ? false : true,
          })
        )
        isValid = isValidInput && isValid
      } else {
        element.dispatchEvent(
          new CustomEvent('setErrorState', {
            detail: valid ? false : true,
          })
        )
        isValid = isValid && valid
      }
    }
  })

  return isValid
}
