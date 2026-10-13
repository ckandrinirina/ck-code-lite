import { describe, expect, test } from 'claude-code/testing'

import {
  celebration,
  isWaveRunOver,
  percent,
  progressBar,
  countsLine,
  isLiteLayout,
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

describe('the lite-project rule', () => {
  test('all 16 marker combinations', async () => {
    // [stamp, plan, architectureDir, architectureDoc] → lite?
    const table: [boolean, boolean, boolean, boolean, boolean][] = [
      [false, false, false, false, false],
      [false, false, false, true, true],
      [false, false, true, false, false],
      [false, false, true, true, false],
      [false, true, false, false, true],
      [false, true, false, true, true],
      [false, true, true, false, true],
      [false, true, true, true, true],
      [true, false, false, false, false],
      [true, false, false, true, false],
      [true, false, true, false, false],
      [true, false, true, true, false],
      [true, true, false, false, false],
      [true, true, false, true, false],
      [true, true, true, false, false],
      [true, true, true, true, false],
    ]
    for (const [stamp, plan, architectureDir, architectureDoc, lite] of table)
      expect(isLiteLayout({ stamp, plan, architectureDir, architectureDoc })).toBe(lite)
  })
})

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
    expect(planWriteReason('/p/tasks/PLAN.md')).toContain('A CORRUPT task that `ck-lite check` names is repaired by the user')
    expect(planWriteReason('/p/docs/ARCHITECTURE.md')).toBe(undefined)
    expect(planWriteReason('/p/notes/PLAN.md')).toBe(undefined)
  })
})

describe('ck-lite open', () => {
  test('tasks, states, titles and the summary parse', async () => {
    const plan = parseOpen(OPEN)!
    expect(plan.tasks.map(t => t.state)).toEqual(['doing', 'todo wait(T-01)', 'todo READY'])
    expect(plan.tasks[2]?.title).toBe('Help text')
    expect(countsLine(plan)).toBe('3 open · 1 ready')
  })
  test('a title holding " · " is kept whole', async () => {
    const plan = parseOpen('T-01 todo READY S · needs: — · files: src/a.js · Count words · fast path\nopen 1 · ready 1 · done 0 · total 1')!
    expect(plan.tasks[0]?.title).toBe('Count words · fast path')
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

describe('compaction after a wave run', () => {
  test('a clean wave run of two or more builders is over', async () => {
    expect(isWaveRunOver({ reason: 'answer', builders: 3, inProgress: 0 })).toBe(true)
  })
  test('one builder, an interrupt, an error or a held task keeps the session', async () => {
    expect(isWaveRunOver({ reason: 'answer', builders: 1, inProgress: 0 })).toBe(false)
    expect(isWaveRunOver({ reason: 'aborted', builders: 3, inProgress: 0 })).toBe(false)
    expect(isWaveRunOver({ reason: 'error', builders: 3, inProgress: 0 })).toBe(false)
    expect(isWaveRunOver({ reason: 'answer', builders: 3, inProgress: 1 })).toBe(false)
  })
})

describe('progress and celebrations', () => {
  test('the bar fills in proportion and never overflows', async () => {
    expect(progressBar(0, 0)).toBe('▱▱▱▱▱▱▱▱▱▱')
    expect(progressBar(3, 7)).toBe('▰▰▰▰▱▱▱▱▱▱')
    expect(progressBar(9, 7)).toBe('▰▰▰▰▰▰▰▰▰▰')
    expect(percent(199, 200)).toBe(99)
  })
  test('no cheer on the first look or when nothing new is done', async () => {
    const now = { done: 3, total: 7, open: ['T-04'] }
    expect(celebration(undefined, now, 'tasks')).toBe(undefined)
    expect(celebration(now, now, 'tasks')).toBe(undefined)
  })
  test('a finished task is named, a finished plan is cheered', async () => {
    const before = { done: 3, total: 7, open: ['T-04', 'T-05'] }
    expect(celebration(before, { done: 4, total: 7, open: ['T-05'] }, 'tasks')).toBe('✨ T-04 done — 4/7 (57%)')
    expect(celebration(before, { done: 7, total: 7, open: [] }, 'tasks')).toBe('🎉 Plan complete — 7/7 tasks done!')
  })
})
