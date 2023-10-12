const cache = require('@actions/cache')
const core = require('@actions/core')
const exec = require('@actions/exec')
const utils = require('./utils')

export async function run() {
  core.startGroup('Push Nix store paths')
  const storePathsFile = process.env['STORE_PATHS_FILE']
  const floxSubstituter = process.env['FLOX_SUBSTITUTER']
  if (storePathsFile && floxSubstituter) {
    await exec.exec('bash', ['-c', utils.SCRIPTS.pushNewNixStorePaths])
  } else {
    core.debug(`Skip running '${utils.SCRIPTS.pushNewNixStorePaths}' script`)
  }
  core.endGroup()

  core.startGroup('Save Nix Cache')
  await cache.saveCache(utils.GH_CACHE_PATHS, utils.GH_CACHE_KEY)
  core.endGroup()
}
