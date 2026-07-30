const core = require('@actions/core')
const exec = require('@actions/exec')
const path = require('path')
const which = require('which')
const { restorePackage, savePackage, getCachePath } = require('./cache')
const nixconf = require('./nixconf')

function scriptPath(name) {
  return path.join(__dirname, '..', 'scripts', name)
}

const INSTALL_FLOX_SCRIPT = scriptPath('install-flox.sh')
const CHANNELS = ['stable', 'qa', 'nightly']

const FLOX_SUBSTITUTER = 'https://cache.flox.dev'
const FLOX_PUBLIC_KEY =
  'flox-cache-public-1:7F4OyH7ZCnFhcze3fJdfyXYLQw/aV7GEed86nQ7IsOs='

async function getDownloadUrl() {
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

async function installViaExistingNix() {
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

async function configureNixExtra() {
  const extraNixConfig = core.getInput('extra-nix-config')
  const extraSubstituters = core.getInput('extra-substituters')
  const extraKeys = core.getInput('extra-substituter-keys')
  const githubToken = core.getInput('github-token')

  if (githubToken !== '') {
    core.setSecret(githubToken)
  }

  const existingConf = nixconf.readConf(nixconf.NIX_CONF_PATH)
  nixconf.maskTokensIn(existingConf)
  const cleanedConf = nixconf.stripLegacyBlocks(existingConf)

  // Happens once per machine, when a runner that has been through an older
  // version first meets this one. Worth a line in the log, because it is the
  // moment a stale token stops being served.
  const migrated = cleanedConf !== existingConf
  if (migrated) {
    core.info(
      `Removed settings written into ${nixconf.NIX_CONF_PATH} by an earlier version of this action`
    )
  }

  const settings = []
  if (extraNixConfig !== '') {
    settings.push(extraNixConfig)
  }
  if (extraSubstituters !== '') {
    settings.push(`extra-trusted-substituters = ${extraSubstituters}`)
    if (extraKeys !== '') {
      settings.push(`extra-trusted-public-keys = ${extraKeys}`)
    }
  }
  if (githubToken !== '') {
    // The job's token has to win: an expired one on disk produces 401s and
    // cannot be told apart from a token still in use. Entries for other hosts
    // are carried forward so taking github.com over does not discard them.
    const tokens = nixconf.readAccessTokens(cleanedConf)
    const replaced = tokens.has('github.com')
    tokens.set('github.com', githubToken)
    settings.push(`access-tokens = ${nixconf.formatAccessTokens(tokens)}`)

    if (replaced) {
      core.info(
        `Replaced the github.com entry in the existing access-tokens line in ` +
          `${nixconf.NIX_CONF_PATH} with this job's token, keeping entries ` +
          'for other hosts. Set github-token to an empty string to leave the ' +
          'existing configuration untouched.'
      )
    }
  }

  await nixconf.ensureConfDir()

  if (settings.length === 0) {
    // Nothing to write, but a legacy block still has to go: it holds a token
    // that expired with the job that wrote it, and Nix would go on reading it.
    if (migrated) {
      await nixconf.writeAsRoot(
        nixconf.NIX_CONF_PATH,
        nixconf.tidy(cleanedConf)
      )
    }
    return
  }

  // The file is named for this job and its name handed to the post step, so a
  // machine running several jobs at once has one file per job rather than one
  // shared file whose deletion would strand whichever job is still running.
  const confName = nixconf.newConfName()
  core.saveState('confName', confName)

  await nixconf.writeAsRoot(
    nixconf.confPath(confName),
    [
      `# Managed by flox/install-flox-action for this job. Removed when it ends.`,
      ...settings
    ].join('\n')
  )

  // Prune include lines left by jobs that died before their post step ran; a
  // running job's file still exists, so its line survives. Appending this job's
  // line last means its settings win over any that remain.
  const prunedConf = nixconf.pruneIncludes(cleanedConf, null)
  const updatedConf = `${nixconf.tidy(prunedConf)}${nixconf.includeLine(confName)}`
  await nixconf.writeAsRoot(nixconf.NIX_CONF_PATH, nixconf.tidy(updatedConf))

  core.info(`Nix configuration written to ${nixconf.confPath(confName)}`)
}

async function configureFlox() {
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

async function getInstalledVersion() {
  let output = ''
  await exec.exec('flox', ['--version'], {
    listeners: {
      stdout: data => {
        output += data.toString()
      }
    }
  })
  return output.trim()
}

// `flox --version` reports a bare "1.14.0"; older releases prefixed it with
// the program name, so both forms are accepted.
function normalizeVersion(reported) {
  return reported.replace(/^flox\s+/i, '').trim()
}

function versionSatisfies(requested, installed) {
  if (requested === '') return true
  return normalizeVersion(installed) === requested
}

function parseVersion(v) {
  const parts = normalizeVersion(v).split('.')
  if (parts.length !== 3 || parts.some(p => !/^\d+$/.test(p))) return null
  return parts.map(Number)
}

// Whether the two can be compared at all. A `nightly` channel or a commit-hash
// pin has no ordering, so neither a refusal nor an all-clear can be justified.
function isOrderable(requested, installed) {
  return parseVersion(requested) !== null && parseVersion(installed) !== null
}

// True only when both sides are plain dotted versions and the requested one is
// lower, so an unorderable reference never reads as a downgrade.
function isDowngrade(requested, installed) {
  const to = parseVersion(requested)
  const from = parseVersion(installed)
  if (to === null || from === null) return false
  for (let i = 0; i < 3; i++) {
    if (to[i] !== from[i]) return to[i] < from[i]
  }
  return false
}

async function captureOutputs(nixDetected, floxPreinstalled) {
  const floxVersion = await getInstalledVersion()
  core.setOutput('flox-version', floxVersion)

  const floxPath = await which('flox', { nothrow: true })
  core.setOutput('flox-path', floxPath || '')

  core.setOutput('nix-detected', nixDetected ? 'true' : 'false')
  core.setOutput('flox-preinstalled', floxPreinstalled ? 'true' : 'false')

  core.info(`Flox version: ${floxVersion}`)
  core.info(`Flox path: ${floxPath}`)
}

async function writeJobSummary({
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
      ['Nix on PATH', nixDetected ? 'Yes' : 'No']
    ])
    .write()
}

async function installViaPackage() {
  const downloadUrl = await getDownloadUrl()
  const useCache = core.getInput('use-cache') === 'true'

  let cacheHit = false

  if (useCache) {
    const cachedPath = await restorePackage(downloadUrl)
    if (cachedPath) {
      cacheHit = true
      core.exportVariable('DOWNLOADED_FILE', cachedPath)
      core.exportVariable('SKIP_DOWNLOAD', 'true')
      core.exportVariable('PRESERVE_DOWNLOAD', 'true')
    } else {
      core.exportVariable('DOWNLOADED_FILE', getCachePath(downloadUrl))
      core.exportVariable('PRESERVE_DOWNLOAD', 'true')
    }
  }

  await exec.exec('bash', ['-c', INSTALL_FLOX_SCRIPT])

  if (useCache && !cacheHit) {
    await savePackage(downloadUrl)
  }
}

async function run() {
  try {
    const disable_metrics = core.getInput('disable-metrics')
    if (disable_metrics !== '') {
      core.exportVariable('FLOX_DISABLE_METRICS', disable_metrics)
    }

    core.startGroup('Download & Install flox')

    // Installing flox also installs Nix, symlinked into /usr/bin, so on a
    // runner whose disk survives the job, `nix` alone cannot tell a Nix the
    // user brought from the one an earlier run of this action installed.
    // Asking for flox first answers the question directly.
    const floxPath = await which('flox', { nothrow: true })
    const nix = await which('nix', { nothrow: true })
    const nixDetected = nix !== null

    const requestedVersion = core.getInput('version')

    let floxPreinstalled = false
    let installedVersion = ''
    if (floxPath !== null) {
      installedVersion = await getInstalledVersion()

      // Flox ships with Nix, and a Nix store database migrates only
      // forward: a Nix older than the one that last wrote the store can refuse
      // to operate against it. No package manager declines the swap on those
      // grounds, so the install would succeed and the machine would break
      // later, at first use, with nothing tying the breakage to the pin. Refuse
      // before installing rather than leave state that does not heal.
      if (isDowngrade(requestedVersion, installedVersion)) {
        throw new Error(
          `flox ${normalizeVersion(installedVersion)} is installed; ` +
            `downgrading to ${requestedVersion} in place is not supported. ` +
            'Update the pin, or remove flox and /nix from the runner to ' +
            'install an older version.'
        )
      }

      if (core.getInput('force-reinstall') !== 'true') {
        floxPreinstalled = versionSatisfies(requestedVersion, installedVersion)
      }

      // A channel that is a commit hash, or a version that is not a plain
      // dotted triple, carries no ordering, so whether it goes backwards cannot
      // be known. Those are allowed through rather than blocked on a guess.
      if (
        !floxPreinstalled &&
        !isOrderable(requestedVersion, installedVersion)
      ) {
        core.warning(
          'This reinstalls flox over an existing installation from a ' +
            'reference with no version ordering, so it may be a downgrade. ' +
            'Downgrading in place is not supported: flox ships with Nix, ' +
            'and a Nix store cannot be read by a Nix older than the one ' +
            'that last wrote it. If anything fails against /nix afterward, ' +
            'remove flox and /nix from the runner and install again.'
        )
      }
    }

    const usesExistingNix =
      !floxPreinstalled && nixDetected && floxPath === null

    // Nix reads access-tokens from disk when it fetches a flake, so on that
    // path the configuration has to be written first. On the package path it
    // has to come second: flox's postinst writes /etc/nix/nix.conf only when
    // it finds none, and creating ours first would suppress the defaults it
    // puts there, among them the empty build-users-group a single-user
    // install depends on.
    if (usesExistingNix) {
      await configureNixExtra()
    }

    if (floxPreinstalled) {
      core.info(`Flox already installed at ${floxPath}; skipping installation`)
    } else if (usesExistingNix) {
      core.info(`Nix found at ${nix}`)
      await installViaExistingNix()
    } else {
      await installViaPackage()
    }
    core.endGroup()

    core.startGroup('Configure flox')
    if (!usesExistingNix) {
      await configureNixExtra()
    }
    await configureFlox()
    core.endGroup()

    core.startGroup('Verify installation')
    await captureOutputs(nixDetected, floxPreinstalled)
    core.endGroup()

    if (core.getInput('write-summary') === 'true') {
      let method = 'package'
      if (floxPreinstalled) method = 'already installed'
      else if (usesExistingNix) method = 'nix profile'

      await writeJobSummary({
        floxVersion: core.getInput('version') || '(latest)',
        channel: core.getInput('channel') || 'stable',
        method,
        platform: process.platform,
        arch: process.arch,
        nixDetected
      })
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

module.exports = {
  scriptPath,
  getDownloadUrl,
  installViaExistingNix,
  configureNixExtra,
  configureFlox,
  getInstalledVersion,
  normalizeVersion,
  versionSatisfies,
  isOrderable,
  isDowngrade,
  captureOutputs,
  writeJobSummary,
  installViaPackage,
  run
}
