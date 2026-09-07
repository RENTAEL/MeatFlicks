/** Support / tip-jar links — optional, never gated, shown as a friendly nudge. */
export const SUPPORT_URL = 'https://buymeacoffee.com/HelpGavin';

export const SUPPORT_LABEL = 'Buy me a coffee';

export const SUPPORT_TOOLTIPS = [
	'This app runs on caffeine. Help a dev out. ☕',
	"Buy me a coffee and I'll pretend I'm a real startup."
] as const;

export function pickSupportTooltip(): string {
	return SUPPORT_TOOLTIPS[Math.floor(Math.random() * SUPPORT_TOOLTIPS.length)];
}
