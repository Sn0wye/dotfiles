/**
 * session-panel: a left-docked session browser.
 *
 * `/sessions` opens a panel of session cards (project, age, title, branch,
 * provider glyph). Enter switches to the highlighted session, Ctrl+T starts a
 * new one.
 *
 * Switching sessions requires the command context, which only command handlers
 * receive, so `/sessions` is the real entry point. Ctrl+Shift+S is a shortcut
 * that stages the command in the editor.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { type PanelResult, type PanelScope, SessionPanel } from "./panel.ts";
import { loadSessionCards } from "./sessions.ts";

/** Cap the scan so a machine with thousands of sessions still opens instantly. */
const MAX_SESSIONS = 200;

async function openPanel(ctx: ExtensionCommandContext, initialScope: PanelScope): Promise<PanelResult> {
	const currentSessionPath = ctx.sessionManager.getSessionFile();
	let scope = initialScope;

	return ctx.ui.custom<PanelResult>(
		(tui, theme, _keybindings, done) => {
			// Guards against a slow scope switch overwriting a newer one.
			let generation = 0;

			const load = async (target: PanelScope): Promise<void> => {
				const current = ++generation;
				panel.setLoading(true);
				const cards = await loadSessionCards({
					cwd: target === "project" ? ctx.cwd : undefined,
					limit: MAX_SESSIONS,
				});
				if (current === generation) panel.setCards(cards);
			};

			const panel = new SessionPanel(
				theme,
				{
					onDone: done,
					onRender: () => tui.requestRender(),
					onScopeChange: (next) => {
						scope = next;
						void load(next);
					},
					onReload: () => void load(scope),
				},
				{ scope, currentSessionPath },
			);

			void load(scope);
			return panel;
		},
		{
			overlay: true,
			overlayOptions: () => ({
				anchor: "left-center",
				width: "34%",
				minWidth: 30,
				maxHeight: "90%",
				margin: { left: 1 },
			}),
		},
	);
}

export default function sessionPanelExtension(pi: ExtensionAPI): void {
	pi.registerCommand("sessions", {
		description: "Browse and switch sessions in a left panel",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/sessions needs the interactive TUI", "warning");
				return;
			}

			const currentSessionPath = ctx.sessionManager.getSessionFile();
			const result = await openPanel(ctx, "all");

			if (result.type === "cancel") return;

			if (result.type === "new") {
				await ctx.newSession({ parentSession: currentSessionPath });
				return;
			}

			if (result.card.path === currentSessionPath) {
				ctx.ui.notify("Already in that session", "info");
				return;
			}

			const label = result.card.title;
			const switched = await ctx.switchSession(result.card.path, {
				withSession: async (replacement) => {
					replacement.ui.notify(`Switched to ${label}`, "info");
				},
			});
			if (switched.cancelled) {
				ctx.ui.notify("Session switch cancelled", "warning");
			}
		},
	});

	// Shortcuts run without the command context that switchSession needs, so this
	// stages the command instead of opening a panel that could not act on Enter.
	pi.registerShortcut(Key.ctrlShift("s"), {
		description: "Stage /sessions in the editor",
		handler: (ctx) => {
			if (ctx.mode !== "tui") return;
			ctx.ui.setEditorText("/sessions");
			ctx.ui.notify("Press Enter to open the session panel", "info");
		},
	});
}
