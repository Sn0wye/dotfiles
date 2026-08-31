/**
 * Provider glyphs for session cards.
 *
 * Terminals cannot render the SVG logos, so each provider gets a glyph in its
 * brand color via truecolor SGR. `PI_SESSION_PANEL_NO_BRAND_COLOR=1` falls back
 * to the theme's dim color for terminals with a clashing palette.
 */

export interface ProviderIcon {
	glyph: string;
	/** Brand color as [r, g, b], or undefined to inherit the theme color. */
	rgb?: [number, number, number];
	label: string;
}

const ICONS: Record<string, ProviderIcon> = {
	anthropic: { glyph: "✳", rgb: [217, 119, 87], label: "Claude" },
	openai: { glyph: "✶", label: "OpenAI" },
	"openai-codex": { glyph: "✶", label: "Codex" },
	cursor: { glyph: "◆", label: "Cursor" },
	command: { glyph: "⌘", label: "Command" },
	commandcode: { glyph: "⌘", label: "Command" },
	google: { glyph: "◈", rgb: [66, 133, 244], label: "Gemini" },
	"google-vertex": { glyph: "◈", rgb: [66, 133, 244], label: "Gemini" },
	xai: { glyph: "✕", label: "xAI" },
	groq: { glyph: "▲", rgb: [244, 88, 39], label: "Groq" },
	openrouter: { glyph: "◎", rgb: [106, 90, 205], label: "OpenRouter" },
	mistral: { glyph: "◤", rgb: [255, 143, 0], label: "Mistral" },
	deepseek: { glyph: "◐", rgb: [77, 107, 254], label: "DeepSeek" },
	zai: { glyph: "◇", label: "Z.ai" },
	llamacpp: { glyph: "⬡", label: "llama.cpp" },
};

const FALLBACK: ProviderIcon = { glyph: "•", label: "unknown" };

export function providerIcon(provider: string | undefined): ProviderIcon {
	if (!provider) return FALLBACK;
	const key = provider.toLowerCase();
	if (ICONS[key]) return ICONS[key];
	// Providers registered by extensions often prefix a known vendor id.
	for (const [id, icon] of Object.entries(ICONS)) {
		if (key.includes(id)) return icon;
	}
	return FALLBACK;
}

/** Paint a glyph in its brand color, or fall back to the caller's styling. */
export function paintIcon(icon: ProviderIcon, fallbackStyle: (text: string) => string): string {
	if (!icon.rgb || process.env.PI_SESSION_PANEL_NO_BRAND_COLOR === "1" || process.env.NO_COLOR) {
		return fallbackStyle(icon.glyph);
	}
	const [r, g, b] = icon.rgb;
	return `\x1b[38;2;${r};${g};${b}m${icon.glyph}\x1b[39m`;
}
