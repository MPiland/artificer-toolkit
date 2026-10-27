// Browser proof harnesses run Playwright through yarn in PowerShell: pwsh.exe and yarn.ps1 on the
// user's Windows machine, pwsh and yarn on the Linux runner of .github/workflows/browser-journeys.yml.
const windows = process.platform === 'win32'
export const proofPwsh = windows ? 'pwsh.exe' : 'pwsh'
export const proofYarn = windows ? 'yarn.ps1' : 'yarn'
