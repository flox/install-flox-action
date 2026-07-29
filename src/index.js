const core = require('@actions/core')

const main = require('./main')
const cleanup = require('./cleanup')

// The post step runs this same bundle, so state recorded during the main step
// is what tells the two phases apart.
if (process.env['STATE_isPost']) {
  cleanup.run()
} else {
  core.saveState('isPost', 'true')
  main.run()
}
