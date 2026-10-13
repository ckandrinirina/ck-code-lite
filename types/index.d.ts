// The ck-code-lite mod's $.state contract: what its band draws from.

export type LiteBand = {
  // "doing T-01 Count words", or "" when nothing is in progress.
  current: string;
  // "2 open · 1 ready · 0/2 done"
  counts: string;
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
