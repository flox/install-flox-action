const core = require('@actions/core')
const exec = require('@actions/exec')
const fs = require('fs')

jest.mock('@actions/core')
jest.mock('@actions/exec')
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}))

const cleanup = require('./cleanup')

const MINE = 'install-flox-action-99-1-aaaabbbb.conf'
const THEIRS = 'install-flox-action-99-1-ccccdddd.conf'

const nixConfWrite = () =>
  exec.exec.mock.calls
    .filter(([cmd, args]) => cmd === 'sudo' && args[0] === 'tee')
    .find(([, args]) => args[1] === '/etc/nix/nix.conf')?.[2]
    .input.toString()

describe('cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    exec.exec.mockResolvedValue(0)
    core.getState.mockReturnValue(MINE)
  })

  // The token GitHub grants a job is written to a root-owned but
  // world-readable file. On a runner whose disk survives the job, anything
  // that runs next can read it until it expires.
  it('removes the file holding this job’s token', async () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(`!include ${MINE}\n`)

    await cleanup.run()

    expect(exec.exec).toHaveBeenCalledWith('sudo', [
      'rm',
      '-f',
      `/etc/nix/${MINE}`
    ])
  })

  it('removes only its own include line from nix.conf', async () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(
      `# existing\n!include ${MINE}\n!include ${THEIRS}\ninclude flox.conf\n`
    )

    await cleanup.run()

    const written = nixConfWrite()
    expect(written).not.toContain(MINE)
    expect(written).toContain(THEIRS)
    expect(written).toContain('include flox.conf')
  })

  // A machine can run several jobs at once. Taking a file another job is still
  // using would strand it with the failure this action exists to fix.
  it('leaves a concurrent job’s file alone', async () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(`!include ${THEIRS}\n`)
    core.getState.mockReturnValue('')

    await cleanup.run()

    expect(exec.exec).not.toHaveBeenCalledWith('sudo', [
      'rm',
      '-f',
      `/etc/nix/${THEIRS}`
    ])
    expect(nixConfWrite()).toBeUndefined()
  })

  // A job killed before its post step runs leaves its line behind. Its file is
  // gone, which is how a dead line is told from a live one.
  it('prunes an include line whose file no longer exists', async () => {
    fs.existsSync.mockImplementation(p => p !== `/etc/nix/${THEIRS}`)
    fs.readFileSync.mockReturnValue(`!include ${MINE}\n!include ${THEIRS}\n`)

    await cleanup.run()

    const written = nixConfWrite()
    expect(written).not.toContain(THEIRS)
    expect(written).not.toContain(MINE)
  })

  it('does nothing when the action wrote no config', async () => {
    fs.existsSync.mockReturnValue(false)
    fs.readFileSync.mockReturnValue('# existing\n')
    core.getState.mockReturnValue('')

    await cleanup.run()

    expect(exec.exec).not.toHaveBeenCalled()
  })

  // The include line sits in the middle of nix.conf, so the pattern has to
  // match a line rather than the whole file.
  it('finds an include line that is not the first line of nix.conf', async () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(
      `build-users-group =\ninclude flox.conf\n!include ${MINE}\n`
    )

    await cleanup.run()

    expect(exec.exec).toHaveBeenCalledWith('sudo', [
      'rm',
      '-f',
      `/etc/nix/${MINE}`
    ])
    expect(nixConfWrite()).not.toContain(MINE)
  })

  // A post step that fails would mark an otherwise green job as failed.
  it('warns rather than failing the job when removal fails', async () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(`!include ${MINE}\n`)
    exec.exec.mockRejectedValue(new Error('permission denied'))

    await cleanup.run()

    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('permission denied')
    )
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  describe('FloxHub logout', () => {
    const LOGOUT = ['auth', 'logout']
    const isLogout = ([cmd, args]) =>
      cmd === 'flox' && args[0] === LOGOUT[0] && args[1] === LOGOUT[1]

    function state(values) {
      core.getState.mockImplementation(name => values[name] ?? '')
    }

    beforeEach(() => {
      fs.existsSync.mockReturnValue(false)
      fs.readFileSync.mockReturnValue('# existing\n')
    })

    // On a runner whose disk survives the job, the stored token would
    // authenticate whatever runs next.
    it('logs out when this job logged in', async () => {
      state({ floxhubLogin: 'true' })

      await cleanup.run()

      expect(exec.exec).toHaveBeenCalledWith('flox', LOGOUT)
    })

    it('does not log out when this job did not log in', async () => {
      state({})

      await cleanup.run()

      expect(exec.exec.mock.calls.filter(isLogout)).toHaveLength(0)
    })

    it('warns rather than failing the job when logout fails', async () => {
      state({ floxhubLogin: 'true' })
      exec.exec.mockRejectedValue(new Error('flox: command not found'))

      await cleanup.run()

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('flox: command not found')
      )
      expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('still removes the Nix config when logout fails', async () => {
      state({ floxhubLogin: 'true', confName: MINE })
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(`!include ${MINE}\n`)
      exec.exec.mockImplementation(async cmd => {
        if (cmd === 'flox') throw new Error('logout failed')
        return 0
      })

      await cleanup.run()

      expect(exec.exec).toHaveBeenCalledWith('sudo', [
        'rm',
        '-f',
        `/etc/nix/${MINE}`
      ])
    })
  })
})
