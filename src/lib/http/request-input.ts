const JSON_BODY_LIMIT = 64 * 1024;
const MULTIPART_BODY_LIMIT = 55 * 1024 * 1024;

export class RequestInputError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Browser mutations must come from this application. CLI clients may omit Origin. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const url = new URL(request.url);
  const expectedOrigin =
    process.env.APP_ORIGIN ||
    `${url.protocol}//${request.headers.get("host") || url.host}`;

  if (
    (origin && origin !== expectedOrigin) ||
    (site && site !== "same-origin" && site !== "none")
  ) {
    throw new RequestInputError(
      403,
      "INVALID_ORIGIN",
      "This request must come from Feedy.",
    );
  }
}

/** Count the actual stream, including unknown fields; Content-Length alone is not trusted. */
export async function readLimitedBody(
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declaredSize = request.headers.get("content-length");
  if (
    declaredSize &&
    (!/^\d+$/.test(declaredSize) || Number(declaredSize) > maximumBytes)
  ) {
    void request.body?.cancel().catch(() => undefined);
    throw new RequestInputError(
      413,
      "REQUEST_TOO_LARGE",
      "The request is too large.",
    );
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        void reader.cancel().catch(() => undefined);
        throw new RequestInputError(
          413,
          "REQUEST_TOO_LARGE",
          "The request is too large.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJsonInput(request: Request): Promise<unknown> {
  assertSameOrigin(request);
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw new RequestInputError(
      415,
      "INVALID_CONTENT_TYPE",
      "Send JSON with application/json.",
    );
  }
  const bytes = await readLimitedBody(request, JSON_BODY_LIMIT);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function readMultipartInput(request: Request): Promise<FormData> {
  assertSameOrigin(request);
  const contentType = request.headers.get("content-type") || "";
  if (
    contentType.split(";")[0].trim().toLowerCase() !== "multipart/form-data"
  ) {
    throw new RequestInputError(
      415,
      "INVALID_CONTENT_TYPE",
      "Send photos as multipart/form-data.",
    );
  }
  const bytes = await readLimitedBody(request, MULTIPART_BODY_LIMIT);
  try {
    return await new Response(Buffer.from(bytes), {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new RequestInputError(
      400,
      "INVALID_MULTIPART",
      "The photo upload could not be read.",
    );
  }
}
