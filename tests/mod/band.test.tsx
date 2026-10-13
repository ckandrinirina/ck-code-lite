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
    expect(await ui.find({ text: /doing T-01 Count words · 2 open · 0 ready · 1\/3 done/ })).toBeDefined()
    await ui.press({ key: 'fill' })
    await ui.unmount()
  }
  expect(filled).toEqual(['/ck-code-lite:build T-01 ', '/ck-code-lite:build T-01 '])
})
