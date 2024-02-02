const PWD_REGEX: RegExp =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/s;
const USER_REGEX: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEL_REGEX: RegExp = /^DELETE$/;

const isValidUser = (value: string): boolean => USER_REGEX.test(value);
const isValidPassword = (value: string): boolean => PWD_REGEX.test(value);
const isValidDeletion = (value: string): boolean => DEL_REGEX.test(value);

export const handleValidation = (resetValidation: boolean = false): boolean => {
  let isValid: boolean = true;

  const requiredElements: NodeListOf<Element> = document.querySelectorAll('[required]');
  requiredElements.forEach((element: Element) => {
    if (resetValidation) {
      element.classList.remove('is-valid', 'is-invalid');
    } else {
      if (element) {
        let isValidInput: boolean;
        if (element.tagName === 'BUTTON') {
          const selectValue: string | null = element.getAttribute('data-atp-options');
          isValidInput = selectValue === 'false' ? false : true;
        } else {
          if (element.hasAttribute('validation')) {
            const validation: string | null = element.getAttribute('validation');
            const value: string = (element as HTMLInputElement).value.trim();
            const isEmptyAndRequired: boolean =
              value === '' && element.hasAttribute('required');

            isValidInput =
              !isEmptyAndRequired &&
              ((validation === 'user' && isValidUser(value)) ||
                (validation === 'pwd' && isValidPassword(value)) ||
                (validation === 'del' && isValidDeletion(value)) ||
                validation === 'num' ||
                validation === 'cur');
          } else {
            const value: string = (element as HTMLInputElement).value;
            isValidInput =
              value !== null && typeof value === 'string' && value.trim() !== '';
          }
        }

        element.classList.toggle('is-invalid', !isValidInput);
        element.classList.toggle('is-valid', isValidInput);
        isValid = isValidInput && isValid;
      }
    }
  });

  return isValid;
};