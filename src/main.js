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
  'flox-cache-public-1:7F4OyH7ZCnFhcze3fJdfyXYLQw/aV7GEed86nQ7IsOs='

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
  core.exportVariable('FLOX_DISABLE_METRICS', disable_metrics)

  const retries = core.getInput('retries') || '3'
  core.exportVariable('RETRIES', retries)

  const proxy = core.getInput('proxy')
  if (proxy !== '') {
    core.exportVariable('PROXY', proxy)
    core.exportVariable('HTTPS_PROXY', proxy)
    core.exportVariable('HTTP_PROXY', proxy)
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

  // Install Flox using nix profile with substituter flags
  await exec.exec('nix', [
    'profile',
    'install',
    '--experimental-features',
    'nix-command flakes',
    '--extra-substituters',
    FLOX_SUBSTITUTER,
    '--extra-trusted-public-keys',
    FLOX_PUBLIC_KEY,
    '--accept-flake-config',
    'github:flox/flox/latest'
  ])

  // Verify installation
  await exec.exec('flox', ['--version'])
  core.info('Flox installed successfully via existing Nix')
}

export async function configureNixExtra() {
  const nixConfPath = '/etc/nix/nix.conf'
  const nixConfDir = '/etc/nix'
  const extraNixConfig = core.getInput('extra-nix-config')
  const extraSubstituters = core.getInput('extra-substituters')
  const extraKeys = core.getInput('extra-substituter-keys')
  const githubToken = core.getInput('github-token')

  const hasWork =
    extraNixConfig !== '' || extraSubstituters !== '' || githubToken !== ''

  if (!hasWork) return

  if (!fs.existsSync(nixConfDir)) {
    await exec.exec('sudo', ['mkdir', '-p', nixConfDir])
  }

  let existingConf = ''
  if (fs.existsSync(nixConfPath)) {
    existingConf = fs.readFileSync(nixConfPath, 'utf8')
  }

  let additions = '\n# Added by install-flox-action\n'

  if (extraNixConfig !== '') {
    additions += extraNixConfig + '\n'
  }

  if (extraSubstituters !== '') {
    additions += `extra-trusted-substituters = ${extraSubstituters}\n`
    if (extraKeys !== '') {
      additions += `extra-trusted-public-keys = ${extraKeys}\n`
    }
  }

  if (githubToken !== '' && !existingConf.includes('access-tokens')) {
    core.setSecret(githubToken)
    additions += `access-tokens = github.com=${githubToken}\n`
  }

  await exec.exec('sudo', [
    'bash',
    '-c',
    `cat >> ${nixConfPath} << 'NIXCONF'\n${additions}NIXCONF`
  ])
  core.info('Nix configuration updated')
}

export async function configureFlox() {
  const trustedEnvs = core.getInput('trusted-environments')
  if (trustedEnvs !== '') {
    const envList = trustedEnvs
      .split(',')
      .map(e => e.trim())
      .filter(e => e !== '')
    for (const env of envList) {
      await exec.exec('flox', [
        'config',
        '--set',
        `trusted_environments."${env}"`,
        'trust'
      ])
      core.info(`Trusted environment: ${env}`)
    }
  }

  const disableUpgrade = core.getInput('disable-upgrade-notifications')
  if (disableUpgrade === 'true') {
    await exec.exec('flox', [
      'config',
      '--set',
      'upgrade_notifications',
      'false'
    ])
    core.info('Upgrade notifications disabled')
  }

  const extraFloxConfig = core.getInput('extra-flox-config')
  if (extraFloxConfig !== '') {
    const lines = extraFloxConfig
      .split('\n')
      .map(l => l.trim())
      .filter(l => l !== '' && l.includes('='))
    for (const line of lines) {
      const eqIndex = line.indexOf('=')
      const key = line.substring(0, eqIndex).trim()
      const value = line.substring(eqIndex + 1).trim()
      await exec.exec('flox', ['config', '--set', key, value])
      core.info(`Flox config: ${key} = ${value}`)
    }
  }
}

export async function captureOutputs(nixDetected) {
  let floxVersion = ''
  await exec.exec('flox', ['--version'], {
    listeners: {
      stdout: data => {
        floxVersion += data.toString()
      }
    }
  })
  floxVersion = floxVersion.trim()
  core.setOutput('flox-version', floxVersion)

  const floxPath = await which('flox', { nothrow: true })
  core.setOutput('flox-path', floxPath || '')

  core.setOutput('nix-detected', nixDetected ? 'true' : 'false')

  core.info(`Flox version: ${floxVersion}`)
  core.info(`Flox path: ${floxPath}`)
}

export async function writeJobSummary({
  floxVersion,
  channel,
  method,
  platform,
  arch,
  nixDetected
}) {
  await core.summary
    .addHeading('Flox Installation')
    .addTable([
      ['Property', 'Value'],
      ['Version', floxVersion],
      ['Channel', channel],
      ['Method', method],
      ['Platform', `${platform} (${arch})`],
      ['Nix pre-installed', nixDetected ? 'Yes' : 'No']
    ])
    .write()
}

export async function run() {
  try {
    const disable_metrics = core.getInput('disable-metrics')
    core.exportVariable('FLOX_DISABLE_METRICS', disable_metrics)

    core.startGroup('Download & Install flox')
    const nix = await which('nix', { nothrow: true })
    const nixDetected = nix !== null

    if (!nixDetected) {
      await getDownloadUrl()
      await exec.exec('bash', ['-c', INSTALL_FLOX_SCRIPT])
    } else {
      core.info(`Nix found at ${nix}`)
      await installViaExistingNix()
    }
    core.endGroup()

    core.startGroup('Configure flox')
    await configureNixExtra()
    await configureFlox()
    core.endGroup()

    core.startGroup('Verify installation')
    await captureOutputs(nixDetected)
    core.endGroup()

    await writeJobSummary({
      floxVersion: core.getInput('version') || '(latest)',
      channel: core.getInput('channel') || 'stable',
      method: nixDetected ? 'nix profile' : 'package',
      platform: process.platform,
      arch: process.arch,
      nixDetected
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}
