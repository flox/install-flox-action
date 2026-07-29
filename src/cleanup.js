const core = require('@actions/core')
const fs = require('fs')
const nixconf = require('./nixconf')

// The token GitHub grants a job is written to a root-owned but world-readable
// file so that Nix can read it. On a runner whose disk survives the job,
// anything that runs next can read it too, until it expires.
//
// Only this job's own file is removed. A machine may be running other jobs
// whose files are live, and taking one of those would strand a job mid-run.
async function run() {
  try {
    const confName = core.getState('confName')
    const existingConf = nixconf.readConf(nixconf.NIX_CONF_PATH)
    nixconf.maskTokensIn(existingConf)

    if (confName === '' && !nixconf.INCLUDE_PATTERN.test(existingConf)) return

    if (confName !== '' && fs.existsSync(nixconf.confPath(confName))) {
      await nixconf.removeAsRoot(nixconf.confPath(confName))
    }

    // Drops this job's include line, and any left by a job that died before its
    // post step ran. Lines whose file still exists belong to a live job.
    const prunedConf = nixconf.pruneIncludes(existingConf, confName)
    if (prunedConf !== existingConf) {
      await nixconf.writeAsRoot(nixconf.NIX_CONF_PATH, nixconf.tidy(prunedConf))
    }

    core.info(
      confName === ''
        ? 'Pruned stale include lines from nix.conf'
        : `Removed ${nixconf.confPath(confName)}`
    )
  } catch (error) {
    core.warning(`Could not remove Nix configuration: ${error.message}`)
  }
}

module.exports = { run }
