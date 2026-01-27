const core = require('@actions/core')
const exec = require('@actions/exec')
const fs = require('fs')
const path = require('path')
const which = require('which')

export function scriptPath(name) {
  return path.join(__dirname, '..', 'scripts', name)
}

const INSTALL_FLOX_SCRIPT = scriptPath('install-flox.sh')
const CHANNELS = ['stable', 'qa', 'nightly']

const FLOX_SUBSTITUTER = 'https://cache.flox.dev'
const FLOX_PUBLIC_KEY =
  'flox-store-public-0:8c/B+kjIaQ+BloCmNkRUKwaVPFWkriSAd0JJvuDu4F0='

export async function getDownloadUrl() {
  const rpm = await which('rpm', { nothrow: true })
  const dpkg = await which('dpkg', { nothrow: true })

  let BASE_URL = 'https://downloads.flox.dev'
  if (core.getInput('base-url') !== '') {
    BASE_URL = core.getInput('base-url')
  } else if (CHANNELS.includes(core.getInput('channel'))) {
    BASE_URL = `${BASE_URL}/by-env/${core.getInput('channel')}`
  } else {
    BASE_URL = `${BASE_URL}/by-commit/${core.getInput('channel')}`
  }
  core.debug(`Base URL is: ${BASE_URL}`)

  let version = ''
  if (core.getInput('version') !== '') {
    version = '-' + core.getInput('version')
  }

  const disable_metrics = core.getInput('disable-metrics')
  core.exportVariable('DISABLE_METRICS', disable_metrics)

  const retries = core.getInput('retries') || '3'
  core.exportVariable('RETRIES', retries)

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

export async function configureNixSubstituter() {
  const nixConfPath = '/etc/nix/nix.conf'
  const nixConfDir = '/etc/nix'

  // Ensure /etc/nix directory exists
  if (!fs.existsSync(nixConfDir)) {
    await exec.exec('sudo', ['mkdir', '-p', nixConfDir])
  }

  // Read existing config or start fresh
  let nixConf = ''
  if (fs.existsSync(nixConfPath)) {
    nixConf = fs.readFileSync(nixConfPath, 'utf8')
  }

  // Add Flox substituter if not already present
  if (!nixConf.includes(FLOX_SUBSTITUTER)) {
    const additions = `
# Added by install-flox-action
extra-trusted-substituters = ${FLOX_SUBSTITUTER}
extra-trusted-public-keys = ${FLOX_PUBLIC_KEY}
`
    await exec.exec('sudo', [
      'bash',
      '-c',
      `echo '${additions}' >> ${nixConfPath}`
    ])
    core.info(`Configured Flox substituter in ${nixConfPath}`)
  } else {
    core.info('Flox substituter already configured')
  }
}

export async function installViaExistingNix() {
  core.info('Nix detected - installing Flox via nix profile install')

  // Configure the Flox binary cache
  await configureNixSubstituter()

  // Install Flox using nix profile
  await exec.exec('nix', [
    'profile',
    'install',
    '--impure',
    '--no-update-lock-file',
    'github:flox/floxpkgs#flox.fromCatalog',
    '--accept-flake-config'
  ])

  // Verify installation
  await exec.exec('flox', ['--version'])
  core.info('Flox installed successfully via existing Nix')
}

export async function run() {
  core.startGroup('Download & Install flox')
  const nix = await which('nix', { nothrow: true })
  if (nix === null) {
    await getDownloadUrl()
    await exec.exec('bash', ['-c', INSTALL_FLOX_SCRIPT])
  } else {
    core.info(`Nix found at ${nix}`)
    await installViaExistingNix()
  }
  core.endGroup()
}
