const core = require('@actions/core')

const main = require('./main')
const post = require('./post')

const IsPost = core.getState('isPost')

console.log(IsPost)

if (!IsPost) {
  core.saveState('isPost', 'true')
  main.run()
} else {
  post.run()
}
