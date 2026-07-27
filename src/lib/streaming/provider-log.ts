const providerLog: Record<string, { success: number; fail: number; lastError?: string }> = {};

export function logProviderResult(name: string, success: boolean, error?: string) {
	if (!providerLog[name]) providerLog[name] = { success: 0, fail: 0 };
	if (success) providerLog[name].success++;
	else {
		providerLog[name].fail++;
		providerLog[name].lastError = error;
	}
	console.log('[Provider stats]', providerLog);
}

export function getProviderStats() {
	return { ...providerLog };
}
