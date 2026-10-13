// The ck-code-lite mod's $.state contract: what its band draws from.

export type LiteBand = {
  // "T-01 Count words", the task in progress, or "" when there is none.
  current: string;
  // "2 open · 1 ready", drawn beside the progress bar.
  counts: string;
  // The progress bar's tasks: done, and every task in the plan.
  done: number;
  total: number;
  // "/ck-code-lite:build T-01", or "" when every open task waits on another.
  next: string;
};

declare module "claude-code" {
  interface PluginState {
    "ck-code-lite": {
      band: LiteBand | null;
      bandHidden: boolean;
    };
  }
}
