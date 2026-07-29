const core = require('@actions/core')
const crypto = require('crypto')
const exec = require('@actions/exec')
const fs = require('fs')

const NIX_CONF_DIR = '/etc/nix'
const NIX_CONF_PATH = `${NIX_CONF_DIR}/nix.conf`

// The file holds a token granted to one job, so it is named for that job. A
// machine may run several runner workers at once, and a shared name would mean
// one job's post step deleting a token another job is still using.
const CONF_PREFIX = 'install-flox-action'

// Nix fails outright when a file named by `include` is missing, and ignores one
// named by `!include`. Files are removed at job end while include lines can
// outlive them, so only the optional form is safe here.
// https://nix.dev/manual/nix/latest/command-ref/conf-file
// Multiline, because it is tested both against a single line and against a
// whole nix.conf to ask whether any such line is present.
const INCLUDE_PATTERN = new RegExp(
  `^\\s*!include\\s+(${CONF_PREFIX}[A-Za-z0-9._-]*\\.conf)\\s*$`,
  'm'
)

const LEGACY_MARKER = '# Added by install-flox-action'

// Settings only this action writes. Used to tell its own leftovers from a line
// someone put in nix.conf by hand.
const ACTION_SETTING =
  /^\s*(access-tokens|extra-trusted-substituters|extra-trusted-public-keys)\s*=/

// Carries the run it belongs to so a leftover file can be traced, plus random
// bytes so concurrent jobs of one run, matrix legs included, cannot collide.
function newConfName() {
  const parts = [
    process.env['GITHUB_RUN_ID'],
    process.env['GITHUB_RUN_ATTEMPT'],
    crypto.randomBytes(4).toString('hex')
  ].filter(Boolean)
  return `${CONF_PREFIX}-${parts.join('-')}.conf`
}

function confPath(name) {
  return `${NIX_CONF_DIR}/${name}`
}

function includeLine(name) {
  return `!include ${name}`
}

// Matches the token in an access-tokens line so it can be masked.
const TOKEN_VALUE = /^\s*access-tokens\s*=\s*\S+?=(\S+)/gm

function readConf(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
}

// Registers every token already in a config file for masking. The action's own
// token is masked when it is written; this covers one an administrator wrote by
// hand, which the action would otherwise have no reason to know about.
function maskTokensIn(conf) {
  for (const match of conf.matchAll(TOKEN_VALUE)) {
    if (match[1]) core.setSecret(match[1])
  }
}

// Versions before this one appended their settings directly into nix.conf
// beneath a marker comment, leaving a runner with a persistent disk holding an
// expired token.
function stripLegacyBlocks(conf) {
  const kept = []
  let inBlock = false

  for (const line of conf.split('\n')) {
    if (line.trim() === LEGACY_MARKER) {
      inBlock = true
      continue
    }

    if (inBlock) {
      // An include directive is the one thing known to be written after a
      // block, by flox's own postinst, so it closes it.
      if (/^\s*!?include\s/.test(line)) {
        inBlock = false
      } else if (ACTION_SETTING.test(line)) {
        // A setting this action wrote, and the only kind that can do harm on a
        // later run. Everything else in the block came from the
        // extra-nix-config input, so it is the user's and stays where it is.
        continue
      }
    }

    kept.push(line)
  }

  return kept.join('\n')
}

// Drops this action's include lines whose file is gone: either the caller's own,
// named by `own`, or one belonging to a job that died before its post step ran.
// A live job's file still exists, so its line is left alone.
function pruneIncludes(conf, own) {
  return conf
    .split('\n')
    .filter(line => {
      const match = line.match(INCLUDE_PATTERN)
      if (!match) return true
      const name = match[1]
      if (name === own) return false
      return fs.existsSync(confPath(name))
    })
    .join('\n')
}

async function ensureConfDir() {
  if (!fs.existsSync(NIX_CONF_DIR)) {
    await exec.exec('sudo', ['mkdir', '-p', NIX_CONF_DIR])
  }
}

// Removing a line and appending another leaves blanks behind, and on a machine
// that runs thousands of jobs those would accumulate without bound, which is
// the growth this whole design exists to avoid.
function tidy(conf) {
  return conf.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n'
}

// Content goes over stdin rather than in the command line, because @actions/exec
// echoes the command it runs into the job log. Embedding the file there would
// print anything already in nix.conf, including a token an administrator wrote
// by hand that this action has no way to mask. It also removes any question of a
// line in extra-nix-config terminating a heredoc and being run as root.
async function writeAsRoot(p, content) {
  await exec.exec('sudo', ['tee', p], {
    input: Buffer.from(content),
    silent: true
  })
}

async function removeAsRoot(p) {
  await exec.exec('sudo', ['rm', '-f', p])
}

module.exports = {
  NIX_CONF_PATH,
  INCLUDE_PATTERN,
  newConfName,
  confPath,
  includeLine,
  readConf,
  maskTokensIn,
  stripLegacyBlocks,
  pruneIncludes,
  tidy,
  ensureConfDir,
  writeAsRoot,
  removeAsRoot
}
