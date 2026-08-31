/**
 * usage-status: replaces pi's footer with a two-line version.
 *
 *   ~/code/projects/CloudCertify (main)
 *   claude-opus-5 (medium) | ctx: 19% (192k) | s(5h): 4% | w(5d18h): 3%
 *
 *   ctx  = context window used (percent, absolute tokens)
 *   s(x) = 5-hour session window: time until reset, percent used
 *   w(x) = weekly window: time until reset, percent used
 *
 * pi's built-in token/cost stats line is dropped. Usage windows are supported
 * for the `anthropic` and `openai-codex` providers.
 */
import { readStoredCredential, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import os from "node:os";
import path from "node:path";

const STATUS_KEY = "usage-status";
const REFRESH_INTERVAL_MS = 60_000;
const REFRESH_TTL_MS = 20_000;
const REFRESH_DEBOUNCE_MS = 1_500;

const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

type ModelLike = { provider?: string; id?: string } | undefined;

interface Window {
  /** percent of the window consumed (0-100) */
  used: number;
  /** epoch ms when the window resets */
  resetAt?: number;
}

interface Snapshot {
  session?: Window;
  weekly?: Window;
  error?: string;
  fetchedAt: number;
}

interface State {
  providerId?: "anthropic" | "openai-codex";
  snapshot?: Snapshot;
  lastRefreshAt: number;
  inFlight?: Promise<void>;
  refreshTimer?: NodeJS.Timeout;
  debounceTimer?: NodeJS.Timeout;
}

// --- helpers ---------------------------------------------------------------

function authPath(): string {
  const dir = process.env.PI_CODING_AGENT_DIR?.trim() || path.join(os.homedir(), ".pi", "agent");
  return path.join(dir, "auth.json");
}

function providerOf(model: ModelLike): State["providerId"] | undefined {
  const provider = model?.provider?.toLowerCase() ?? "";
  if (provider === "anthropic") return "anthropic";
  if (provider.includes("openai-codex")) return "openai-codex";
  return undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function clamp(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}

/** "42m", "5h", "5d18h" */
function untilReset(resetAt: number | undefined): string | undefined {
  if (!resetAt) return undefined;
  const totalMin = Math.max(0, Math.round((resetAt - Date.now()) / 60_000));
  if (totalMin < 60) return `${totalMin}m`;
  const totalHours = Math.floor(totalMin / 60);
  if (totalHours < 24) return `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days}d${hours}h` : `${days}d`;
}

function shortTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return `${tokens}`;
}

function windowSegment(label: string, window: Window | undefined): string | undefined {
  if (!window) return undefined;
  const reset = untilReset(window.resetAt);
  return `${label}${reset ? `(${reset})` : ""}: ${Math.round(window.used)}%`;
}

// --- providers -------------------------------------------------------------

async function fetchAnthropic(signal: AbortSignal): Promise<Snapshot> {
  const entry = readStoredCredential("anthropic", authPath()) as { access?: string } | undefined;
  if (!entry?.access) return { error: "anthropic auth not found", fetchedAt: Date.now() };

  const response = await fetch(ANTHROPIC_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${entry.access}`,
      "anthropic-beta": "oauth-2025-04-20",
      Accept: "application/json",
    },
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as Record<string, { utilization?: number | string; resets_at?: string | number }>;

  const toWindow = (entryName: string): Window | undefined => {
    const raw = body?.[entryName];
    const used = num(raw?.utilization);
    if (used == null) return undefined;
    const resets = raw?.resets_at;
    const parsed = typeof resets === "number" ? (resets < 1e12 ? resets * 1000 : resets) : resets ? Date.parse(resets) : NaN;
    return { used: clamp(used), resetAt: Number.isNaN(parsed) ? undefined : parsed };
  };

  // Weekly: report the binding (most consumed) of the 7-day windows.
  const weeklyWindows = ["seven_day", "seven_day_omelette", "seven_day_opus", "seven_day_sonnet"]
    .map(toWindow)
    .filter((window): window is Window => !!window);
  const weekly = weeklyWindows.sort((a, b) => b.used - a.used)[0];

  return { session: toWindow("five_hour"), weekly, fetchedAt: Date.now() };
}

function decodeJwt(token: string | undefined): Record<string, any> | undefined {
  const payload = token?.split(".")[1];
  if (!payload) return undefined;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

async function fetchCodex(signal: AbortSignal): Promise<Snapshot> {
  const entry = readStoredCredential("openai-codex", authPath()) as { access?: string; accountId?: string } | undefined;
  const accountId = entry?.accountId || decodeJwt(entry?.access)?.["https://api.openai.com/auth"]?.chatgpt_account_id;
  if (!entry?.access || !accountId) return { error: "codex auth not found", fetchedAt: Date.now() };

  const response = await fetch(CODEX_USAGE_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${entry.access}`,
      "ChatGPT-Account-Id": accountId,
    },
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rateLimit = ((await response.json()) as any)?.rate_limit;

  const toWindow = (raw: any): Window | undefined => {
    const used = num(raw?.used_percent);
    if (used == null) return undefined;
    return { used: clamp(used), resetAt: num(raw?.reset_at) ? num(raw.reset_at)! * 1000 : undefined };
  };

  return { session: toWindow(rateLimit?.primary_window), weekly: toWindow(rateLimit?.secondary_window), fetchedAt: Date.now() };
}

// --- rendering -------------------------------------------------------------

function homeRelative(cwd: string): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return cwd;
  const relative = path.relative(path.resolve(home), path.resolve(cwd));
  if (relative === "") return "~";
  if (relative.startsWith("..") || path.isAbsolute(relative)) return cwd;
  return `~${path.sep}${relative}`;
}

function statusLine(ctx: ExtensionContext, state: State): string {
  const segments: string[] = [];

  const model = ctx.model;
  if (model) {
    const effort = model.reasoning ? ctx.thinkingLevel || "off" : undefined;
    segments.push(effort ? `${model.id} (${effort})` : model.id);
  }

  const usage = ctx.getContextUsage();
  if (usage?.tokens != null) {
    const percent = usage.percent ?? (usage.contextWindow ? (usage.tokens / usage.contextWindow) * 100 : undefined);
    segments.push(`ctx: ${percent != null ? Math.round(percent) : "?"}% (${shortTokens(usage.tokens)})`);
  }

  const snapshot = state.snapshot;
  if (state.providerId && snapshot?.error) {
    segments.push(snapshot.error);
  } else if (state.providerId) {
    const session = windowSegment("s", snapshot?.session);
    const weekly = windowSegment("w", snapshot?.weekly);
    if (session) segments.push(session);
    if (weekly) segments.push(weekly);
  }

  return segments.join(" | ");
}

function statusColor(state: State): "dim" | "warning" | "error" {
  const highest = Math.max(state.snapshot?.session?.used ?? 0, state.snapshot?.weekly?.used ?? 0);
  return highest >= 90 ? "error" : highest >= 80 ? "warning" : "dim";
}

function render(ctx: ExtensionContext, state: State): void {
  const line = statusLine(ctx, state);
  ctx.ui.setStatus(STATUS_KEY, line ? ctx.ui.theme.fg(statusColor(state), line) : undefined);
}

/** Two-line footer: cwd/branch, then our usage line + other extensions' statuses. */
function installFooter(ctx: ExtensionContext, state: State): void {
  if (ctx.mode !== "tui") return;
  ctx.ui.setFooter((tui, theme, footerData) => ({
    dispose: footerData.onBranchChange(() => tui.requestRender()),
    invalidate() {},
    render(width: number): string[] {
      const branch = footerData.getGitBranch();
      const sessionName = ctx.sessionManager.getSessionName();
      let pwd = homeRelative(ctx.sessionManager.getCwd());
      if (branch) pwd = `${pwd} (${branch})`;
      if (sessionName) pwd = `${pwd} \u2022 ${sessionName}`;

      const others = Array.from(footerData.getExtensionStatuses().entries())
        .filter(([key]) => key !== STATUS_KEY)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, text]) => text.replace(/[\r\n\t]/g, " ").trim());

      const line = [theme.fg(statusColor(state), statusLine(ctx, state)), ...others].filter(Boolean).join(" ");

      return [
        truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "...")),
        truncateToWidth(line, width, theme.fg("dim", "...")),
      ];
    },
  }));
}

async function refresh(ctx: ExtensionContext, state: State, force: boolean): Promise<void> {
  if (!state.providerId) return;
  if (state.inFlight) return state.inFlight;
  if (!force && Date.now() - state.lastRefreshAt < REFRESH_TTL_MS) return;

  const providerId = state.providerId;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  state.inFlight = (async () => {
    try {
      state.snapshot = providerId === "anthropic" ? await fetchAnthropic(controller.signal) : await fetchCodex(controller.signal);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.snapshot = { error: /abort|timeout/i.test(message) ? "usage timeout" : "usage unavailable", fetchedAt: Date.now() };
    } finally {
      clearTimeout(timeout);
      state.lastRefreshAt = Date.now();
      state.inFlight = undefined;
      if (state.providerId === providerId) render(ctx, state);
    }
  })();

  return state.inFlight;
}

function scheduleRefresh(ctx: ExtensionContext, state: State): void {
  if (state.debounceTimer) clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => void refresh(ctx, state, false), REFRESH_DEBOUNCE_MS);
}

function setProvider(ctx: ExtensionContext, state: State, model: ModelLike): void {
  const providerId = providerOf(model);
  if (providerId === state.providerId) return;
  state.providerId = providerId;
  state.snapshot = undefined;
  state.lastRefreshAt = 0;
  render(ctx, state);
  if (providerId) void refresh(ctx, state, true);
}

// --- extension -------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  const state: State = { lastRefreshAt: 0 };

  pi.on("session_start", (_event, ctx) => {
    installFooter(ctx, state);
    setProvider(ctx, state, ctx.model);
    render(ctx, state);
    if (!state.refreshTimer) {
      state.refreshTimer = setInterval(() => {
        void refresh(ctx, state, false);
        render(ctx, state); // keep reset countdowns fresh
      }, REFRESH_INTERVAL_MS);
      state.refreshTimer.unref?.();
    }
  });

  pi.on("model_select", (_event, ctx) => setProvider(ctx, state, ctx.model));

  pi.on("thinking_level_select", (_event, ctx) => render(ctx, state));

  pi.on("message_end", (_event, ctx) => {
    render(ctx, state);
    scheduleRefresh(ctx, state);
  });

  pi.on("agent_end", (_event, ctx) => {
    render(ctx, state);
    scheduleRefresh(ctx, state);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
  });

  pi.registerCommand("usage", {
    description: "Refresh the usage status line",
    handler: async (_args, ctx) => {
      await refresh(ctx, state, true);
      render(ctx, state);
      const snapshot = state.snapshot;
      ctx.ui.notify(
        snapshot?.error ??
          [windowSegment("session", snapshot?.session), windowSegment("weekly", snapshot?.weekly)].filter(Boolean).join(" | ") ??
          "no usage data",
        "info",
      );
    },
  });
}
