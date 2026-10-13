import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

function project(on: On, files: string[]) {
  on('session.cwd', () => ({ value: '/p' }))
  on('fs.exists', (_$, e) => ({ value: files.includes(e.path) }))
}
const LITE = ['/p/tasks/PLAN.md']
const CODE = ['/p/tasks/PLAN.md', '/p/docs/architecture']

test('a hand write of tasks/PLAN.md is refused in a lite project', async ($, on) => {
  project(on, LITE)
  on('tool.call', () => ({ result: 'written' }))
  const r = await $.tool.call({ tool: 'Edit', file_path: '/p/tasks/PLAN.md', old_string: 'a', new_string: 'b' })
  expect(JSON.stringify(r)).toContain('ck-lite')
})

test('the same write runs in a full ck-code project, which owns its own rules', async ($, on) => {
  project(on, CODE)
  on('tool.call', () => ({ result: 'written' }))
  const r = await $.tool.call({ tool: 'Write', file_path: '/p/tasks/PLAN.md', content: 'x' })
  expect(JSON.stringify(r)).toContain('written')
})

test('commit attribution is empty in a lite project only', async ($, on) => {
  project(on, LITE)
  on('attribution.text', (_$, e) => ({ text: e.text }))
  expect((await $.attribution.text({ kind: 'pr', text: 'Generated with Claude Code' })).text).toBe('')
})

test('a free-text prompt gets the lite routing table', async ($, on) => {
  project(on, LITE)
  on('fs.read', () => ({ value: '<!-- x -->\nck-code-lite router' }))
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  const r = await $.prompt.submit({ text: 'add a dark mode toggle please', wait: false, origin: { kind: 'composer' } })
  expect(JSON.stringify(r.context)).toContain('ck-code-lite router')
})

test('no routing outside a lite project', async ($, on) => {
  project(on, CODE)
  on('fs.read', () => ({ value: 'ck-code-lite router' }))
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  const r = await $.prompt.submit({ text: 'add a dark mode toggle please', wait: false, origin: { kind: 'composer' } })
  expect(r.context ?? []).toEqual([])
})
