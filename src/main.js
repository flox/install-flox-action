const cache = require('@actions/cache')
const core = require('@actions/core')
const exec = require('@actions/exec')
const utils = require('./utils')
const which = require('which')

export async function run() {
  const nix = await which('nix', { nothrow: true })
  if (nix === null) {
    core.startGroup('Download & Install flox')
    await utils.getDownloadUrl()
    await exec.exec('bash', ['-c', utils.SCRIPTS.installFlox])
    core.endGroup()
  }

  core.startGroup('Configure Git')
  utils.exportVariableFromInput('git-user')
  utils.exportVariableFromInput('git-email')
  await exec.exec('bash', ['-c', utils.SCRIPTS.configureGit])
  core.endGroup()

  const githubAccessToken = utils.exportVariableFromInput('github-access-token')
  if (githubAccessToken) {
    core.startGroup('Configure Github')
    await exec.exec('bash', ['-c', utils.SCRIPTS.configureGithub])
    core.endGroup()
  }

  const sshKeyFormat = utils.exportVariableFromInput('ssh-key-format')
  utils.exportVariableFromInput('ssh-key')
  utils.exportVariableFromInput('ssh-auth-sock')
  if (sshKeyFormat) {
    core.startGroup('Configure SSH')
    await exec.exec('bash', ['-c', utils.SCRIPTS.configureSsh], {
      detached: true
    })
    core.endGroup()
  }

  const substituter = utils.exportVariableFromInput('substituter')
  const substituterKey = utils.exportVariableFromInput('substituter-key')
  utils.exportVariableFromInput('substituter-options')
  if (substituter && substituterKey) {
    core.startGroup('Configure Substituter')
    await exec.exec('bash', ['-c', utils.SCRIPTS.configureSubstituter])
    core.endGroup()
  }

  const remoteBuilders = utils.exportVariableFromInput('remote-builders')
  if (remoteBuilders !== null && remoteBuilders !== '') {
    core.startGroup('Configure Builders')
    await exec.exec('bash', ['-c', utils.SCRIPTS.configureBuilders])
    core.endGroup()
  }

  const awsAccessKeyId = utils.exportVariableFromInput('aws-access-key-id')
  const awsSecretAccessKey = utils.exportVariableFromInput(
    'aws-secret-access-key'
  )
  if (awsAccessKeyId && awsSecretAccessKey) {
    core.startGroup('Configure AWS')
    await exec.exec('bash', ['-c', utils.SCRIPTS.configureAWS])
    core.endGroup()
  }

  core.startGroup('Restart Nix Daemon')
  await exec.exec('bash', ['-c', utils.SCRIPTS.restartNixDaemon])
  core.endGroup()

  const flox = await which('flox', { nothrow: true })
  if (flox !== null) {
    core.startGroup('Checking Flox Version')
    await exec.exec('flox', ['--version'])
    core.endGroup()
  }

  core.startGroup('Checking Nix Version')
  await exec.exec('nix', ['--version'])
  await exec.exec('nix', ['store', 'ping'])
  core.endGroup()

  core.startGroup('Record Nix Store Paths')
  await exec.exec('bash', ['-c', utils.SCRIPTS.recordNixStorePaths])
  core.endGroup()

  core.startGroup('Restore Nix Cache')
  const cacheKey = await cache.restoreCache(
    utils.GH_CACHE_PATHS.slice(),
    utils.GH_CACHE_KEY,
    utils.GH_CACHE_RESTORE_KEYS.slice()
  )
  core.endGroup()
}
