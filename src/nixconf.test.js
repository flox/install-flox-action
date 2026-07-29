const nixconf = require('./nixconf')

describe('tidy', () => {
  // Every write removes a line and appends another. If tidy were not
  // idempotent, nix.conf would gain blank lines on a machine for as long as it
  // kept running jobs, which is the unbounded growth this design avoids.
  it('is idempotent, so repeated writes cannot accumulate', () => {
    const once = nixconf.tidy('a\n\n\n\nb\n\n')
    expect(nixconf.tidy(once)).toBe(once)
  })

  it('survives the trailing newline a heredoc adds, run after run', () => {
    let conf = '\nbuild-users-group =\ninclude flox.conf\n'
    const seen = new Set()
    for (let i = 0; i < 20; i++) {
      // What writeAsRoot produces: tidied content plus the heredoc's newline.
      conf = `${nixconf.tidy(conf)}\n`
      seen.add(conf)
    }
    expect(seen.size).toBe(1)
    expect(conf.split('\n').length).toBeLessThan(7)
  })

  it('collapses runs of blank lines but keeps one as a separator', () => {
    expect(nixconf.tidy('a\n\n\n\n\nb')).toBe('a\n\nb\n')
  })
})

describe('pruneIncludes', () => {
  it('keeps lines it does not recognize', () => {
    const conf = 'build-users-group =\ninclude flox.conf\nsandbox = relaxed'
    expect(nixconf.pruneIncludes(conf, null)).toBe(conf)
  })
})
