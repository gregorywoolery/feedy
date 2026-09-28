// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  assertSameOrigin,
  readJsonInput,
  readLimitedBody,
  readMultipartInput,
} from "@/lib/http/request-input";

function request(body: BodyInit | null = null, headers: HeadersInit = {}) {
  return new Request("http://localhost:3000/api/feedback", {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit);
}

describe("request boundaries", () => {
  it("accepts same-origin browser and CLI requests, including a differing internal hostname", () => {
    expect(() =>
      assertSameOrigin(
        request(null, {
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).not.toThrow();
    expect(() => assertSameOrigin(request())).not.toThrow();
    const dockerRequest = new Request("http://0.0.0.0:3000/api/projects", {
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    });
    expect(() => assertSameOrigin(dockerRequest)).not.toThrow();
  });
  it.each(["https://evil.example", "null", "http://localhost:4000"])(
    "rejects foreign Origin %s",
    (origin) => {
      expect(() => assertSameOrigin(request(null, { origin }))).toThrow(
        "must come from Feedy",
      );
    },
  );
  it.each(["cross-site", "same-site"])(
    "rejects browser metadata %s even without Origin",
    (site) => {
      expect(() =>
        assertSameOrigin(request(null, { "sec-fetch-site": site })),
      ).toThrow();
    },
  );
  it("rejects text/plain JSON before consuming the body", async () => {
    const input = request('{"name":"injected"}', {
      "content-type": "text/plain",
    });
    await expect(readJsonInput(input)).rejects.toMatchObject({ status: 415 });
    expect(input.bodyUsed).toBe(false);
  });
  it("accepts ordinary JSON and multipart, including charset parameters", async () => {
    await expect(
      readJsonInput(
        request('{"name":"Project"}', {
          "content-type": "application/json; charset=utf-8",
        }),
      ),
    ).resolves.toEqual({ name: "Project" });
    const form = new FormData();
    form.set("description", "normal feedback");
    form.set(
      "photos",
      new File([new Uint8Array([1, 2])], "photo.png", { type: "image/png" }),
    );
    const parsed = await readMultipartInput(request(form));
    expect(parsed.get("description")).toBe("normal feedback");
    expect((parsed.get("photos") as File).size).toBe(2);
  });
  it("counts chunks even when Content-Length is missing or lies", async () => {
    for (const headers of [{}, { "content-length": "1" }] as HeadersInit[]) {
      const cancel = vi.fn();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(4));
          controller.enqueue(new Uint8Array(4));
        },
        cancel,
      });
      await expect(
        readLimitedBody(request(stream, headers), 7),
      ).rejects.toMatchObject({ status: 413 });
      expect(cancel).toHaveBeenCalled();
    }
  });
  it("accepts exactly the limit and rejects an oversized declared body", async () => {
    expect((await readLimitedBody(request("1234"), 4)).byteLength).toBe(4);
    await expect(
      readLimitedBody(request("x", { "content-length": "500" }), 4),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects malformed multipart and malformed JSON", async () => {
    await expect(
      readMultipartInput(
        request("bad", { "content-type": "multipart/form-data; boundary=x" }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      readJsonInput(request("{", { "content-type": "application/json" })),
    ).rejects.toBeInstanceOf(SyntaxError);
  });
});
