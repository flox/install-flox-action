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
      which.mockImplementation(cmd => {
        if (cmd === 'nix') return Promise.resolve(null)
        if (cmd === 'flox') return Promise.resolve('/usr/local/bin/flox')
        return Promise.resolve(null)
      })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
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

      expect(core.startGroup).toHaveBeenCalledWith('Download & Install flox')
      expect(exec.exec).toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
      expect(core.setOutput).toHaveBeenCalledWith('nix-detected', 'false')
      expect(core.endGroup).toHaveBeenCalled()
    })

    it('installs via nix profile when nix is found', async () => {
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

      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Nix found at')
      )
      expect(core.setOutput).toHaveBeenCalledWith('nix-detected', 'true')
    })

    it('restores from cache and skips download when use-cache is true and cache hits', async () => {
      which.mockImplementation(cmd => {
        if (cmd === 'nix') return Promise.resolve(null)
        if (cmd === 'flox') return Promise.resolve('/usr/local/bin/flox')
        return Promise.resolve(null)
      })
      core.getInput.mockImplementation(name => {
        if (name === 'use-cache') return 'true'
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
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
      cache.restorePackage.mockResolvedValue('/tmp/flox-package-cache')
      cache.getCachePath.mockReturnValue('/tmp/flox-package-cache')

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
      which.mockImplementation(cmd => {
        if (cmd === 'nix') return Promise.resolve(null)
        if (cmd === 'flox') return Promise.resolve('/usr/local/bin/flox')
        return Promise.resolve(null)
      })
      core.getInput.mockImplementation(name => {
        if (name === 'use-cache') return 'true'
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
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
      cache.restorePackage.mockResolvedValue(null)
      cache.getCachePath.mockReturnValue('/tmp/flox-package-cache')
      cache.savePackage.mockResolvedValue(undefined)

      await main.run()

      expect(cache.restorePackage).toHaveBeenCalled()
      expect(core.exportVariable).toHaveBeenCalledWith(
        'DOWNLOADED_FILE',
        '/tmp/flox-package-cache'
      )
      expect(core.exportVariable).toHaveBeenCalledWith(
        'PRESERVE_DOWNLOAD',
        'true'
      )
      expect(cache.savePackage).toHaveBeenCalled()
    })

    it('does not use cache when use-cache is false', async () => {
      which.mockImplementation(cmd => {
        if (cmd === 'nix') return Promise.resolve(null)
        if (cmd === 'flox') return Promise.resolve('/usr/local/bin/flox')
        return Promise.resolve(null)
      })
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'disable-upgrade-notifications') return 'true'
        return ''
      })
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
  })

  describe('configureNixSubstituter', () => {
    it('creates /etc/nix directory if it does not exist', async () => {
      fs.existsSync.mockImplementation(path => {
        if (path === '/etc/nix') return false
        if (path === '/etc/nix/nix.conf') return false
        return false
      })
      exec.exec.mockResolvedValue(0)

      await main.configureNixSubstituter()

      expect(exec.exec).toHaveBeenCalledWith('sudo', [
        'mkdir',
        '-p',
        '/etc/nix'
      ])
    })

    it('adds flox substituter to nix.conf if not present', async () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue('# existing config\n')
      exec.exec.mockResolvedValue(0)

      await main.configureNixSubstituter()

      expect(exec.exec).toHaveBeenCalledWith('sudo', [
        'bash',
        '-c',
        expect.stringContaining('cache.flox.dev')
      ])
      expect(core.info).toHaveBeenCalledWith(
        'Configured Flox substituter in /etc/nix/nix.conf'
      )
    })

    it('skips adding substituter if already configured', async () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(
        'extra-trusted-substituters = https://cache.flox.dev\n'
      )
      exec.exec.mockResolvedValue(0)

      await main.configureNixSubstituter()

      expect(core.info).toHaveBeenCalledWith(
        'Flox substituter already configured'
      )
      expect(exec.exec).not.toHaveBeenCalledWith(
        'sudo',
        expect.arrayContaining(['bash'])
      )
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
    it('appends extra-nix-config to nix.conf', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'extra-nix-config')
          return 'sandbox = relaxed\nmax-jobs = 4'
        return ''
      })
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue('# existing\n')
      exec.exec.mockResolvedValue(0)

      await main.configureNixExtra()

      expect(exec.exec).toHaveBeenCalledWith('sudo', [
        'bash',
        '-c',
        expect.stringContaining('sandbox = relaxed')
      ])
    })

    it('adds extra substituters to nix.conf', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'extra-substituters') return 'https://cache.example.com'
        if (name === 'extra-substituter-keys') return 'example-1:AAAA='
        return ''
      })
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue('# existing\n')
      exec.exec.mockResolvedValue(0)

      await main.configureNixExtra()

      expect(exec.exec).toHaveBeenCalledWith('sudo', [
        'bash',
        '-c',
        expect.stringContaining(
          'extra-trusted-substituters = https://cache.example.com'
        )
      ])
      expect(exec.exec).toHaveBeenCalledWith('sudo', [
        'bash',
        '-c',
        expect.stringContaining('extra-trusted-public-keys = example-1:AAAA=')
      ])
    })

    it('adds github token as access-token', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue('# existing\n')
      exec.exec.mockResolvedValue(0)

      await main.configureNixExtra()

      expect(core.setSecret).toHaveBeenCalledWith('ghp_test123')
      expect(exec.exec).toHaveBeenCalledWith('sudo', [
        'bash',
        '-c',
        expect.stringContaining('access-tokens = github.com=ghp_test123')
      ])
    })

    it('skips github token if access-tokens already set', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'ghp_test123'
        return ''
      })
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue('access-tokens = github.com=existing\n')
      exec.exec.mockResolvedValue(0)

      await main.configureNixExtra()

      expect(exec.exec).not.toHaveBeenCalledWith(
        'sudo',
        expect.arrayContaining([expect.stringContaining('access-tokens')])
      )
    })

    it('does nothing when no nix config inputs provided', async () => {
      core.getInput.mockReturnValue('')

      await main.configureNixExtra()

      expect(exec.exec).not.toHaveBeenCalled()
    })

    it('creates /etc/nix if it does not exist', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'extra-nix-config') return 'max-jobs = 2'
        return ''
      })
      fs.existsSync.mockImplementation(p => {
        if (p === '/etc/nix') return false
        if (p === '/etc/nix/nix.conf') return false
        return false
      })
      exec.exec.mockResolvedValue(0)

      await main.configureNixExtra()

      expect(exec.exec).toHaveBeenCalledWith('sudo', [
        'mkdir',
        '-p',
        '/etc/nix'
      ])
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

      await main.captureOutputs(false)

      expect(core.setOutput).toHaveBeenCalledWith('flox-version', 'flox 1.7.6')
      expect(core.setOutput).toHaveBeenCalledWith(
        'flox-path',
        '/usr/local/bin/flox'
      )
      expect(core.setOutput).toHaveBeenCalledWith('nix-detected', 'false')
    })

    it('sets nix-detected to true when nix found', async () => {
      exec.exec.mockImplementation(async (cmd, args, opts) => {
        if (opts && opts.listeners && opts.listeners.stdout) {
          opts.listeners.stdout(Buffer.from('flox 1.7.6\n'))
        }
        return 0
      })
      which.mockResolvedValue('/usr/local/bin/flox')

      await main.captureOutputs(true)

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
        expect.arrayContaining([
          expect.arrayContaining(['Nix pre-installed', 'No'])
        ])
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
          expect.arrayContaining(['Nix pre-installed', 'Yes'])
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

    it('exports DISABLE_METRICS and RETRIES env vars', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      Object.defineProperty(process, 'arch', { value: 'arm64' })
      core.getInput.mockImplementation(name => {
        if (name === 'disable-metrics') return 'true'
        if (name === 'retries') return '5'
        if (name === 'channel') return 'stable'
        return ''
      })
      which.mockResolvedValue(null)

      await main.getDownloadUrl()

      expect(core.exportVariable).toHaveBeenCalledWith(
        'DISABLE_METRICS',
        'true'
      )
      expect(core.exportVariable).toHaveBeenCalledWith('RETRIES', '5')
    })
  })
})
