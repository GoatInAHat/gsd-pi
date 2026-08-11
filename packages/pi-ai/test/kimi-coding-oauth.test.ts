import { afterEach, describe, expect, it, vi } from "vitest";
import { getOAuthProvider } from "../src/utils/oauth/index.ts";
import { kimiCodingOAuthProvider, loginKimiCoding, refreshKimiCodingToken } from "../src/utils/oauth/kimi-coding.ts";

function jsonResponse(body: unknown, status: number = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

describe("Kimi Code OAuth provider", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("is registered as a built-in OAuth provider under the model provider id", () => {
		const provider = getOAuthProvider("kimi-coding");
		expect(provider).toBeDefined();
		expect(provider?.id).toBe("kimi-coding");
	});

	it("returns the access token as the API key", () => {
		const key = kimiCodingOAuthProvider.getApiKey({ access: "tok_access", refresh: "tok_refresh", expires: 0 });
		expect(key).toBe("tok_access");
	});

	describe("device authorization login", () => {
		it("completes the device flow and returns credentials", async () => {
			const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
				const url = String(input);
				if (url.endsWith("/api/oauth/device_authorization")) {
					return jsonResponse({
						device_code: "dev_code",
						user_code: "USER-CODE",
						verification_uri: "https://auth.kimi.com/device",
						verification_uri_complete: "https://auth.kimi.com/device?user_code=USER-CODE",
						interval: 1,
						expires_in: 900,
					});
				}
				return jsonResponse({ access_token: "access", refresh_token: "refresh", expires_in: 3600 });
			});
			vi.stubGlobal("fetch", fetchMock);

			let deviceInfo: { userCode: string; verificationUri: string } | undefined;
			const credentials = await loginKimiCoding({
				onAuth: () => {},
				onDeviceCode: (info) => {
					deviceInfo = info;
				},
				onPrompt: async () => "",
				onSelect: async () => undefined,
			});

			expect(deviceInfo?.userCode).toBe("USER-CODE");
			expect(deviceInfo?.verificationUri).toBe("https://auth.kimi.com/device?user_code=USER-CODE");
			expect(credentials.access).toBe("access");
			expect(credentials.refresh).toBe("refresh");
			expect(credentials.expires).toBeGreaterThan(Date.now());
		});

		it("surfaces device authorization failure responses", async () => {
			const fetchMock = vi.fn(
				async (): Promise<Response> => new Response("boom", { status: 500, statusText: "Server Error" }),
			);
			vi.stubGlobal("fetch", fetchMock);

			await expect(
				loginKimiCoding({
					onAuth: () => {},
					onDeviceCode: () => {},
					onPrompt: async () => "",
					onSelect: async () => undefined,
				}),
			).rejects.toThrow("Kimi Code device authorization failed with status 500");
		});
	});

	describe("token refresh", () => {
		it("returns refreshed credentials", async () => {
			const fetchMock = vi.fn(
				async (): Promise<Response> =>
					jsonResponse({ access_token: "new-a", refresh_token: "new-r", expires_in: 3600 }),
			);
			vi.stubGlobal("fetch", fetchMock);

			const credentials = await refreshKimiCodingToken("tok_old_refresh");
			expect(credentials.access).toBe("new-a");
			expect(credentials.refresh).toBe("new-r");
		});

		it("surfaces unauthorized refresh responses", async () => {
			const fetchMock = vi.fn(async (): Promise<Response> => jsonResponse({ error: "invalid_grant" }, 401));
			vi.stubGlobal("fetch", fetchMock);

			await expect(refreshKimiCodingToken("tok_dead")).rejects.toThrow("Kimi Code token refresh unauthorized");
		});
	});
});
