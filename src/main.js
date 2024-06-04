const core = require('@actions/core')
const exec = require('@actions/exec')
const path = require('path')
const which = require('which')

export function scriptPath(name) {
  return path.join(__dirname, '..', 'scripts', name)
}

const INSTALL_FLOX_SCRIPT = scriptPath('install-flox.sh')

export async function getDownloadUrl() {
  const rpm = await which('rpm', { nothrow: true })
  const dpkg = await which('dpkg', { nothrow: true })

  const BASE_URL = core.getInput('base-url')
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
    downloadUrl = `${BASE_URL}/deb/flox.x86_64-linux.deb`
  } else if (
    dpkg !== null &&
    process.platform === 'linux' &&
    process.arch === 'arm64'
  ) {
    downloadUrl = `${BASE_URL}/deb/flox.aarch64-linux.deb`
  } else if (
    rpm !== null &&
    process.platform === 'linux' &&
    process.arch === 'x64'
  ) {
    downloadUrl = `${BASE_URL}/rpm/flox.x86_64-linux.rpm`
  } else if (
    rpm !== null &&
    process.platform === 'linux' &&
    process.arch === 'arm64'
  ) {
    downloadUrl = `${BASE_URL}/rpm/flox.aarch64-linux.rpm`
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
