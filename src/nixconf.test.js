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

// These encode Nix's own resolution rules, which decide whether the job's token
// reaches Nix at all. Verified against `nix config show access-tokens`.
describe('readAccessTokens', () => {
  const read = conf => Object.fromEntries(nixconf.readAccessTokens(conf))

  it('finds nothing in a file that configures no tokens', () => {
    expect(read('build-users-group =\nsandbox = relaxed')).toEqual({})
  })

  it('reads several hosts from one line', () => {
    expect(read('access-tokens = github.com=A gitlab.example=B')).toEqual({
      'github.com': 'A',
      'gitlab.example': 'B'
    })
  })

  it('lets a later plain line replace everything set before it', () => {
    expect(
      read('access-tokens = a.com=OLD\naccess-tokens = b.com=NEW')
    ).toEqual({ 'b.com': 'NEW' })
  })

  it('lets an extra- line add a host that is not already set', () => {
    expect(
      read('access-tokens = a.com=A\nextra-access-tokens = b.com=B')
    ).toEqual({ 'a.com': 'A', 'b.com': 'B' })
  })

  // An `extra-` line contributes only hosts that are not already set, so a
  // token on disk outranks one written after it.
  it('does not let an extra- line displace a host already set', () => {
    expect(
      read(
        'access-tokens = github.com=STALE\nextra-access-tokens = github.com=FRESH'
      )
    ).toEqual({ 'github.com': 'STALE' })
  })

  it('ignores entries with no host separator', () => {
    expect(read('access-tokens = junk github.com=A')).toEqual({
      'github.com': 'A'
    })
  })

  it('keeps a token containing an equals sign intact', () => {
    expect(read('access-tokens = github.com=abc=def')).toEqual({
      'github.com': 'abc=def'
    })
  })
})

describe('formatAccessTokens', () => {
  it('round-trips through readAccessTokens', () => {
    const line = 'access-tokens = github.com=A gitlab.example=B'
    const formatted = nixconf.formatAccessTokens(nixconf.readAccessTokens(line))
    expect(formatted).toBe('github.com=A gitlab.example=B')
  })

  it('produces an empty string when there is nothing to write', () => {
    expect(nixconf.formatAccessTokens(new Map())).toBe('')
  })
})
