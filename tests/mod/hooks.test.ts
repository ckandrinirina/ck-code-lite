import { expect, mock, test } from "claude-code/testing";
import type { On } from "claude-code";

function project(on: On, files: string[], cwd = "/p") {
  on("session.cwd", () => ({ value: cwd }));
  on("fs.exists", (_$, e) => ({ value: files.includes(e.path) }));
}
const LITE = ["/p/.git", "/p/tasks", "/p/tasks/PLAN.md"];
// Stamped: ck-code's, even with a lite plan left in it.
const CODE = [
  "/p/.git",
  "/p/tasks",
  "/p/docs",
  "/p/tasks/VERSION.md",
  "/p/tasks/PLAN.md",
  "/p/docs/architecture",
];

test("a hand write of tasks/PLAN.md is refused in a lite project", async ($, on) => {
  project(on, LITE);
  on("tool.call", () => ({ result: "written" }));
  const r = await $.tool.call({
    tool: "Edit",
    file_path: "/p/tasks/PLAN.md",
    old_string: "a",
    new_string: "b",
  });
  expect(JSON.stringify(r)).toContain("ck-lite");
});

test("a half-migrated project (a lite plan beside an unstamped docs/architecture/) stays lite", async ($, on) => {
  project(on, [
    "/p/.git",
    "/p/tasks",
    "/p/docs",
    "/p/tasks/PLAN.md",
    "/p/docs/architecture",
  ]);
  on("tool.call", () => ({ result: "written" }));
  const r = await $.tool.call({
    tool: "Write",
    file_path: "/p/tasks/PLAN.md",
    content: "x",
  });
  expect(JSON.stringify(r)).toContain("ck-lite");
});

test("a shell cd into a subfolder keeps the guard on the project root, and only its plans", async ($, on) => {
  project(on, LITE, "/p/src/lib");
  on("tool.call", () => ({ result: "written" }));
  const plan = await $.tool.call({
    tool: "Write",
    file_path: "/p/tasks/PLAN.md",
    content: "x",
  });
  expect(JSON.stringify(plan)).toContain("ck-lite");
  const worktree = await $.tool.call({
    tool: "Edit",
    file_path: "/p/.claude/worktrees/t-03/tasks/PLAN.md",
    old_string: "a",
    new_string: "b",
  });
  expect(JSON.stringify(worktree)).toContain("ck-lite");
  const other = await $.tool.call({
    tool: "Write",
    file_path: "/elsewhere/tasks/PLAN.md",
    content: "x",
  });
  expect(JSON.stringify(other)).toContain("written");
});

test("a /lite- command whose ck-lite cannot run answers instead of throwing", async ($, on) => {
  project(on, LITE);
  on("process.run", () => {
    throw new Error("spawn failed");
  });
  const r = await $.command.run({
    command: "lite-status",
    args: "",
    origin: { kind: "composer" },
    presentation: { isFullscreen: true, columns: 160 },
  });
  expect(JSON.stringify(r)).toContain("ck-lite could not run:");
});

test("the same write runs in a full ck-code project, which owns its own rules", async ($, on) => {
  project(on, CODE);
  on("tool.call", () => ({ result: "written" }));
  const r = await $.tool.call({
    tool: "Write",
    file_path: "/p/tasks/PLAN.md",
    content: "x",
  });
  expect(JSON.stringify(r)).toContain("written");
});

test("commit attribution is empty in a lite project only", async ($, on) => {
  project(on, LITE);
  on("attribution.text", (_$, e) => ({ text: e.text }));
  expect(
    (
      await $.attribution.text({
        kind: "pr",
        text: "Generated with Claude Code",
      })
    ).text,
  ).toBe("");
});

test("a free-text prompt gets the lite routing table", async ($, on) => {
  project(on, LITE);
  on("fs.read", () => ({ value: "<!-- x -->\nck-code-lite router" }));
  on("prompt.submit", (_$, e) => ({ text: e.text, context: e.context }));
  const r = await $.prompt.submit({
    text: "add a dark mode toggle please",
    wait: false,
    origin: { kind: "composer" },
  });
  expect(JSON.stringify(r.context)).toContain("ck-code-lite router");
});

test("no routing outside a lite project", async ($, on) => {
  project(on, CODE);
  on("fs.read", () => ({ value: "ck-code-lite router" }));
  on("prompt.submit", (_$, e) => ({ text: e.text, context: e.context }));
  const r = await $.prompt.submit({
    text: "add a dark mode toggle please",
    wait: false,
    origin: { kind: "composer" },
  });
  expect(r.context ?? []).toEqual([]);
});

test("compaction waits for background builders, then runs once", async ($, on) => {
  const clock = mock.clock(on);
  mock.store(on);
  let doing = true;
  let compacted = 0;
  project(on, LITE);
  on("agent.list", () => ({ value: [] }));
  on("process.run", () => {
    const stdout = doing
      ? "T-01 doing S · needs: — · files: src/a.js · Count words\nopen 1 · ready 0 · done 1 · total 2"
      : "open 0 · ready 0 · done 2 · total 2";
    return { value: { exitCode: 0, stdout, stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
  });
  on("ui.toast", () => ({ value: undefined }));
  on("session.compact", () => {
    compacted += 1;
    return { skip: "the test keeps its messages" };
  });
  on("tool.call", () => ({ result: "dispatched" }));
  on("turn.start", (_$, e) => ({ turnId: e.turnId }));
  on("turn.complete", () => ({ text: "" }));
  const end = (turnId: string) =>
    $.turn.complete({ turnId, reason: "answer", answer: "", durationMs: 1, isAborted: false });

  // Turn 1 dispatches two background builders and ends with a task still doing.
  await $.turn.start({ text: "build --waves", turnId: "t1" });
  for (const n of [1, 2])
    await $.tool.call({ tool: "Agent", description: `task ${n}`, prompt: "x", subagent_type: "ck-code-lite:task-builder" });
  await end("t1");
  await clock.advance(600);
  expect(compacted).toBe(0);

  // Turn 2, a notification turn, dispatches none and ends with nothing doing.
  doing = false;
  await $.turn.start({ text: "", turnId: "t2" });
  await end("t2");
  await clock.advance(600);
  expect(compacted).toBe(1);

  // Turn 3 has nothing left to compact.
  await $.turn.start({ text: "thanks", turnId: "t3" });
  await end("t3");
  await clock.advance(600);
  expect(compacted).toBe(1);
});
