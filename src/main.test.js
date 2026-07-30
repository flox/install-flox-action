const core = require('@actions/core')
const exec = require('@actions/exec')
const fs = require('fs')
const which = require('which')
const cache = require('./cache')

jest.mock('@actions/core')
jest.mock('@actions/exec')
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}))
jest.mock('which')
jest.mock('./cache')

const main = require('./main')

// `run` queries `flox` twice: once to decide whether anything needs installing,
// and once afterwards to report the path. `floxAfterInstall` lets a test say
// "absent beforehand, present afterwards", which is the fresh-runner case.
// `dpkg` defaults to present so `getDownloadUrl` resolves a package URL no
// matter which platform the tests run on; on Linux it is consulted, on darwin
// it is not.
function mockWhich({
  nix = null,
  flox = null,
  floxAfterInstall = flox,
  dpkg = '/usr/bin/dpkg'
} = {}) {
  let floxQueries = 0
  which.mockImplementation(cmd => {
    if (cmd === 'nix') return Promise.resolve(nix)
    if (cmd === 'dpkg') return Promise.resolve(dpkg)
    if (cmd === 'flox') {
      floxQueries += 1
      return Promise.resolve(floxQueries === 1 ? flox : floxAfterInstall)
    }
    return Promise.resolve(null)
  })
}

// `flox --version` is invoked through exec with a stdout listener.
function mockFloxVersion(version = '1.14.0') {
  exec.exec.mockImplementation(async (cmd, args, opts) => {
    if (cmd === 'flox' && args && args[0] === '--version' && opts?.listeners) {
      opts.listeners.stdout(Buffer.from(`${version}\n`))
    }
    return 0
  })
}

describe('main', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    core.getInput.mockReturnValue('')
    core.summary = {
      addHeading: jest.fn().mockReturnThis(),
      addTable: jest.fn().mockReturnThis(),
      write: jest.fn().mockResolvedValue(undefined)
    }
  })

  describe('run', () => {
    it('installs via package and configures when nix not found', async () => {
      mockWhich({ floxAfterInstall: '/usr/local/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion()

      await main.run()

      expect(core.startGroup).toHaveBeenCalledWith('Download & Install flox')
      expect(exec.exec).toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
      expect(core.setOutput).toHaveBeenCalledWith('nix-detected', 'false')
      expect(core.endGroup).toHaveBeenCalled()
    })

    it('installs via nix profile when a foreign nix is found', async () => {
      mockWhich({
        nix: '/nix/var/nix/profiles/default/bin/nix',
        floxAfterInstall: '/usr/local/bin/flox'
      })
      core.getInput.mockImplementation(name => {
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue('')
      mockFloxVersion()

      await main.run()

      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Nix found at')
      )
      expect(core.setOutput).toHaveBeenCalledWith('nix-detected', 'true')
    })

    // Issue #191: installing flox also installs nix into /usr/bin, so a
    // second run on a runner with a persistent disk finds a nix that this
    // action installed and mistakes it for one the user brought.
    it('skips installation when flox is already present alongside the nix it installed', async () => {
      mockWhich({ nix: '/usr/bin/nix', flox: '/usr/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion()

      await main.run()

      expect(exec.exec).not.toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
      expect(exec.exec).not.toHaveBeenCalledWith(
        'nix',
        expect.arrayContaining(['profile', 'install'])
      )
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Flox already installed at /usr/bin/flox')
      )
      expect(core.setOutput).toHaveBeenCalledWith('flox-preinstalled', 'true')
    })

    it('reinstalls when the installed version differs from the pinned one', async () => {
      mockWhich({ nix: '/usr/bin/nix', flox: '/usr/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'version') return '1.8.0'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion('flox 1.7.6')

      await main.run()

      expect(exec.exec).toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
      expect(core.setOutput).toHaveBeenCalledWith('flox-preinstalled', 'false')
    })

    it('skips installation when the pinned version is already installed', async () => {
      mockWhich({ nix: '/usr/bin/nix', flox: '/usr/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'version') return '1.7.6'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion('flox 1.7.6')

      await main.run()

      expect(exec.exec).not.toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
      expect(exec.exec).not.toHaveBeenCalledWith(
        'nix',
        expect.arrayContaining(['profile', 'install'])
      )
      expect(core.setOutput).toHaveBeenCalledWith('flox-preinstalled', 'true')
    })

    // flox reports a bare version; the summary must not claim the nix profile
    // path when a reinstall actually ran the package installer.
    it('reports the package method when reinstalling over an existing flox', async () => {
      mockWhich({ nix: '/usr/bin/nix', flox: '/usr/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'force-reinstall') return 'true'
        if (name === 'write-summary') return 'true'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion('1.14.0')

      await main.run()

      expect(core.summary.addTable).toHaveBeenCalledWith(
        expect.arrayContaining([expect.arrayContaining(['Method', 'package'])])
      )
    })

    // No package manager refuses this on its own, so the install would succeed
    // and the machine would break later against /nix, unattributably.
    it('fails rather than downgrade flox in place', async () => {
      mockWhich({ nix: '/usr/bin/nix', flox: '/usr/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'version') return '1.13.0'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion('1.14.0')

      await main.run()

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining(
          'downgrading to 1.13.0 in place is not supported'
        )
      )
      expect(exec.exec).not.toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
    })

    it('refuses a downgrade even when force-reinstall is set', async () => {
      mockWhich({ nix: '/usr/bin/nix', flox: '/usr/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'version') return '1.13.0'
        if (name === 'force-reinstall') return 'true'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion('1.14.0')

      await main.run()

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('not supported')
      )
    })

    it('installs a newer pinned version without complaint', async () => {
      mockWhich({ nix: '/usr/bin/nix', flox: '/usr/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'version') return '1.15.0'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion('1.14.0')

      await main.run()

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(core.warning).not.toHaveBeenCalled()
      expect(exec.exec).toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
    })

    // A commit-hash channel has no ordering, so it can be neither refused nor
    // cleared; it proceeds with the risk stated.
    it('warns but proceeds when the reference has no version ordering', async () => {
      mockWhich({ nix: '/usr/bin/nix', flox: '/usr/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'abc1234'
        if (name === 'force-reinstall') return 'true'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion('1.14.0')

      await main.run()

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('no version ordering')
      )
      expect(exec.exec).toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
    })

    it('reinstalls when force-reinstall is set', async () => {
      mockWhich({ nix: '/usr/bin/nix', flox: '/usr/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'force-reinstall') return 'true'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion()

      await main.run()

      expect(exec.exec).toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
    })

    // Records whether the token reached disk before or after installation.
    function trackOrder(order) {
      exec.exec.mockImplementation(async (cmd, args, opts) => {
        if (
          cmd === 'sudo' &&
          opts?.input?.toString().includes('access-tokens')
        ) {
          order.push('configure')
        }
        if (cmd === 'nix' && args[0] === 'profile') order.push('install')
        if (cmd === 'bash' && args[1]?.includes('install-flox.sh')) {
          order.push('install')
        }
        if (cmd === 'flox' && args[0] === '--version' && opts?.listeners) {
          opts.listeners.stdout(Buffer.from('flox 1.7.6\n'))
        }
        return 0
      })
    }

    // The flake fetch in installViaExistingNix reads access-tokens from disk,
    // so on that path the configuration has to be written first.
    it('configures nix before installing via an existing nix', async () => {
      const order = []
      mockWhich({
        nix: '/nix/var/nix/profiles/default/bin/nix',
        floxAfterInstall: '/usr/local/bin/flox'
      })
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue('')
      trackOrder(order)

      await main.run()

      expect(order).toEqual(['configure', 'install'])
    })

    // flox's postinst writes /etc/nix/nix.conf only when it finds none, so
    // creating one first would cost the defaults it puts there.
    it('configures nix after installing the package', async () => {
      const order = []
      mockWhich({ floxAfterInstall: '/usr/local/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'github-token') return 'ghp_test123'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      fs.existsSync.mockReturnValue(false)
      fs.readFileSync.mockReturnValue('')
      trackOrder(order)

      await main.run()

      expect(order).toEqual(['install', 'configure'])
    })

    it('restores from cache and skips download when use-cache is true and cache hits', async () => {
      mockWhich({ floxAfterInstall: '/usr/local/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'use-cache') return 'true'
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion()
      cache.restorePackage.mockResolvedValue(
        '/tmp/flox-package-cache/flox.x86_64-linux.deb'
      )
      cache.getCachePath.mockReturnValue(
        '/tmp/flox-package-cache/flox.x86_64-linux.deb'
      )

      await main.run()

      expect(cache.restorePackage).toHaveBeenCalled()
      expect(core.exportVariable).toHaveBeenCalledWith('SKIP_DOWNLOAD', 'true')
      expect(core.exportVariable).toHaveBeenCalledWith(
        'PRESERVE_DOWNLOAD',
        'true'
      )
      expect(exec.exec).toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
      expect(cache.savePackage).not.toHaveBeenCalled()
    })

    it('downloads and saves to cache when use-cache is true and cache misses', async () => {
      mockWhich({ floxAfterInstall: '/usr/local/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'use-cache') return 'true'
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion()
      cache.restorePackage.mockResolvedValue(null)
      cache.getCachePath.mockReturnValue(
        '/tmp/flox-package-cache/flox.x86_64-linux.deb'
      )
      cache.savePackage.mockResolvedValue(undefined)

      await main.run()

      expect(cache.restorePackage).toHaveBeenCalled()
      expect(core.exportVariable).toHaveBeenCalledWith(
        'DOWNLOADED_FILE',
        '/tmp/flox-package-cache/flox.x86_64-linux.deb'
      )
      expect(core.exportVariable).toHaveBeenCalledWith(
        'PRESERVE_DOWNLOAD',
        'true'
      )
      expect(cache.savePackage).toHaveBeenCalled()
    })

    it('does not use cache when use-cache is false', async () => {
      mockWhich({ floxAfterInstall: '/usr/local/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion()

      await main.run()

      expect(cache.restorePackage).not.toHaveBeenCalled()
      expect(cache.savePackage).not.toHaveBeenCalled()
    })

    it('catches errors and calls setFailed', async () => {
      which.mockImplementation(() => {
        throw new Error('something went wrong')
      })

      await main.run()

      expect(core.setFailed).toHaveBeenCalledWith('something went wrong')
    })

    it('does not write the job summary by default', async () => {
      mockWhich({ floxAfterInstall: '/usr/local/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      mockFloxVersion()

      await main.run()

      expect(core.summary.write).not.toHaveBeenCalled()
    })

    it('writes the job summary when write-summary is true', async () => {
      mockWhich({ floxAfterInstall: '/usr/local/bin/flox' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        if (name === 'write-summary') return 'true'
        return ''
      })
      mockFloxVersion()

      await main.run()

      expect(core.summary.addHeading).toHaveBeenCalledWith('Flox Installation')
      expect(core.summary.write).toHaveBeenCalled()
    })
  })

  describe('installViaExistingNix', () => {
    it('installs via nix profile with substituter flags', async () => {
      exec.exec.mockResolvedValue(0)

      await main.installViaExistingNix()

      expect(exec.exec).toHaveBeenCalledWith('nix', [
        'profile',
        'install',
        '--experimental-features',
        'nix-command flakes',
        '--extra-substituters',
        'https://cache.flox.dev',
        '--extra-trusted-public-keys',
        'flox-cache-public-1:7F4OyH7ZCnFhcze3fJdfyXYLQw/aV7GEed86nQ7IsOs=',
        '--accept-flake-config',
        'github:flox/flox/latest'
      ])
      expect(exec.exec).toHaveBeenCalledWith('flox', ['--version'])
      expect(core.info).toHaveBeenCalledWith(
        'Flox installed successfully via existing Nix'
      )
    })
  })

  describe('configureFlox', () => {
    it('trusts listed environments', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'trusted-environments') return 'myorg/env1,myorg/env2'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      exec.exec.mockResolvedValue(0)

      await main.configureFlox()

      expect(exec.exec).toHaveBeenCalledWith('flox', [
        'config',
        '--set',
        'trusted_environments."myorg/env1"',
        'trust'
      ])
      expect(exec.exec).toHaveBeenCalledWith('flox', [
        'config',
        '--set',
        'trusted_environments."myorg/env2"',
        'trust'
      ])
      expect(core.info).toHaveBeenCalledWith('Trusted environment: myorg/env1')
      expect(core.info).toHaveBeenCalledWith('Trusted environment: myorg/env2')
    })

    it('skips trusted environments when empty', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      exec.exec.mockResolvedValue(0)

      await main.configureFlox()

      expect(exec.exec).not.toHaveBeenCalledWith(
        'flox',
        expect.arrayContaining(['trusted_environments'])
      )
    })

    it('disables upgrade notifications by default', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      exec.exec.mockResolvedValue(0)

      await main.configureFlox()

      expect(exec.exec).toHaveBeenCalledWith('flox', [
        'config',
        '--set',
        'upgrade_notifications',
        'false'
      ])
      expect(core.info).toHaveBeenCalledWith('Upgrade notifications disabled')
    })

    it('skips upgrade notification config when false', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'disable-upgrade-notifications') return 'false'
        return ''
      })
      exec.exec.mockResolvedValue(0)

      await main.configureFlox()

      expect(exec.exec).not.toHaveBeenCalledWith(
        'flox',
        expect.arrayContaining(['upgrade_notifications'])
      )
    })

    it('applies extra-flox-config key=value pairs', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'extra-flox-config')
          return 'search_limit=20\nset_prompt=false'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      exec.exec.mockResolvedValue(0)

      await main.configureFlox()

      expect(exec.exec).toHaveBeenCalledWith('flox', [
        'config',
        '--set',
        'search_limit',
        '20'
      ])
      expect(exec.exec).toHaveBeenCalledWith('flox', [
        'config',
        '--set',
        'set_prompt',
        'false'
      ])
    })

    it('skips extra-flox-config when empty', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'disable-upgrade-notifications') return 'false'
        return ''
      })
      exec.exec.mockResolvedValue(0)

      await main.configureFlox()

      expect(exec.exec).not.toHaveBeenCalledWith(
        'flox',
        expect.arrayContaining(['search_limit'])
      )
    })

    it('skips lines without = in extra-flox-config', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'extra-flox-config') return 'invalid_line\nsearch_limit=10'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
      exec.exec.mockResolvedValue(0)

      await main.configureFlox()

      expect(exec.exec).toHaveBeenCalledWith('flox', [
        'config',
        '--set',
        'search_limit',
        '10'
      ])
      expect(exec.exec).not.toHaveBeenCalledWith(
        'flox',
        expect.arrayContaining(['invalid_line'])
      )
    })
  })

  describe('configureNixExtra', () => {
    // Writes go through `sudo tee <path>` with the content on stdin, so the
    // file never appears in a command line the runner would echo to the log.
    const writes = () =>
      exec.exec.mock.calls
        .filter(([cmd, args]) => cmd === 'sudo' && args[0] === 'tee')
        .map(([, args, opts]) => ({
          path: args[1],
          content: opts.input.toString()
        }))

    const writeTo = p => writes().find(w => w.path === p)?.content

    // The action's own file carries a per-job name.
    const actionConfWrite = () =>
      writes().find(w => /install-flox-action-.+\.conf$/.test(w.path))?.content

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue('# existing\n')
      exec.exec.mockResolvedValue(0)
    })

    it('writes extra-nix-config to the file it owns', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'extra-nix-config')
          return 'sandbox = relaxed\nmax-jobs = 4'
        return ''
      })

      await main.configureNixExtra()

      const written = actionConfWrite()
      expect(written).toContain('sandbox = relaxed')
      expect(written).toContain('max-jobs = 4')
    })

    it('writes extra substituters and their keys', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'extra-substituters') return 'https://cache.example.com'
        if (name === 'extra-substituter-keys') return 'example-1:AAAA='
        return ''
      })

      await main.configureNixExtra()

      const written = actionConfWrite()
      expect(written).toContain(
        'extra-trusted-substituters = https://cache.example.com'
      )
      expect(written).toContain('extra-trusted-public-keys = example-1:AAAA=')
    })

    it('writes the github token', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })

      await main.configureNixExtra()

      expect(core.setSecret).toHaveBeenCalledWith('ghp_test123')
      expect(actionConfWrite()).toContain(
        'access-tokens = github.com=ghp_test123'
      )
    })

    // The token GitHub grants a job dies with that job. A runner whose disk
    // survives keeps the dead token, and reusing it yields 401 rather than the
    // anonymous access an absent token would have given.
    it('replaces a stale token left by an earlier run', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_fresh'
        return ''
      })
      fs.readFileSync.mockReturnValue(
        '# existing\naccess-tokens = github.com=ghp_expired\n'
      )
      fs.existsSync.mockImplementation(
        p => p === '/etc/nix' || p === '/etc/nix/install-flox-action.conf'
      )

      await main.configureNixExtra()

      expect(actionConfWrite()).toContain(
        'access-tokens = github.com=ghp_fresh'
      )
    })

    it('replaces a stale token recorded in a legacy nix.conf block', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_fresh'
        return ''
      })
      fs.readFileSync.mockReturnValue(
        '# existing\n\n# Added by install-flox-action\naccess-tokens = github.com=ghp_expired\n'
      )

      await main.configureNixExtra()

      expect(actionConfWrite()).toContain(
        'access-tokens = github.com=ghp_fresh'
      )
      const rewritten = writeTo('/etc/nix/nix.conf')
      expect(rewritten).not.toContain('ghp_expired')
      expect(rewritten).not.toContain('# Added by install-flox-action')
    })

    // An expired token on disk cannot be told apart from one an administrator
    // still relies on, so the job's token takes github.com over either way.
    it('takes over the github.com entry of an existing access-tokens line', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })
      fs.readFileSync.mockReturnValue('access-tokens = github.com=user_pat\n')

      await main.configureNixExtra()

      // The line in nix.conf is left as it is; the include appended after it
      // wins, so the merged line is what Nix resolves.
      const written = actionConfWrite()
      expect(written).toContain('access-tokens = github.com=ghp_test123')
      expect(written).not.toContain('user_pat')
    })

    // Credentials for hosts this action knows nothing about survive a takeover.
    it('keeps entries for other hosts when it merges the job token in', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })
      fs.readFileSync.mockReturnValue(
        'access-tokens = gitlab.example=glpat_keep github.com=user_pat\n'
      )

      await main.configureNixExtra()

      const written = actionConfWrite()
      expect(written).toContain('gitlab.example=glpat_keep')
      expect(written).toContain('github.com=ghp_test123')
    })

    // A runner carrying only a non-GitHub token still gets one, so flake
    // fetches are authenticated rather than anonymous and rate limited.
    it('adds a github.com entry when only other hosts are configured', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })
      fs.readFileSync.mockReturnValue(
        'access-tokens = gitlab.example=glpat_keep\n'
      )

      await main.configureNixExtra()

      const written = actionConfWrite()
      expect(written).toContain('gitlab.example=glpat_keep')
      expect(written).toContain('github.com=ghp_test123')
    })

    // Someone who worked around the 401 by adding their own access-tokens
    // line leaves nothing for this action to write, but the legacy block below
    // theirs still holds the expired token and Nix still reads it.
    it('strips a legacy block even when it writes nothing itself', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })
      fs.readFileSync.mockReturnValue(
        'access-tokens = github.com=user_pat\n# Added by install-flox-action\naccess-tokens = github.com=ghp_expired\n'
      )

      await main.configureNixExtra()

      const rewritten = writeTo('/etc/nix/nix.conf')
      expect(rewritten).toContain('access-tokens = github.com=user_pat')
      expect(rewritten).not.toContain('ghp_expired')
      expect(rewritten).not.toContain('# Added by install-flox-action')
    })

    // The old block carried extra-nix-config verbatim, blank lines included.
    it('strips a legacy block whose settings resume after a blank line', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_fresh'
        return ''
      })
      fs.readFileSync.mockReturnValue(
        '# Added by install-flox-action\nsandbox = relaxed\n\nmax-jobs = 4\naccess-tokens = github.com=ghp_expired\n'
      )

      await main.configureNixExtra()

      const rewritten = writeTo('/etc/nix/nix.conf')
      expect(rewritten).not.toContain('ghp_expired')
      expect(actionConfWrite()).toContain(
        'access-tokens = github.com=ghp_fresh'
      )
    })

    // The migration happens once per machine and is what stops a stale token
    // being served, so it should be findable in the log afterwards.
    it('logs when it removes settings from an earlier version', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_fresh'
        return ''
      })
      fs.readFileSync.mockReturnValue(
        '# Added by install-flox-action\naccess-tokens = github.com=ghp_expired\n'
      )

      await main.configureNixExtra()

      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('written into /etc/nix/nix.conf by an earlier')
      )
    })

    it('says nothing about migration when there is none', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_fresh'
        return ''
      })
      fs.readFileSync.mockReturnValue('# existing\n')

      await main.configureNixExtra()

      expect(core.info).not.toHaveBeenCalledWith(
        expect.stringContaining('by an earlier version')
      )
    })

    // @actions/exec echoes the command it runs. Content in a command line
    // would print anything already in nix.conf, a hand-written token included.
    it('keeps file content out of the command line', async () => {
      core.getInput.mockImplementation(name =>
        name === 'github-token' ? 'ghp_test123' : ''
      )
      fs.readFileSync.mockReturnValue('access-tokens = github.com=admin_pat\n')

      await main.configureNixExtra()

      const argv = exec.exec.mock.calls.map(([cmd, args]) =>
        [cmd, ...args].join(' ')
      )
      expect(argv.join('\n')).not.toContain('admin_pat')
      expect(argv.join('\n')).not.toContain('ghp_test123')
    })

    // The action cannot know about a token an administrator wrote by hand, so
    // nothing would mask it if it ever did reach the log.
    it('masks a token it finds already in nix.conf', async () => {
      core.getInput.mockImplementation(name =>
        name === 'github-token' ? 'ghp_test123' : ''
      )
      fs.readFileSync.mockReturnValue('access-tokens = github.com=admin_pat\n')

      await main.configureNixExtra()

      expect(core.setSecret).toHaveBeenCalledWith('admin_pat')
    })

    // Taking over someone's token silently would look like the action ignoring
    // their configuration.
    it('says so when it takes over an existing github.com entry', async () => {
      core.getInput.mockImplementation(name =>
        name === 'github-token' ? 'ghp_test123' : ''
      )
      fs.readFileSync.mockReturnValue('access-tokens = github.com=admin_pat\n')

      await main.configureNixExtra()

      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Replaced the github.com entry')
      )
    })

    // With every input empty there is nothing to write, but a block left by an
    // earlier version still holds a token that died with the job that wrote it.
    it('strips a legacy block even when it has nothing to write in its place', async () => {
      core.getInput.mockReturnValue('')
      fs.readFileSync.mockReturnValue(
        '# existing\n# Added by install-flox-action\naccess-tokens = github.com=ghp_expired\n'
      )

      await main.configureNixExtra()

      const rewritten = writeTo('/etc/nix/nix.conf')
      expect(rewritten).toBeDefined()
      expect(rewritten).not.toContain('ghp_expired')
      expect(actionConfWrite()).toBeUndefined()
    })

    it('stays quiet when there was no github.com entry to take over', async () => {
      core.getInput.mockImplementation(name =>
        name === 'github-token' ? 'ghp_test123' : ''
      )
      fs.readFileSync.mockReturnValue('')

      await main.configureNixExtra()

      expect(core.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Replaced the github.com entry')
      )
    })

    // Tokens for other hosts are copied into the file this action writes, so
    // they have to be masked as well as its own.
    it('masks tokens it carries forward from the existing configuration', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })
      fs.readFileSync.mockReturnValue(
        'access-tokens = gitlab.example=glpat_secret github.com=user_pat\n'
      )

      await main.configureNixExtra()

      expect(core.setSecret).toHaveBeenCalledWith('ghp_test123')
      expect(core.setSecret).toHaveBeenCalledWith('glpat_secret')
      expect(core.setSecret).toHaveBeenCalledWith('user_pat')
    })

    // A bare `include` of a missing file is a hard error in Nix. The post-job
    // scrub deletes the file, so the directive has to tolerate its absence or
    // every later nix invocation on a persistent runner breaks.
    it('includes the file optionally so a missing one is not fatal', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })

      await main.configureNixExtra()

      const rewritten = writeTo('/etc/nix/nix.conf')
      expect(rewritten).toContain('!include install-flox-action-')
      expect(rewritten).not.toMatch(/^include install-flox-action/m)
    })

    it('does not add a second include line on a later run', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })
      fs.readFileSync.mockReturnValue('# existing\n')

      await main.configureNixExtra()

      expect(writeTo('/etc/nix/nix.conf')).toBeDefined()
    })

    it('keeps an include directive that follows a legacy block', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })
      fs.readFileSync.mockReturnValue(
        '# Added by install-flox-action\naccess-tokens = github.com=ghp_expired\ninclude flox.conf\n'
      )

      await main.configureNixExtra()

      const rewritten = writeTo('/etc/nix/nix.conf')
      expect(rewritten).toContain('include flox.conf')
      expect(rewritten).not.toContain('ghp_expired')
    })

    it('names the file for this job and hands the name to the post step', async () => {
      core.getInput.mockImplementation(name =>
        name === 'github-token' ? 'ghp_test123' : ''
      )

      await main.configureNixExtra()

      expect(core.saveState).toHaveBeenCalledWith(
        'confName',
        expect.stringMatching(/^install-flox-action-.+\.conf$/)
      )
    })

    it('does nothing when there is no configuration and no leftover file', async () => {
      core.getInput.mockReturnValue('')
      fs.existsSync.mockImplementation(p => p === '/etc/nix')

      await main.configureNixExtra()

      expect(exec.exec).not.toHaveBeenCalled()
    })

    it('creates /etc/nix if it does not exist', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'extra-nix-config') return 'max-jobs = 2'
        return ''
      })
      fs.existsSync.mockReturnValue(false)

      await main.configureNixExtra()

      expect(exec.exec).toHaveBeenCalledWith('sudo', [
        'mkdir',
        '-p',
        '/etc/nix'
      ])
    })
  })

  describe('isOrderable', () => {
    it('is true only for two dotted versions', () => {
      expect(main.isOrderable('1.13.0', '1.14.0')).toBe(true)
      expect(main.isOrderable('1.13.0', 'flox 1.14.0')).toBe(true)
      expect(main.isOrderable('', '1.14.0')).toBe(false)
      expect(main.isOrderable('abc1234', '1.14.0')).toBe(false)
    })
  })

  describe('isDowngrade', () => {
    it('recognizes a lower dotted version', () => {
      expect(main.isDowngrade('1.13.0', '1.14.0')).toBe(true)
      expect(main.isDowngrade('1.13.0', 'flox 1.14.0')).toBe(true)
      expect(main.isDowngrade('1.9.0', '1.10.0')).toBe(true)
    })

    it('is false for the same or a higher version', () => {
      expect(main.isDowngrade('1.14.0', '1.14.0')).toBe(false)
      expect(main.isDowngrade('1.15.0', '1.14.0')).toBe(false)
      expect(main.isDowngrade('2.0.0', '1.14.0')).toBe(false)
    })

    // A channel or commit pin has no ordering, so guessing a direction would
    // mean warning about changes that may not be downgrades at all.
    it('declines to guess when either side is not a dotted version', () => {
      expect(main.isDowngrade('nightly', '1.14.0')).toBe(false)
      expect(main.isDowngrade('abc1234', '1.14.0')).toBe(false)
      expect(main.isDowngrade('', '1.14.0')).toBe(false)
      expect(main.isDowngrade('1.13.0', '')).toBe(false)
    })
  })

  describe('versionSatisfies', () => {
    it('accepts anything when no version is pinned', () => {
      expect(main.versionSatisfies('', '1.14.0')).toBe(true)
    })

    it('matches the bare version flox reports', () => {
      expect(main.versionSatisfies('1.14.0', '1.14.0')).toBe(true)
      expect(main.versionSatisfies('1.13.0', '1.14.0')).toBe(false)
    })

    it('matches the older program-prefixed form', () => {
      expect(main.versionSatisfies('1.7.6', 'flox 1.7.6')).toBe(true)
      expect(main.versionSatisfies('1.7.5', 'flox 1.7.6')).toBe(false)
    })
  })

  describe('captureOutputs', () => {
    it('captures flox version and path', async () => {
      exec.exec.mockImplementation(async (cmd, args, opts) => {
        if (cmd === 'flox' && args[0] === '--version') {
          opts.listeners.stdout(Buffer.from('flox 1.7.6\n'))
        }
        return 0
      })
      which.mockResolvedValue('/usr/local/bin/flox')

      await main.captureOutputs(false, false)

      expect(core.setOutput).toHaveBeenCalledWith('flox-version', 'flox 1.7.6')
      expect(core.setOutput).toHaveBeenCalledWith(
        'flox-path',
        '/usr/local/bin/flox'
      )
      expect(core.setOutput).toHaveBeenCalledWith('nix-detected', 'false')
      expect(core.setOutput).toHaveBeenCalledWith('flox-preinstalled', 'false')
    })

    it('reports flox-preinstalled when installation was skipped', async () => {
      mockFloxVersion()
      which.mockResolvedValue('/usr/bin/flox')

      await main.captureOutputs(true, true)

      expect(core.setOutput).toHaveBeenCalledWith('flox-preinstalled', 'true')
    })

    it('sets nix-detected to true when nix found', async () => {
      exec.exec.mockImplementation(async (cmd, args, opts) => {
        if (opts && opts.listeners && opts.listeners.stdout) {
          opts.listeners.stdout(Buffer.from('flox 1.7.6\n'))
        }
        return 0
      })
      which.mockResolvedValue('/usr/local/bin/flox')

      await main.captureOutputs(true, false)

      expect(core.setOutput).toHaveBeenCalledWith('nix-detected', 'true')
    })
  })

  describe('writeJobSummary', () => {
    it('writes summary with install details', async () => {
      await main.writeJobSummary({
        floxVersion: 'flox 1.7.6',
        channel: 'stable',
        method: 'package',
        platform: 'linux',
        arch: 'x64',
        nixDetected: false
      })

      expect(core.summary.addHeading).toHaveBeenCalledWith('Flox Installation')
      expect(core.summary.addTable).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.arrayContaining(['Version', 'flox 1.7.6'])
        ])
      )
      expect(core.summary.addTable).toHaveBeenCalledWith(
        expect.arrayContaining([expect.arrayContaining(['Nix on PATH', 'No'])])
      )
      expect(core.summary.write).toHaveBeenCalled()
    })

    it('shows nix profile method when nix detected', async () => {
      await main.writeJobSummary({
        floxVersion: 'flox 1.7.6',
        channel: 'stable',
        method: 'nix profile',
        platform: 'darwin',
        arch: 'arm64',
        nixDetected: true
      })

      expect(core.summary.addTable).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.arrayContaining(['Method', 'nix profile']),
          expect.arrayContaining(['Nix on PATH', 'Yes'])
        ])
      )
    })
  })

  describe('getDownloadUrl', () => {
    const originalPlatform = process.platform
    const originalArch = process.arch

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform })
      Object.defineProperty(process, 'arch', { value: originalArch })
    })

    it('uses custom base-url when provided', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      Object.defineProperty(process, 'arch', { value: 'arm64' })
      core.getInput.mockImplementation(name => {
        if (name === 'base-url') return 'https://custom.example.com'
        return ''
      })
      which.mockResolvedValue(null)

      const url = await main.getDownloadUrl()

      expect(url).toBe('https://custom.example.com/osx/flox.aarch64-darwin.pkg')
    })

    it('uses channel in URL for stable/qa/nightly', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      Object.defineProperty(process, 'arch', { value: 'arm64' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'nightly'
        return ''
      })
      which.mockResolvedValue(null)

      const url = await main.getDownloadUrl()

      expect(url).toBe(
        'https://downloads.flox.dev/by-env/nightly/osx/flox.aarch64-darwin.pkg'
      )
    })

    it('uses commit hash in URL for non-channel values', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      Object.defineProperty(process, 'arch', { value: 'arm64' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'abc123def'
        return ''
      })
      which.mockResolvedValue(null)

      const url = await main.getDownloadUrl()

      expect(url).toBe(
        'https://downloads.flox.dev/by-commit/abc123def/osx/flox.aarch64-darwin.pkg'
      )
    })

    it('includes version in filename when provided', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      Object.defineProperty(process, 'arch', { value: 'arm64' })
      core.getInput.mockImplementation(name => {
        if (name === 'version') return '1.2.3'
        if (name === 'channel') return 'stable'
        return ''
      })
      which.mockResolvedValue(null)

      const url = await main.getDownloadUrl()

      expect(url).toContain('flox-1.2.3.aarch64-darwin.pkg')
    })

    it('returns correct URL for darwin x64', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      Object.defineProperty(process, 'arch', { value: 'x64' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      which.mockResolvedValue(null)

      const url = await main.getDownloadUrl()

      expect(url).toContain('/osx/flox.x86_64-darwin.pkg')
    })

    it('returns correct URL for darwin arm64', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      Object.defineProperty(process, 'arch', { value: 'arm64' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      which.mockResolvedValue(null)

      const url = await main.getDownloadUrl()

      expect(url).toContain('/osx/flox.aarch64-darwin.pkg')
    })

    it('returns correct URL for linux x64 with dpkg', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' })
      Object.defineProperty(process, 'arch', { value: 'x64' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      which.mockImplementation(cmd => {
        if (cmd === 'dpkg') return Promise.resolve('/usr/bin/dpkg')
        return Promise.resolve(null)
      })

      const url = await main.getDownloadUrl()

      expect(url).toContain('/deb/flox.x86_64-linux.deb')
    })

    it('returns correct URL for linux arm64 with dpkg', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' })
      Object.defineProperty(process, 'arch', { value: 'arm64' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      which.mockImplementation(cmd => {
        if (cmd === 'dpkg') return Promise.resolve('/usr/bin/dpkg')
        return Promise.resolve(null)
      })

      const url = await main.getDownloadUrl()

      expect(url).toContain('/deb/flox.aarch64-linux.deb')
    })

    it('returns correct URL for linux x64 with rpm', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' })
      Object.defineProperty(process, 'arch', { value: 'x64' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      which.mockImplementation(cmd => {
        if (cmd === 'rpm') return Promise.resolve('/usr/bin/rpm')
        return Promise.resolve(null)
      })

      const url = await main.getDownloadUrl()

      expect(url).toContain('/rpm/flox.x86_64-linux.rpm')
    })

    it('returns correct URL for linux arm64 with rpm', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' })
      Object.defineProperty(process, 'arch', { value: 'arm64' })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      which.mockImplementation(cmd => {
        if (cmd === 'rpm') return Promise.resolve('/usr/bin/rpm')
        return Promise.resolve(null)
      })

      const url = await main.getDownloadUrl()

      expect(url).toContain('/rpm/flox.aarch64-linux.rpm')
    })

    it('fails for unsupported platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' })
      Object.defineProperty(process, 'arch', { value: 'x64' })
      core.getInput.mockReturnValue('')
      which.mockResolvedValue(null)

      await main.getDownloadUrl()

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('No platform')
      )
    })

    it('exports PROXY env var when provided', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      Object.defineProperty(process, 'arch', { value: 'arm64' })
      core.getInput.mockImplementation(name => {
        if (name === 'proxy') return 'https://proxy.corp.com:8080'
        if (name === 'channel') return 'stable'
        return ''
      })
      which.mockResolvedValue(null)

      await main.getDownloadUrl()

      expect(core.exportVariable).toHaveBeenCalledWith(
        'PROXY',
        'https://proxy.corp.com:8080'
      )
      expect(core.exportVariable).toHaveBeenCalledWith(
        'HTTPS_PROXY',
        'https://proxy.corp.com:8080'
      )
      expect(core.exportVariable).toHaveBeenCalledWith(
        'HTTP_PROXY',
        'https://proxy.corp.com:8080'
      )
    })

    it('exports RETRIES env var', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      Object.defineProperty(process, 'arch', { value: 'arm64' })
      core.getInput.mockImplementation(name => {
        if (name === 'retries') return '5'
        if (name === 'channel') return 'stable'
        return ''
      })
      which.mockResolvedValue(null)

      await main.getDownloadUrl()

      expect(core.exportVariable).toHaveBeenCalledWith('RETRIES', '5')
    })
  })
})

describe('run disable-metrics guard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    core.getInput.mockReturnValue('')
    core.summary = {
      addHeading: jest.fn().mockReturnThis(),
      addTable: jest.fn().mockReturnThis(),
      write: jest.fn().mockResolvedValue(undefined)
    }
  })

  it('does not export FLOX_DISABLE_METRICS in run() when disable-metrics input is unset', async () => {
    which.mockImplementation(cmd => {
      if (cmd === 'nix')
        return Promise.resolve('/nix/var/nix/profiles/default/bin/nix')
      if (cmd === 'flox') return Promise.resolve('/usr/local/bin/flox')
      return Promise.resolve(null)
    })
    core.getInput.mockImplementation(name => {
      if (name === 'disable-upgrade-notifications') return 'true'
      return ''
    })
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('')
    exec.exec.mockImplementation(async (cmd, args, opts) => {
      if (
        cmd === 'flox' &&
        args &&
        args[0] === '--version' &&
        opts &&
        opts.listeners
      ) {
        opts.listeners.stdout(Buffer.from('flox 1.7.6\n'))
      }
      return 0
    })

    await main.run()

    expect(core.exportVariable).not.toHaveBeenCalledWith(
      'FLOX_DISABLE_METRICS',
      expect.anything()
    )
  })

  it('exports FLOX_DISABLE_METRICS in run() when disable-metrics input is explicitly set', async () => {
    which.mockImplementation(cmd => {
      if (cmd === 'nix')
        return Promise.resolve('/nix/var/nix/profiles/default/bin/nix')
      if (cmd === 'flox') return Promise.resolve('/usr/local/bin/flox')
      return Promise.resolve(null)
    })
    core.getInput.mockImplementation(name => {
      if (name === 'disable-metrics') return 'true'
      if (name === 'disable-upgrade-notifications') return 'true'
      return ''
    })
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('')
    exec.exec.mockImplementation(async (cmd, args, opts) => {
      if (
        cmd === 'flox' &&
        args &&
        args[0] === '--version' &&
        opts &&
        opts.listeners
      ) {
        opts.listeners.stdout(Buffer.from('flox 1.7.6\n'))
      }
      return 0
    })

    await main.run()

    expect(core.exportVariable).toHaveBeenCalledWith(
      'FLOX_DISABLE_METRICS',
      'true'
    )
  })
})
