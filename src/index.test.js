jest.mock('@actions/core')
jest.mock('./main', () => ({
  run: jest.fn()
}))
jest.mock('./cleanup', () => ({
  run: jest.fn()
}))

describe('index', () => {
  beforeEach(() => {
    jest.resetModules()
    delete process.env['STATE_isPost']
  })

  it('calls main.run when imported', async () => {
    require('./index')

    expect(require('./main').run).toHaveBeenCalled()
    // Without this the post step would find no state and run main again.
    expect(require('@actions/core').saveState).toHaveBeenCalledWith(
      'isPost',
      'true'
    )
  })

  it('calls cleanup.run in the post step', async () => {
    process.env['STATE_isPost'] = 'true'

    require('./index')

    expect(require('./cleanup').run).toHaveBeenCalled()
  })
})
