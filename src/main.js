const cache = require('@actions/cache')
const core = require('@actions/core')
const exec = require('@actions/exec')
const utils = require('./utils')

export async function run() {
  core.startGroup('Download & Install flox')
  const downloadUrl = await utils.getDownloadUrl(process.platform, process.arch)
  utils.exportVariableFromInput('download-url', downloadUrl)
  await exec.exec('bash', ['-c', utils.SCRIPTS.installFlox])
  core.endGroup()

  core.startGroup('Configure Git')
  utils.exportVariableFromInput('git-user')
  utils.exportVariableFromInput('git-email')
  await exec.exec('bash', ['-c', utils.SCRIPTS.configureGit])
  core.endGroup()

  core.startGroup('Configure Github')
  const githubAccessToken = utils.exportVariableFromInput('github-access-token')
  if (githubAccessToken) {
    await exec.exec('bash', ['-c', utils.SCRIPTS.configureGithub])
  } else {
    core.debug(`Skip running '${utils.SCRIPTS.configureGithub}' script`)
  }
  core.endGroup()

  core.startGroup('Configure Ssh')
  const sshKeyFormat = utils.exportVariableFromInput('ssh-key-format')
  utils.exportVariableFromInput('ssh-key')
  utils.exportVariableFromInput('ssh-auth-sock')
  if (sshKeyFormat) {
    await exec.exec('bash', ['-c', utils.SCRIPTS.configureSsh])
  } else {
    core.debug(`Skip running '${utils.SCRIPTS.configureSsh}' script`)
  }
  core.endGroup()

  core.startGroup('Configure Substituter')
  const substituter = utils.exportVariableFromInput('substituter')
  const substituterKey = utils.exportVariableFromInput('substituter-key')
  utils.exportVariableFromInput('substituter-options')
  if (substituter && substituterKey) {
    await exec.exec('bash', ['-c', utils.SCRIPTS.configureSubstituter])
  } else {
    core.debug(`Skip running '${utils.SCRIPTS.configureSubstituter}' script`)
  }
  core.endGroup()

  core.startGroup('Configure AWS')
  const awsAccessKeyId = utils.exportVariableFromInput('aws-access-key-id')
  const awsSecretAccessKey = utils.exportVariableFromInput(
    'aws-secret-access-key'
  )
  if (awsAccessKeyId && awsSecretAccessKey) {
    await exec.exec('bash', ['-c', utils.SCRIPTS.configureAWS])
  } else {
    core.debug(`Skip running '${utils.SCRIPTS.configureAWS}' script`)
  }
  core.endGroup()

  core.startGroup('Checking flox version')
  await exec.exec('flox', ['--version'])
  core.endGroup()

  core.startGroup('Record Nix store paths')
  await exec.exec('bash', ['-c', utils.SCRIPTS.recordNixStorePaths])
  core.endGroup()

  core.startGroup('Restore Nix Cache')
  const cacheKey = await cache.restoreCache(
    utils.GH_CACHE_PATHS,
    utils.GH_CACHE_KEY,
    utils.GH_CACHE_RESTORE_KEYS
  )
  core.endGroup()
}
