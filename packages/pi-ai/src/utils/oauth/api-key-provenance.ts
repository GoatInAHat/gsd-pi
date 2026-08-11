import type { OAuthProviderId } from "./types.js";

const oauthApiKeyProviders = new Map<string, Set<OAuthProviderId>>();

export function registerOAuthApiKey(providerId: OAuthProviderId, apiKey: string): string {
	const providers = oauthApiKeyProviders.get(apiKey) ?? new Set<OAuthProviderId>();
	providers.add(providerId);
	oauthApiKeyProviders.set(apiKey, providers);
	return apiKey;
}

export function hasOAuthApiKeyProvenance(providerId: OAuthProviderId, apiKey: string): boolean {
	return oauthApiKeyProviders.get(apiKey)?.has(providerId) ?? false;
}
