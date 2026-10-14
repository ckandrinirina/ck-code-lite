// Kept word for word in both plugins (tests/mod/cost-guard.test.ts), like the guard itself.
import { describe, expect, test } from 'claude-code/testing'

import { FABLE_APPROVED, cappedEffort, guardDispatch } from '../../hooks/mod/logic'

describe('the cost guard', () => {
  test('effort above high is capped; high and below, and numeric budgets, are kept', async () => {
    expect(cappedEffort('xhigh')).toBe('high')
    expect(cappedEffort('max')).toBe('high')
    for (const e of ['low', 'medium', 'high', undefined, 4000]) expect(cappedEffort(e)).toBe(e)
  })
  test('a Fable dispatch is denied unless the user approved it', async () => {
    expect(guardDispatch({ model: 'fable', prompt: 'scan the repo' })).toHaveProperty('deny')
    expect(guardDispatch({ model: 'fable', prompt: `${FABLE_APPROVED}\nscan the repo` })).toBeUndefined()
  })
  test('built-in types get a cheap model when none is named; plugin agents are left alone', async () => {
    expect(guardDispatch({ subagent_type: 'Explore', prompt: 'x' })).toEqual({ model: 'haiku' })
    expect(guardDispatch({ prompt: 'x' })).toEqual({ model: 'sonnet' })
    expect(guardDispatch({ subagent_type: 'general-purpose', model: 'opus', prompt: 'x' })).toBeUndefined()
    expect(guardDispatch({ subagent_type: 'ck-code:story-implementer', prompt: 'x' })).toBeUndefined()
    expect(guardDispatch({ subagent_type: 'fork', prompt: 'x' })).toBeUndefined()
  })
  test('a dispatch effort above high is capped', async () => {
    expect(guardDispatch({ subagent_type: 'Explore', model: 'haiku', effort: 'max', prompt: 'x' })).toEqual({ effort: 'high' })
  })
})

test('the guard rewrites an Explore dispatch and refuses an unapproved Fable one', async ($, on) => {
  const seen: unknown[] = []
  on('session.cwd', () => ({ value: '/p' }))
  on('fs.exists', () => ({ value: false }))
  on('tool.call', (_$, e) => {
    seen.push(e)
    return { result: 'dispatched' }
  })
  await $.tool.call({ tool: 'Agent', description: 'find x', prompt: 'find x', subagent_type: 'Explore', effort: 'xhigh' })
  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'high' })
  const r = await $.tool.call({ tool: 'Agent', description: 'big', prompt: 'think hard', model: 'fable' })
  expect(JSON.stringify(r)).toContain('AskUserQuestion')
  expect(seen).toHaveLength(1)
})
