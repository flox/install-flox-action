const core = require('@actions/core')
const exec = require('@actions/exec')
const fs = require('fs')
const which = require('which')

jest.mock('@actions/core')
jest.mock('@actions/exec')
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}))
jest.mock('which')

const main = require('./main')

describe('main', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    core.getInput.mockReturnValue('')
  })

  describe('run', () => {
    it('uses package installation when nix is not found', async () => {
      which.mockResolvedValue(null)
      exec.exec.mockResolvedValue(0)

      await main.run()

      expect(core.startGroup).toHaveBeenCalledWith('Download & Install flox')
      expect(exec.exec).toHaveBeenCalledWith('bash', [
        '-c',
        expect.stringContaining('install-flox.sh')
      ])
      expect(core.endGroup).toHaveBeenCalled()
    })

    it('uses nix profile install when nix is found', async () => {
      which.mockResolvedValue('/nix/var/nix/profiles/default/bin/nix')
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue('')
      exec.exec.mockResolvedValue(0)

      await main.run()

      expect(core.info).toHaveBeenCalledWith(
        'Nix found at /nix/var/nix/profiles/default/bin/nix'
      )
      expect(core.info).toHaveBeenCalledWith(
        'Nix detected - installing Flox via nix profile install'
      )
      expect(exec.exec).toHaveBeenCalledWith('nix', [
        'profile',
        'install',
        '--impure',
        '--no-update-lock-file',
        'github:flox/floxpkgs#flox.fromCatalog',
        '--accept-flake-config'
      ])
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
    it('configures substituter and installs via nix profile', async () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue('')
      exec.exec.mockResolvedValue(0)

      await main.installViaExistingNix()

      expect(exec.exec).toHaveBeenCalledWith('nix', [
        'profile',
        'install',
        '--impure',
        '--no-update-lock-file',
        'github:flox/floxpkgs#flox.fromCatalog',
        '--accept-flake-config'
      ])
      expect(exec.exec).toHaveBeenCalledWith('flox', ['--version'])
      expect(core.info).toHaveBeenCalledWith(
        'Flox installed successfully via existing Nix'
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
