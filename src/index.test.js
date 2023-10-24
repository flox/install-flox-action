const main = require('./main')
const post = require('./post')

jest.mock('./main', () => ({
  run: jest.fn()
}))
jest.mock('./post', () => ({
  run: jest.fn()
}))

describe('index', () => {
  afterEach(() => {
    delete process.env['STATE_isPost']
    jest.restoreAllMocks()
  })
  it('calls main.run when imported', async () => {
    require('./index')

    expect(main.run).toHaveBeenCalled()
    expect(post.run).not.toHaveBeenCalled()
  })

  //it('calls post.run when imported', async () => {
  //  process.env['STATE_isPost'] = 'true'

  //  require('./index')

  //  expect(main.run).not.toHaveBeenCalled()
  //  expect(post.run).toHaveBeenCalled()
  //})
})
