import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getModel } from "../src/models.ts";
import { streamAnthropic } from "../src/providers/anthropic.ts";
import type { Context } from "../src/types.ts";
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

async function captureKimiRequestHeaders(apiKey: string): Promise<IncomingHttpHeaders> {
	let capturedHeaders: IncomingHttpHeaders | undefined;
	const server = createServer((request, response) => {
		capturedHeaders = request.headers;
		request.resume();
		response.writeHead(200, { "Content-Type": "text/event-stream" });
		response.end();
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address() as AddressInfo;
	const model = {
		...getModel("kimi-coding", "kimi-for-coding"),
		baseUrl: `http://127.0.0.1:${address.port}`,
	};
	const context: Context = {
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};

	try {
		await streamAnthropic(model, context, { apiKey }).result();
	} finally {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	}

	if (!capturedHeaders) {
		throw new Error("Kimi request was not captured");
	}
	return capturedHeaders;
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

			vi.unstubAllGlobals();
			const headers = await captureKimiRequestHeaders(credentials.access);
			expect(headers.authorization).toBe("Bearer access");
			expect(headers["x-api-key"]).toBeUndefined();
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

			vi.unstubAllGlobals();
			const headers = await captureKimiRequestHeaders(credentials.access);
			expect(headers.authorization).toBe("Bearer new-a");
			expect(headers["x-api-key"]).toBeUndefined();
		});

		it("does not expose token values from malformed successful responses", async () => {
			const accessToken = "synthetic-access-value";
			const refreshToken = "synthetic-refresh-value";
			const fetchMock = vi.fn(
				async (): Promise<Response> => jsonResponse({ access_token: accessToken, refresh_token: refreshToken }),
			);
			vi.stubGlobal("fetch", fetchMock);

			const error = await refreshKimiCodingToken("synthetic-old-refresh").then(
				() => undefined,
				(reason: unknown) => reason,
			);
			expect(error).toBeInstanceOf(Error);
			if (!(error instanceof Error)) {
				throw new Error("Expected token refresh to fail");
			}
			expect(error.message).toBe("Kimi Code token refresh response has invalid fields: expires_in");
			expect(error.message).not.toContain(accessToken);
			expect(error.message).not.toContain(refreshToken);
		});

		it("surfaces unauthorized refresh responses", async () => {
			const fetchMock = vi.fn(async (): Promise<Response> => jsonResponse({ error: "invalid_grant" }, 401));
			vi.stubGlobal("fetch", fetchMock);

			await expect(refreshKimiCodingToken("tok_dead")).rejects.toThrow("Kimi Code token refresh unauthorized");
		});
	});
});
