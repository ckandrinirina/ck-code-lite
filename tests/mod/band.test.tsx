import { expect, mock, test } from 'claude-code/testing'

const OPEN = [
  'T-01 doing S · needs: — · files: src/a.js · Count words',
  'T-02 todo wait(T-01) S · needs: T-01 · files: src/b.js · Missing file error',
  'open 2 · ready 0 · done 1 · total 3',
].join('\n')

const RUN = {
  command: 'lite-band',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
} as const

const PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 120, scroll: { offset: 0, bodyRows: 4 } }

test('the band shows the task in progress and fills its build command', async ($, on) => {
  const filled: string[] = []
  mock.store(on)
  // What the mods after ck-code-lite draw in the band, such as ck-tools' plan-limit rows.
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['below the band'] }))
  on('session.cwd', () => ({ value: '/p' }))
  on('fs.exists', (_$, e) => ({ value: e.path === '/p/tasks/PLAN.md' }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: OPEN, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('prompt.fill', (_$, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  await $.command.run(RUN)
  await $.command.run(RUN)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'ck-code-lite', surface, component: 'AbovePrompt', props: PROPS as never })
    expect(await ui.find({ text: /T-01 Count words/ })).toBeDefined()
    expect(await ui.find({ text: /1\/3 33%/ })).toBeDefined()
    expect(await ui.find({ text: /2 open · 0 ready/ })).toBeDefined()
    expect(await ui.find({ text: 'below the band' })).toBeDefined()
    await ui.press({ key: 'fill' })
    await ui.unmount()
  }
  expect(filled).toEqual(['/ck-code-lite:build T-01 ', '/ck-code-lite:build T-01 '])
})

test('Hide persists the hidden band and stops the refresh', async ($, on) => {
  let runs = 0
  const saved: Record<string, unknown> = {}
  // What the mods after ck-code-lite draw in the band, such as ck-tools' plan-limit rows.
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['below the band'] }))
  const clock = mock.clock(on)
  on('turn.complete', () => ({ text: 'ok' }))
  on('store.get', (_$, e) => ({ value: saved[e.key] }))
  on('store.set', (_$, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  on('session.cwd', () => ({ value: '/p' }))
  on('fs.exists', (_$, e) => ({ value: e.path === '/p/tasks/PLAN.md' }))
  on('process.run', () => {
    runs += 1
    return { value: { exitCode: 0, stdout: OPEN, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  await $.command.run(RUN)
  await $.command.run(RUN)
  const ui = await $.ui.mount({ plugin: 'ck-code-lite', surface: 'terminal', component: 'AbovePrompt', props: PROPS as never })
  await ui.press({ key: 'hide' })
  await ui.unmount()
  expect(saved.bandHidden).toBe(true)
  const before = runs
  await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1' })
  await clock.advance(100)
  expect(runs).toBe(before)
})

test('a task finished between two refreshes raises a toast', async ($, on) => {
  const toasts: string[] = []
  let stdout = OPEN
  mock.store(on)
  on('session.cwd', () => ({ value: '/p' }))
  on('fs.exists', (_$, e) => ({ value: e.path === '/p/tasks/PLAN.md' }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  // Hide then show: each show refreshes the band.
  await $.command.run(RUN)
  await $.command.run(RUN)
  stdout = ['T-02 todo READY S · needs: T-01 · files: src/b.js · Missing file error', 'open 1 · ready 1 · done 2 · total 3'].join('\n')
  await $.command.run(RUN)
  await $.command.run(RUN)
  expect(toasts).toEqual(['ck-code-lite: ✨ T-01 done — 2/3 (66%)'])
})
