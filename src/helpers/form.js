const PWD_REGEX =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/s
const USER_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEL_REGEX = /^DELETE$/

export const handleValidation = (resetValidation) => {
  let isValid = true

  const requiredElements = document.querySelectorAll('[required]')
  requiredElements.forEach((element) => {
    if (resetValidation) {
      element.classList.remove('is-valid')
      element.classList.remove('is-invalid')
    } else {
      if (element) {
        if (element.tagName === 'BUTTON') {
          const selectValue = element.getAttribute('data-atp-options')
          if (selectValue === 'false') {
            element.classList.add('is-invalid')
            element.classList.remove('is-valid')
            isValid = false
          } else {
            element.classList.add('is-valid')
            element.classList.remove('is-invalid')
          }
        } else {
          if (element.hasAttribute('validation')) {
            const validation = element.getAttribute('validation')
            if (validation === 'user') {
              if (
                USER_REGEX.test(element.value) === false &&
                element.value !== ''
              ) {
                console.log('user failed', validation)
                element.classList.add('is-invalid')
                isValid = false
              } else {
                element.classList.remove('is-invalid')
                element.classList.add('is-valid')
              }
            } else if (validation === 'pwd') {
              if (
                PWD_REGEX.test(element.value) === false &&
                element.value !== ''
              ) {
                element.classList.add('is-invalid')
                isValid = false
              } else {
                element.classList.remove('is-invalid')
                element.classList.add('is-valid')
              }
            } else if (validation === 'del') {
              if (
                DEL_REGEX.test(element.value) === false &&
                element.value !== ''
              ) {
                element.classList.add('is-invalid')
              } else {
                element.classList.remove('is-invalid')
                element.classList.add('is-valid')
              }
            }
          } else {
            const value = element.value
            const isEmpty =
              value === null ||
              value === undefined ||
              (typeof value === 'string' && value.trim() === '')

            if (isEmpty) {
              element.classList.add('is-invalid')
              isValid = false
            } else {
              element.classList.add('is-valid')
            }
          }
        }
      }
    }
  })
  return isValid
}
