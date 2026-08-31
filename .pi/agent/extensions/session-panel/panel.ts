/**
 * Left-docked session browser.
 *
 * Each session renders as a three-line card (project + age, title, branch +
 * provider glyph) separated by a rule, so scanning the list top-to-bottom shows
 * where the work happened before what it was about.
 *
 * The panel is an overlay composited over the transcript, so every line is
 * padded to the full panel width and wrapped in a border. Without that, chat
 * text behind the panel shows through wherever a line runs short.
 */

import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { paintIcon, providerIcon } from "./icons.ts";
import { filterCards, relativeTime, type SessionCard } from "./sessions.ts";

export type PanelScope = "all" | "project";

export type PanelResult =
	| { type: "switch"; card: SessionCard }
	| { type: "new" }
	| { type: "cancel" };

export interface PanelCallbacks {
	onDone: (result: PanelResult) => void;
	onScopeChange: (scope: PanelScope) => void;
	onReload: () => void;
	onRender: () => void;
}

const CARD_LINES = 3;
const SEPARATOR_LINES = 1;
/** Top border, search row, scope row, rule. */
const HEADER_LINES = 4;
/** Rule, hint row, bottom border. */
const FOOTER_LINES = 3;

const TITLE = "Sessions";

export class SessionPanel implements Component {
	private cards: SessionCard[] = [];
	private filtered: SessionCard[] = [];
	private query = "";
	private selected = 0;
	private scroll = 0;
	private loading = true;
	private scope: PanelScope;
	private currentSessionPath: string | undefined;

	constructor(
		private readonly theme: Theme,
		private readonly callbacks: PanelCallbacks,
		options: { scope: PanelScope; currentSessionPath?: string },
	) {
		this.scope = options.scope;
		this.currentSessionPath = options.currentSessionPath;
	}

	setCards(cards: SessionCard[]): void {
		this.cards = cards;
		this.loading = false;
		this.applyFilter({ keepSelection: false });
		this.callbacks.onRender();
	}

	setLoading(loading: boolean): void {
		this.loading = loading;
		this.callbacks.onRender();
	}

	private applyFilter(options: { keepSelection: boolean }): void {
		const previous = options.keepSelection ? this.filtered[this.selected] : undefined;
		this.filtered = filterCards(this.cards, this.query);
		const index = previous ? this.filtered.findIndex((card) => card.path === previous.path) : -1;
		this.selected = index >= 0 ? index : 0;
		this.clampScroll(this.visibleCards());
	}

	/** Cards that fit given the terminal height the overlay is allowed to use. */
	private visibleCards(): number {
		const rows = Math.floor((process.stdout.rows || 24) * 0.9);
		const body = rows - HEADER_LINES - FOOTER_LINES;
		return Math.max(1, Math.floor(body / (CARD_LINES + SEPARATOR_LINES)));
	}

	private clampScroll(visible: number): void {
		const maxScroll = Math.max(0, this.filtered.length - visible);
		if (this.selected < this.scroll) this.scroll = this.selected;
		if (this.selected >= this.scroll + visible) this.scroll = this.selected - visible + 1;
		this.scroll = Math.min(Math.max(0, this.scroll), maxScroll);
	}

	private move(delta: number): void {
		if (this.filtered.length === 0) return;
		this.selected = Math.min(Math.max(0, this.selected + delta), this.filtered.length - 1);
		this.clampScroll(this.visibleCards());
		this.callbacks.onRender();
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
			this.callbacks.onDone({ type: "cancel" });
			return;
		}
		if (matchesKey(data, "up") || matchesKey(data, "ctrl+p")) return this.move(-1);
		if (matchesKey(data, "down") || matchesKey(data, "ctrl+n")) return this.move(1);
		if (matchesKey(data, "pageUp")) return this.move(-this.visibleCards());
		if (matchesKey(data, "pageDown")) return this.move(this.visibleCards());
		if (matchesKey(data, "return")) {
			const card = this.filtered[this.selected];
			if (card) this.callbacks.onDone({ type: "switch", card });
			return;
		}
		if (matchesKey(data, "ctrl+t")) {
			this.callbacks.onDone({ type: "new" });
			return;
		}
		if (matchesKey(data, "ctrl+r")) {
			this.loading = true;
			this.callbacks.onReload();
			this.callbacks.onRender();
			return;
		}
		if (matchesKey(data, "tab")) {
			this.scope = this.scope === "all" ? "project" : "all";
			this.loading = true;
			this.callbacks.onScopeChange(this.scope);
			this.callbacks.onRender();
			return;
		}
		if (matchesKey(data, "backspace")) {
			if (this.query.length === 0) return;
			this.query = this.query.slice(0, -1);
			this.applyFilter({ keepSelection: true });
			this.callbacks.onRender();
			return;
		}
		if (data.length === 1 && data.charCodeAt(0) >= 32 && data.charCodeAt(0) !== 127) {
			this.query += data;
			this.applyFilter({ keepSelection: true });
			this.callbacks.onRender();
		}
	}

	invalidate(): void {}

	/** Truncate to an exact width, then pad, so the line fully covers the transcript. */
	private fit(text: string, width: number): string {
		const clipped = truncateToWidth(text, width, "…", true);
		return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
	}

	render(width: number): string[] {
		const th = this.theme;
		const border = (text: string) => th.fg("border", text);
		// Panel width minus the two border columns.
		const inner = Math.max(8, width - 2);
		// Content width inside the one-column left gutter used by the selection bar.
		const content = inner - 2;

		const lines: string[] = [];
		/** A content row: left border, gutter marker, padded body, right border. */
		const row = (gutter: string, body: string) =>
			border("│") + gutter + this.fit(body, content) + " " + border("│");
		const rule = (left: string, right: string) => border(left + "─".repeat(inner) + right);

		// Top border carries the panel title so the frame does double duty.
		const heading = ` ${TITLE} `;
		const headingWidth = visibleWidth(heading);
		lines.push(
			border("╭─") + th.fg("accent", heading) + border("─".repeat(Math.max(0, inner - headingWidth - 1)) + "╮"),
		);

		const queryText = this.query ? th.fg("text", this.query) : th.fg("dim", "search sessions");
		lines.push(row(" ", `${th.fg("accent", "⌕")} ${queryText}`));

		const scopeLabel = this.scope === "all" ? "All projects" : "This project";
		const count = this.loading ? "loading…" : `${this.filtered.length}`;
		lines.push(row(" ", th.fg("dim", `${scopeLabel} · ${count}`)));
		lines.push(rule("├", "┤"));

		if (this.loading && this.cards.length === 0) {
			lines.push(row(" ", th.fg("dim", "Reading session files…")));
			lines.push(...this.footer(inner, content));
			return lines;
		}

		if (this.filtered.length === 0) {
			lines.push(row(" ", th.fg("warning", this.query ? "No matching sessions" : "No sessions yet")));
			lines.push(...this.footer(inner, content));
			return lines;
		}

		const visible = this.visibleCards();
		this.clampScroll(visible);
		const slice = this.filtered.slice(this.scroll, this.scroll + visible);

		for (const [offset, card] of slice.entries()) {
			const isSelected = this.scroll + offset === this.selected;
			const gutter = isSelected ? th.fg("accent", "▌") : " ";
			for (const body of this.cardRows(card, isSelected, content)) {
				lines.push(row(gutter, body));
			}
			// Inset divider so cards read as separate blocks inside one frame.
			lines.push(row(" ", th.fg("borderMuted", "─".repeat(content))));
		}

		if (this.scroll + visible < this.filtered.length) {
			lines.push(row(" ", th.fg("dim", `↓ ${this.filtered.length - this.scroll - visible} more`)));
		}

		lines.push(...this.footer(inner, content));
		return lines;
	}

	/** The three body rows of a card, each already sized to `content`. */
	private cardRows(card: SessionCard, isSelected: boolean, content: number): string[] {
		const th = this.theme;
		const isCurrent = this.currentSessionPath === card.path;

		// Row 1: project on the left, age right-aligned.
		const age = relativeTime(card.modified);
		const project = truncateToWidth(`▸ ${card.project}`, Math.max(3, content - visibleWidth(age) - 1), "…", true);
		const projectGap = Math.max(1, content - visibleWidth(project) - visibleWidth(age));
		const row1 = `${th.fg("muted", project)}${" ".repeat(projectGap)}${th.fg("dim", age)}`;

		// Row 2: title, emphasized while selected.
		const title = truncateToWidth(card.title, content, "…", true);
		const row2 = isSelected ? th.fg("accent", th.bold(title)) : th.fg("text", title);

		// Row 3: branch or path, with the provider glyph pinned right.
		const icon = providerIcon(card.provider);
		const glyph = paintIcon(icon, (text) => th.fg("dim", text));
		const marker = isCurrent ? th.fg("success", "● ") : "";
		const markerWidth = isCurrent ? 2 : 0;
		const subtitle = truncateToWidth(card.subtitle, Math.max(3, content - markerWidth - 2), "…", true);
		const subtitleGap = Math.max(1, content - markerWidth - visibleWidth(subtitle) - 1);
		const row3 = `${marker}${th.fg("dim", subtitle)}${" ".repeat(subtitleGap)}${glyph}`;

		return [row1, row2, row3];
	}

	private footer(inner: number, content: number): string[] {
		const th = this.theme;
		const border = (text: string) => th.fg("border", text);
		const full = "↑↓ move · ⏎ open · ^t new · tab scope · esc close";
		// Drop to the essentials rather than letting the hint truncate mid-word.
		const hint = visibleWidth(full) <= content ? full : "↑↓ · ⏎ open · ^t new · esc";
		return [
			border(`├${"─".repeat(inner)}┤`),
			border("│") + " " + this.fit(th.fg("dim", hint), content) + " " + border("│"),
			border(`╰${"─".repeat(inner)}╯`),
		];
	}
}
