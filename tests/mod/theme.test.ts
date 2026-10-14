// Kept word for word in ck-code and ck-code-lite, as hooks/mod/theme.ts is.
import { describe, expect, test } from 'claude-code/testing'

import {
  boardLine,
  groupLine,
  pick,
  resultNote,
  stateMark,
  taskCreated,
  taskUpdated,
  todosWritten,
  toolGlyph,
  toolName,
  toolSummary,
} from '../../hooks/mod/theme'

describe('tool rows', () => {
  test('searches share the search glyph; every glyph is flat, one cell, never an emoji', () => {
    for (const t of ['Grep', 'Glob', 'WebSearch', 'ToolSearch']) expect(toolGlyph(t)).toBe('⌕')
    expect(toolGlyph('Read')).toBe('≡')
    expect(toolGlyph('Bash')).toBe('❯')
    expect(toolGlyph('mcp__github__create_issue')).toBe('⌁')
    expect(toolGlyph('SomethingNew')).toBe('•')
    for (const t of ['Grep', 'Read', 'Write', 'Edit', 'Bash', 'WebFetch', 'Agent', 'Skill', 'TaskCreate', 'TaskUpdate', 'TodoWrite'])
      expect(/\p{Extended_Pictographic}/u.test(toolGlyph(t))).toBe(false)
  })

  test('an MCP tool is named by its server and tool', () => {
    expect(toolName('mcp__plugin_context7_context7__query-docs')).toBe('context7_context7 query-docs')
    expect(toolName('Bash')).toBe('Bash')
  })

  test('the summary says what the call is about, paths relative to the project', () => {
    expect(toolSummary('Grep', { pattern: 'isLite', path: '/p/hooks' }, '/p')).toBe('"isLite" · hooks')
    expect(toolSummary('Read', { file_path: '/p/src/a.ts' }, '/p')).toBe('src/a.ts')
    expect(toolSummary('Bash', { command: 'npm test', description: 'Run the tests' })).toBe('Run the tests')
    expect(toolSummary('Agent', { subagent_type: 'ck-code:story-implementer', description: 'Build 03-02' })).toBe('story-implementer · Build 03-02')
    expect(toolSummary('TaskUpdate', { taskId: '3', status: 'completed' })).toBe('completed')
    expect(toolSummary('WebFetch', { url: 'https://example.com/a' })).toBe('example.com/a')
    expect(toolSummary('Bash', { command: 'x'.repeat(200) }).length).toBe(72)
  })

  test('reads and searches note their result; the state mark follows the call', () => {
    expect(resultNote('Read', { type: 'text', file: { numLines: 120 } })).toBe('120 lines')
    expect(resultNote('Glob', { numFiles: 1 })).toBe('1 file')
    expect(resultNote('Bash', { stdout: 'x' })).toBe('')
    expect(stateMark({ isRunning: true, isErrored: false }).mark).toBe('◌')
    expect(stateMark({ isRunning: false, isErrored: true }).mark).toBe('✗')
    expect(stateMark({ isRunning: false, isErrored: false, isInterrupted: true }).mark).toBe('◼')
    expect(stateMark({ isRunning: false, isErrored: false }).mark).toBe('✓')
  })

  test('a group counts each glyph in first-use order', () => {
    expect(groupLine([{ tool: 'Read' }, { tool: 'Grep' }, { tool: 'Read' }, { tool: 'Glob' }, { tool: 'Bash' }])).toBe('≡ 2 · ⌕ 2 · ❯ 1')
  })

  test('the word pick is stable for a seed', () => {
    const list = ['a', 'b', 'c']
    expect(pick(list, 'Sauteing')).toBe(pick(list, 'Sauteing'))
    expect(list).toContain(pick(list, 'Baked'))
  })
})

describe('task board', () => {
  test("a builder's tasks are created, started, finished and deleted", () => {
    let b = taskCreated([], 'a1', '03-02', { id: '1', subject: 'Write the failing test', activeForm: 'Writing the failing test' })
    b = taskCreated(b, 'a1', '03-02', { id: '2', subject: 'Make it pass' })
    b = taskCreated(b, 'a2', '03-03', { id: '1', subject: 'Other' })
    expect(b.length).toBe(2)
    b = taskUpdated(b, 'a1', { taskId: '1', status: 'in_progress' })
    expect(boardLine(b[0]!)).toBe('03-02 ▱▱ 0/2 ▸ Writing the failing test')
    b = taskUpdated(b, 'a1', { taskId: '1', status: 'completed' })
    b = taskUpdated(b, 'a1', { taskId: '2', status: 'completed' })
    expect(boardLine(b[0]!)).toBe('03-02 ▰▰ 2/2 ✓ done')
    b = taskUpdated(b, 'a1', { taskId: '2', status: 'deleted' })
    expect(b[0]!.tasks.length).toBe(1)
    expect(b[1]!.tasks.length).toBe(1)
  })

  test('TodoWrite replaces the whole list, and an empty one leaves the board', () => {
    let b = todosWritten([], 'a1', 'T-03', [
      { content: 'Test', status: 'completed', activeForm: 'Testing' },
      { content: 'Code', status: 'in_progress', activeForm: 'Coding' },
    ])
    expect(boardLine(b[0]!)).toBe('T-03 ▰▱ 1/2 ▸ Coding')
    b = todosWritten(b, 'a1', 'T-03', [])
    expect(b).toEqual([])
  })
})
