import { describe, expect, test } from 'claude-code/testing'

import {
  countsLine,
  isRoutable,
  nextCommand,
  parseOpen,
  planWriteReason,
  stripRouting,
  taskSuggestions,
} from '../../hooks/mod/logic'

const OPEN = [
  'T-01 doing S · needs: — · files: src/a.js · Count words',
  'T-02 todo wait(T-01) S · needs: T-01 · files: src/b.js · Missing file error',
  'T-03 todo READY M · needs: — · files: — · Help text',
  'open 3 · ready 1 · done 4 · total 7',
].join('\n')

describe('routing', () => {
  test('free text from the person is routed; slash commands, replies, notifications are not', async () => {
    expect(isRoutable('add a dark mode toggle to settings', 'composer')).toBe(true)
    expect(isRoutable('/ck-code-lite:build T-03', 'composer')).toBe(false)
    expect(isRoutable('yes', 'composer')).toBe(false)
    expect(isRoutable('a background task finished its work', 'task-notification')).toBe(false)
    expect(stripRouting('<!-- note -->\nrow')).toBe('row')
  })
})

describe('PLAN.md guard', () => {
  test('only tasks/PLAN.md is guarded', async () => {
    expect(planWriteReason('/p/tasks/PLAN.md')).toContain('ck-lite set')
    expect(planWriteReason('tasks/PLAN.md')).toContain('ck-lite')
    expect(planWriteReason('/p/docs/ARCHITECTURE.md')).toBe(undefined)
    expect(planWriteReason('/p/notes/PLAN.md')).toBe(undefined)
  })
})

describe('ck-lite open', () => {
  test('tasks, states, titles and the summary parse', async () => {
    const plan = parseOpen(OPEN)!
    expect(plan.tasks.map(t => t.state)).toEqual(['doing', 'todo wait(T-01)', 'todo READY'])
    expect(plan.tasks[2]?.title).toBe('Help text')
    expect(countsLine(plan)).toBe('3 open · 1 ready · 4/7 done')
  })
  test('the task in progress comes before a ready one', async () => {
    expect(nextCommand(parseOpen(OPEN)!)).toBe('/ck-code-lite:build T-01')
    expect(nextCommand(parseOpen('T-03 todo READY M · x · Help\nopen 1 · ready 1 · done 0 · total 1')!)).toBe(
      '/ck-code-lite:build T-03',
    )
  })
  test('an empty plan points at start; a fully waiting one points nowhere', async () => {
    expect(nextCommand(parseOpen('open 0 · ready 0 · done 2 · total 2')!)).toBe('/ck-code-lite:start')
    expect(nextCommand(parseOpen('T-02 blocked S · x · y\nopen 1 · ready 0 · done 0 · total 1')!)).toBe('')
  })
  test('no summary line is no plan', async () => {
    expect(parseOpen('ck-lite: no tasks/PLAN.md')).toBe(null)
  })
  test('T- completes open task ids', async () => {
    const s = taskSuggestions('T-0', parseOpen(OPEN)!.tasks)
    expect(s.map(x => x.text)).toEqual(['T-01', 'T-02', 'T-03'])
    expect(taskSuggestions('X-0', parseOpen(OPEN)!.tasks)).toEqual([])
  })
})
