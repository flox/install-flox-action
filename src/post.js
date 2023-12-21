const cache = require('@actions/cache')
const core = require('@actions/core')
const exec = require('@actions/exec')
const utils = require('./utils')

export async function run() {
  const storePathsFile = process.env['STORE_PATHS_FILE']
  const floxSubstituter = process.env['FLOX_SUBSTITUTER']
  if (storePathsFile && floxSubstituter) {
    core.startGroup('Push Nix Store Paths')
    await exec.exec('bash', ['-c', utils.SCRIPTS.pushNewNixStorePaths])
    core.endGroup()
  }

  core.startGroup('Save Nix Cache')
  try {
    await cache.saveCache(utils.GH_CACHE_PATHS, utils.GH_CACHE_KEY)
  } catch (error) {
    core.info(error.message)
  }
  core.endGroup()
  process.exit(0)
}
