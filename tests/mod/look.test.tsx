import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const OPEN = [
  'T-01 doing S · needs: — · files: src/a.js · Count words',
  'T-02 todo ready S · needs: — · files: src/b.js · Missing file error',
  'open 2 · ready 1 · done 1 · total 3',
].join('\n')

const PROPS = { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns: 120, scroll: { offset: 0, bodyRows: 8 } }

function project(on: On, isOurs = true) {
  mock.store(on)
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine'] }))
  on('session.cwd', () => ({ value: '/p' }))
  on('fs.exists', (_$, e) => ({ value: isOurs && e.path === '/p/tasks/PLAN.md' }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Build T-01', type: 'ck-code-lite:task-builder', status: 'running' }] }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: OPEN, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('ui.toast', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))
}

const TURN = { turnId: 't1', reason: 'answer', answer: '', durationMs: 1, isAborted: false } as const

test('a search row draws the flat search glyph, its pattern and its state', async ($, on) => {
  const clock = mock.clock(on)
  project(on)
  await $.turn.complete(TURN)
  await clock.advance(100)
  const props = { tool_use_id: 'u1', tool: 'Grep', input: { pattern: 'isLite', path: '/p/hooks' }, isRunning: false, isErrored: false, isInterrupted: false, output: { numFiles: 4 } }
  const ui = await $.ui.mount({ plugin: 'ck-code-lite', surface: 'terminal', component: 'ToolUse', props: props as never })
  expect(await ui.find({ text: '⌕' })).toBeDefined()
  expect(await ui.find({ text: /"isLite" · hooks/ })).toBeDefined()
  expect(await ui.find({ text: '4 files' })).toBeDefined()
  await ui.unmount()
})

test('outside a lite project the engine draws its own rows', async ($, on) => {
  const clock = mock.clock(on)
  project(on, false)
  await $.turn.complete(TURN)
  await clock.advance(100)
  const props = { tool_use_id: 'u1', tool: 'Grep', input: { pattern: 'x' }, isRunning: true, isErrored: false, isInterrupted: false }
  const ui = await $.ui.mount({ plugin: 'ck-code-lite', surface: 'terminal', component: 'ToolUse', props: props as never })
  expect(await ui.find({ text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test("the band's action row folds after a few seconds; the progress line stays", async ($, on) => {
  const clock = mock.clock(on)
  project(on)
  await $.turn.complete(TURN)
  await clock.advance(100)
  const ui = await $.ui.mount({ plugin: 'ck-code-lite', surface: 'terminal', component: 'AbovePrompt', props: PROPS as never })
  expect(await ui.find({ text: /→ \/ck-code-lite:build T-01/ })).toBeDefined()
  await clock.advance(8000)
  await ui.advance(0)
  expect(await ui.find({ text: /→ \/ck-code-lite:build/ })).toBe(undefined)
  expect(await ui.find({ text: /1\/3 33%/ })).toBeDefined()
  expect(await ui.find({ text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test("a builder's own task list shows on the band", async ($, on) => {
  const clock = mock.clock(on)
  project(on)
  let next = 0
  on('tool.call', (_$, e) => (e.tool === 'TaskCreate' ? { result: { task: { id: String(++next), subject: e.subject } } } : { result: { success: true } }))
  await $.turn.complete(TURN)
  await clock.advance(100)
  await $.tool.call({ tool: 'TaskCreate', subject: 'Write the failing test', description: 'x', activeForm: 'Writing the failing test', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress', agentId: 'a1' } as never)
  const ui = await $.ui.mount({ plugin: 'ck-code-lite', surface: 'terminal', component: 'AbovePrompt', props: { ...PROPS, isWorking: true } as never })
  expect(await ui.find({ text: /◈ Build T-01 ▱ 0\/1 ▸ Writing the failing test/ })).toBeDefined()
  await ui.unmount()
})
