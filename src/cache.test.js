const core = require('@actions/core')
const cache = require('@actions/cache')

jest.mock('@actions/core')
jest.mock('@actions/cache')

const {
  getCacheKey,
  getRestoreKeys,
  getCachePath,
  restorePackage,
  savePackage,
  parsePlatformInfo,
  isVersionPinned,
  getDateString
} = require('./cache')

describe('cache', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    core.getInput.mockReturnValue('')
  })

  describe('parsePlatformInfo', () => {
    it('parses linux x64 deb URL', () => {
      const result = parsePlatformInfo(
        'https://downloads.flox.dev/by-env/stable/deb/flox.x86_64-linux.deb'
      )
      expect(result).toEqual({ os: 'linux', arch: 'x64', ext: 'deb' })
    })

    it('parses linux arm64 rpm URL', () => {
      const result = parsePlatformInfo(
        'https://downloads.flox.dev/by-env/stable/rpm/flox.aarch64-linux.rpm'
      )
      expect(result).toEqual({ os: 'linux', arch: 'arm64', ext: 'rpm' })
    })

    it('parses darwin x64 pkg URL', () => {
      const result = parsePlatformInfo(
        'https://downloads.flox.dev/by-env/stable/osx/flox.x86_64-darwin.pkg'
      )
      expect(result).toEqual({ os: 'darwin', arch: 'x64', ext: 'pkg' })
    })

    it('parses darwin arm64 pkg URL', () => {
      const result = parsePlatformInfo(
        'https://downloads.flox.dev/by-env/stable/osx/flox.aarch64-darwin.pkg'
      )
      expect(result).toEqual({ os: 'darwin', arch: 'arm64', ext: 'pkg' })
    })
  })

  describe('getCacheKey', () => {
    it('includes date for unpinned version', () => {
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })

      const key = getCacheKey(
        'https://downloads.flox.dev/by-env/stable/deb/flox.x86_64-linux.deb'
      )

      expect(key).toMatch(
        /^install-flox\/stable\/latest\/\d{4}-\d{2}-\d{2}\/linux-x64-deb$/
      )
    })

    it('excludes date for pinned version', () => {
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        if (name === 'version') return '1.3.2'
        return ''
      })

      const key = getCacheKey(
        'https://downloads.flox.dev/by-env/stable/deb/flox-1.3.2.x86_64-linux.deb'
      )

      expect(key).toBe('install-flox/stable/1.3.2/linux-x64-deb')
    })

    it('produces different keys for different platforms', () => {
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'nightly'
        return ''
      })

      const debKey = getCacheKey(
        'https://downloads.flox.dev/by-env/nightly/deb/flox.x86_64-linux.deb'
      )
      const rpmKey = getCacheKey(
        'https://downloads.flox.dev/by-env/nightly/rpm/flox.x86_64-linux.rpm'
      )

      expect(debKey).not.toBe(rpmKey)
      expect(debKey).toContain('linux-x64-deb')
      expect(rpmKey).toContain('linux-x64-rpm')
    })
  })

  describe('getRestoreKeys', () => {
    it('returns prefix-based fallback keys', () => {
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })

      const keys = getRestoreKeys(
        'https://downloads.flox.dev/by-env/stable/deb/flox.x86_64-linux.deb'
      )

      expect(keys).toEqual([
        'install-flox/stable/latest/',
        'install-flox/stable/'
      ])
    })
  })

  describe('getCachePath', () => {
    const originalEnv = process.env

    afterEach(() => {
      process.env = originalEnv
    })

    it('uses RUNNER_TEMP when available', () => {
      process.env = { ...originalEnv, RUNNER_TEMP: '/runner/temp' }
      expect(getCachePath()).toBe('/runner/temp/flox-package-cache')
    })

    it('falls back to /tmp when RUNNER_TEMP is not set', () => {
      process.env = { ...originalEnv }
      delete process.env.RUNNER_TEMP
      expect(getCachePath()).toBe('/tmp/flox-package-cache')
    })
  })

  describe('restorePackage', () => {
    it('returns path on cache hit', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      cache.restoreCache.mockResolvedValue(
        'install-flox/stable/latest/2026-02-24/linux-x64-deb'
      )

      const result = await restorePackage(
        'https://downloads.flox.dev/by-env/stable/deb/flox.x86_64-linux.deb'
      )

      expect(result).toBeTruthy()
      expect(cache.restoreCache).toHaveBeenCalled()
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache hit')
      )
    })

    it('returns null on cache miss', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      cache.restoreCache.mockResolvedValue(undefined)

      const result = await restorePackage(
        'https://downloads.flox.dev/by-env/stable/deb/flox.x86_64-linux.deb'
      )

      expect(result).toBeNull()
      expect(core.info).toHaveBeenCalledWith('Cache miss')
    })

    it('logs warning and returns null on error', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      cache.restoreCache.mockRejectedValue(new Error('Network error'))

      const result = await restorePackage(
        'https://downloads.flox.dev/by-env/stable/deb/flox.x86_64-linux.deb'
      )

      expect(result).toBeNull()
      expect(core.warning).toHaveBeenCalledWith(
        'Cache restore failed: Network error'
      )
    })
  })

  describe('savePackage', () => {
    it('saves cache and logs success', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      cache.saveCache.mockResolvedValue(1)

      await savePackage(
        '/tmp/flox-package-cache',
        'https://downloads.flox.dev/by-env/stable/deb/flox.x86_64-linux.deb'
      )

      expect(cache.saveCache).toHaveBeenCalled()
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Package cached with key')
      )
    })

    it('logs warning on error without throwing', async () => {
      core.getInput.mockImplementation(name => {
        if (name === 'channel') return 'stable'
        return ''
      })
      cache.saveCache.mockRejectedValue(new Error('Cache quota exceeded'))

      await savePackage(
        '/tmp/flox-package-cache',
        'https://downloads.flox.dev/by-env/stable/deb/flox.x86_64-linux.deb'
      )

      expect(core.warning).toHaveBeenCalledWith(
        'Cache save failed: Cache quota exceeded'
      )
    })
  })
})
