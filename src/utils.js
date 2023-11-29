const core = require('@actions/core')
const path = require('path')
const which = require('which')
const md5 = require('md5')

const ghWorkflowHash = md5(process.env.GITHUB_WORKFLOW_REF)
const ghRunnerHash = md5(
  process.env.RUNNER_NAME + process.env.RUNNER_OS + process.env.RUNNER_ARCH
)
const ghJobId = process.env.GITHUB_JOB

export const GH_CACHE_KEY = `nix-cache-${ghWorkflowHash}-${ghRunnerHash}-${ghJobId}`

export const GH_CACHE_PATHS = ['~/.cache/nix']
export const GH_CACHE_RESTORE_KEYS = [
  `nix-cache-${ghWorkflowHash}-${ghRunnerHash}-`,
  `nix-cache-${ghWorkflowHash}-`,
  'nix-cache-'
]

export function scriptPath(name) {
  return path.join(__dirname, '..', 'scripts', name)
}

export const SCRIPTS = {
  installFlox: scriptPath('install-flox.sh'),
  configureSubstituter: scriptPath('configure-substituter.sh'),
  configureAWS: scriptPath('configure-aws.sh'),
  configureGit: scriptPath('configure-git.sh'),
  configureGithub: scriptPath('configure-github.sh'),
  configureSsh: scriptPath('configure-ssh.sh'),
  recordNixStorePaths: scriptPath('record-nix-store-paths.sh'),
  pushNewNixStorePaths: scriptPath('push-new-nix-store-paths.sh'),
  restartNixDaemon: scriptPath('restart-nix-daemon.sh'),
  configureBuilders: scriptPath('configure-builders.sh')
}

export function exportVariableFromInput(input, defaultValue = '') {
  const name = `INPUT_${input.toUpperCase().replaceAll('-', '_')}`
  const value = core.getInput(input) || defaultValue
  core.debug(`Exporting variable ${name} to '${value}'`)
  core.exportVariable(name, value)
  return value
}

export async function getDownloadUrl() {
  const rpm = await which('rpm', { nothrow: true })
  const dpkg = await which('dpkg', { nothrow: true })

  const BASE_URL = core.getInput('base-url') || 'https://flox.dev/downloads'
  core.debug(`Base URL is: ${BASE_URL}`)

  let downloadUrl

  if (process.platform === 'darwin' && process.arch === 'x64') {
    downloadUrl = `${BASE_URL}/osx/flox.x86_64-darwin.pkg`
  } else if (process.platform === 'darwin' && process.arch === 'arm64') {
    downloadUrl = `${BASE_URL}/osx/flox.aarch64-darwin.pkg`
  } else if (
    dpkg !== null &&
    process.platform === 'linux' &&
    process.arch === 'x64'
  ) {
    downloadUrl = `${BASE_URL}/debian-archive/flox.x86_64-linux.deb`
  } else if (
    dpkg !== null &&
    process.platform === 'linux' &&
    process.arch === 'arm64'
  ) {
    downloadUrl = `${BASE_URL}/debian-archive/flox.aarch64-linux.deb`
  } else if (
    rpm !== null &&
    process.platform === 'linux' &&
    process.arch === 'x64'
  ) {
    downloadUrl = `${BASE_URL}/yumrepo/flox.x86_64-linux.rpm`
  } else if (
    rpm !== null &&
    process.platform === 'linux' &&
    process.arch === 'arm64'
  ) {
    downloadUrl = `${BASE_URL}/yumrepo/flox.aarch64-linux.rpm`
  } else {
    core.setFailed(
      `No platform (${process.platform}) or arch (${process.arch}) or OS matched.`
    )
  }

  core.info(`DOWNLOAD_URL resolved to ${downloadUrl}`)
  core.exportVariable('INPUT_DOWNLOAD_URL', downloadUrl)

  return downloadUrl
}
