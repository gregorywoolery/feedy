// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import postgres from "postgres";
import { expect, it } from "vitest";
import {
  getDatabaseConnectionOptions,
  getDatabaseUrl,
} from "@/lib/database/config";

it("rejects an untrusted database certificate even for a legacy require URL", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "feedy-tls-"));
  const sockets = new Set<net.Socket>();
  let server: net.Server | undefined;
  let client: ReturnType<typeof postgres> | undefined;
  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        path.join(directory, "key.pem"),
        "-out",
        path.join(directory, "cert.pem"),
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
      ],
      { stdio: "ignore" },
    );
    const context = tls.createSecureContext({
      key: await readFile(path.join(directory, "key.pem")),
      cert: await readFile(path.join(directory, "cert.pem")),
    });
    server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.once("data", () => {
        socket.write("S"); // PostgreSQL accepts the client's SSL request.
        const secure = new tls.TLSSocket(socket, {
          isServer: true,
          secureContext: context,
        });
        secure.on("error", () => secure.destroy());
      });
    });
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as net.AddressInfo;
    const url = getDatabaseUrl({
      DATABASE_URL: `postgresql://test:test@127.0.0.1:${address.port}/test?sslmode=require`,
    });
    client = postgres(url, {
      ...getDatabaseConnectionOptions(url, {}),
      connect_timeout: 2,
      max: 1,
    });
    await expect(client`select 1`).rejects.toThrow(/self.signed|certificate/i);
  } finally {
    if (client) await client.end({ timeout: 0 });
    for (const socket of sockets) socket.destroy();
    if (server?.listening)
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
