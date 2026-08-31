/**
 * Session discovery and card metadata.
 *
 * `SessionManager.listAll()` gives path, cwd, name, timestamps, and the first
 * message. The card also wants the provider that last answered and the git
 * branch of the project, so both are read here: the provider from a bounded
 * tail read of the JSONL file, the branch from `git rev-parse`, cached per cwd.
 */

import { execFile } from "node:child_process";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { basename, sep } from "node:path";
import { promisify } from "node:util";
import { SessionManager } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);

/** Bytes read from the end of a session file when looking for the last provider. */
const TAIL_BYTES = 96 * 1024;

export interface SessionCard {
	path: string;
	id: string;
	cwd: string;
	project: string;
	title: string;
	subtitle: string;
	provider: string | undefined;
	modified: Date;
	messageCount: number;
	searchText: string;
}

/** Read the trailing bytes of a file as UTF-8, ignoring a split leading char. */
function readTail(path: string, bytes: number): string {
	let fd: number | undefined;
	try {
		const size = statSync(path).size;
		const length = Math.min(bytes, size);
		if (length === 0) return "";
		fd = openSync(path, "r");
		const buffer = Buffer.allocUnsafe(length);
		readSync(fd, buffer, 0, length, size - length);
		return buffer.toString("utf8");
	} catch {
		return "";
	} finally {
		if (fd !== undefined) closeSync(fd);
	}
}

/**
 * Last provider that produced a message in the session.
 *
 * Both `model_change` entries and assistant messages carry a `provider` field,
 * so the final match in the tail is the provider currently in use.
 */
function lastProvider(path: string): string | undefined {
	const tail = readTail(path, TAIL_BYTES);
	if (!tail) return undefined;
	let provider: string | undefined;
	const pattern = /"provider":"([^"]+)"/g;
	let match = pattern.exec(tail);
	while (match !== null) {
		provider = match[1];
		match = pattern.exec(tail);
	}
	return provider;
}

const branchCache = new Map<string, string | undefined>();

async function gitBranch(cwd: string): Promise<string | undefined> {
	if (branchCache.has(cwd)) return branchCache.get(cwd);
	let branch: string | undefined;
	try {
		const { stdout } = await execFileAsync("git", ["-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"], {
			timeout: 2000,
		});
		const trimmed = stdout.trim();
		branch = trimmed && trimmed !== "HEAD" ? trimmed : undefined;
	} catch {
		branch = undefined;
	}
	branchCache.set(cwd, branch);
	return branch;
}

/** First non-empty line of the prompt, with slash commands and noise stripped. */
function deriveTitle(name: string | undefined, firstMessage: string): string {
	if (name?.trim()) return name.trim();
	const line = firstMessage
		.split("\n")
		.map((l) => l.trim())
		.find((l) => l.length > 0);
	if (!line) return "Untitled session";
	return line.replace(/\s+/g, " ");
}

function projectName(cwd: string): string {
	if (!cwd) return "unknown";
	const name = basename(cwd.replace(new RegExp(`${sep === "\\" ? "\\\\" : sep}+$`), ""));
	return name || cwd;
}

/** "17h", "1d", "3w" — matches how recency reads in a sidebar. */
export function relativeTime(date: Date, now: number = Date.now()): string {
	const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d`;
	const weeks = Math.floor(days / 7);
	if (weeks < 52) return `${weeks}w`;
	return `${Math.floor(days / 365)}y`;
}

export interface LoadOptions {
	/** Limit to sessions started in this directory. */
	cwd?: string;
	/** Cap on how many cards to build. Older sessions past this are dropped. */
	limit?: number;
}

export async function loadSessionCards(options: LoadOptions = {}): Promise<SessionCard[]> {
	const infos = options.cwd ? await SessionManager.list(options.cwd) : await SessionManager.listAll();
	const limited = options.limit ? infos.slice(0, options.limit) : infos;

	const cards = await Promise.all(
		limited.map(async (info): Promise<SessionCard> => {
			const project = projectName(info.cwd);
			const title = deriveTitle(info.name, info.firstMessage);
			const branch = await gitBranch(info.cwd);
			return {
				path: info.path,
				id: info.id,
				cwd: info.cwd,
				project,
				title,
				subtitle: branch ?? info.cwd,
				provider: lastProvider(info.path),
				modified: info.modified,
				messageCount: info.messageCount,
				searchText: `${project} ${title} ${info.cwd} ${branch ?? ""}`.toLowerCase(),
			};
		}),
	);

	return cards;
}

export function filterCards(cards: SessionCard[], query: string): SessionCard[] {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) return cards;
	const terms = trimmed.split(/\s+/);
	return cards.filter((card) => terms.every((term) => card.searchText.includes(term)));
}
