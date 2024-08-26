const core = require('@actions/core')
const exec = require('@actions/exec')
const path = require('path')
const which = require('which')

export function scriptPath(name) {
  return path.join(__dirname, '..', 'scripts', name)
}

const INSTALL_FLOX_SCRIPT = scriptPath('install-flox.sh')
const DEFAULT_BASE_URL = 'https://downloads.flox.dev/by-env/stable'
const CHANNELS = ['stable', 'qa', 'nightly']

export async function getDownloadUrl() {
  const rpm = await which('rpm', { nothrow: true })
  const dpkg = await which('dpkg', { nothrow: true })

  let BASE_URL = 'https://downloads.flox.dev'
  if (core.getInput('base-url') !== '') {
    BASE_URL = DEFAULT_BASE_URL
  } else if (CHANNELS.includes(core.getInput('channel'))) {
    BASE_URL = `${DEFAULT_BASE_URL}/by-env/${core.getInput('channel')}`
  } else {
    BASE_URL = `${DEFAULT_BASE_URL}/by-commit/${core.getInput('channel')}`
  }
  core.debug(`Base URL is: ${BASE_URL}`)

  let version = ''
  if (core.getInput('version') !== '') {
    version = '-' + core.getInput('version')
  }

  let downloadUrl

  if (process.platform === 'darwin' && process.arch === 'x64') {
    downloadUrl = `${BASE_URL}/osx/flox${version}.x86_64-darwin.pkg`
  } else if (process.platform === 'darwin' && process.arch === 'arm64') {
    downloadUrl = `${BASE_URL}/osx/flox${version}.aarch64-darwin.pkg`
  } else if (
    dpkg !== null &&
    process.platform === 'linux' &&
    process.arch === 'x64'
  ) {
    downloadUrl = `${BASE_URL}/deb/flox${version}.x86_64-linux.deb`
  } else if (
    dpkg !== null &&
    process.platform === 'linux' &&
    process.arch === 'arm64'
  ) {
    downloadUrl = `${BASE_URL}/deb/flox${version}.aarch64-linux.deb`
  } else if (
    rpm !== null &&
    process.platform === 'linux' &&
    process.arch === 'x64'
  ) {
    downloadUrl = `${BASE_URL}/rpm/flox${version}.x86_64-linux.rpm`
  } else if (
    rpm !== null &&
    process.platform === 'linux' &&
    process.arch === 'arm64'
  ) {
    downloadUrl = `${BASE_URL}/rpm/flox${version}.aarch64-linux.rpm`
  } else {
    core.setFailed(
      `No platform (${process.platform}) or arch (${process.arch}) or OS matched.`
    )
  }

  core.info(`DOWNLOAD_URL resolved to ${downloadUrl}`)
  core.exportVariable('INPUT_DOWNLOAD_URL', downloadUrl)

  return downloadUrl
}

export async function run() {
  core.startGroup('Download & Install flox')
  const nix = await which('nix', { nothrow: true })
  if (nix === null) {
    await getDownloadUrl()
    await exec.exec('bash', ['-c', INSTALL_FLOX_SCRIPT])
  } else {
    core.setFailed(`Nix found at ${nix}! Please remove it to use flox.`)
  }
  core.endGroup()
}
