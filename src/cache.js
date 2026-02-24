const core = require('@actions/core')
const cache = require('@actions/cache')
const path = require('path')

function parsePlatformInfo(downloadUrl) {
  const url = new URL(downloadUrl)
  const filename = path.basename(url.pathname)
  const ext = path.extname(filename).replace('.', '')

  let os = 'unknown'
  let arch = 'unknown'
  if (filename.includes('x86_64-darwin')) {
    os = 'darwin'
    arch = 'x64'
  } else if (filename.includes('aarch64-darwin')) {
    os = 'darwin'
    arch = 'arm64'
  } else if (filename.includes('x86_64-linux')) {
    os = 'linux'
    arch = 'x64'
  } else if (filename.includes('aarch64-linux')) {
    os = 'linux'
    arch = 'arm64'
  }

  return { os, arch, ext }
}

function isVersionPinned() {
  return core.getInput('version') !== ''
}

function getDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCacheKey(downloadUrl) {
  const { os, arch, ext } = parsePlatformInfo(downloadUrl)
  const channel = core.getInput('channel') || 'stable'
  const version = core.getInput('version') || 'latest'

  const parts = ['install-flox', channel, version]
  if (!isVersionPinned()) {
    parts.push(getDateString())
  }
  parts.push(`${os}-${arch}-${ext}`)

  return parts.join('/')
}

function getRestoreKeys(downloadUrl) {
  const { os, arch, ext } = parsePlatformInfo(downloadUrl)
  const channel = core.getInput('channel') || 'stable'
  const version = core.getInput('version') || 'latest'

  return [`install-flox/${channel}/${version}/`, `install-flox/${channel}/`]
}

function getCacheDir() {
  return process.env.RUNNER_TEMP
    ? path.join(process.env.RUNNER_TEMP, 'flox-package-cache')
    : path.join('/tmp', 'flox-package-cache')
}

function getCachePath(downloadUrl) {
  const dir = getCacheDir()
  if (!downloadUrl) return dir
  const url = new URL(downloadUrl)
  const filename = path.basename(url.pathname)
  return path.join(dir, filename)
}

async function restorePackage(downloadUrl) {
  try {
    const cacheKey = getCacheKey(downloadUrl)
    const restoreKeys = getRestoreKeys(downloadUrl)
    const cacheDir = getCacheDir()

    core.info(`Attempting to restore cache with key: ${cacheKey}`)
    const hitKey = await cache.restoreCache([cacheDir], cacheKey, restoreKeys)

    if (hitKey) {
      core.info(`Cache hit: ${hitKey}`)
      return getCachePath(downloadUrl)
    }

    core.info('Cache miss')
    return null
  } catch (error) {
    core.warning(`Cache restore failed: ${error.message}`)
    return null
  }
}

async function savePackage(downloadUrl) {
  try {
    const cacheKey = getCacheKey(downloadUrl)
    const cacheDir = getCacheDir()
    core.info(`Saving package to cache with key: ${cacheKey}`)
    await cache.saveCache([cacheDir], cacheKey)
    core.info(`Package cached with key: ${cacheKey}`)
  } catch (error) {
    core.warning(`Cache save failed: ${error.message}`)
  }
}

module.exports = {
  getCacheKey,
  getRestoreKeys,
  getCacheDir,
  getCachePath,
  restorePackage,
  savePackage,
  parsePlatformInfo,
  isVersionPinned,
  getDateString
}
