// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import postgres from "postgres";
import { Pool } from "pg";
import { expect, it } from "vitest";
import {
  getDatabaseConnectionOptions,
  getDatabasePoolOptions,
  getDatabaseUrl,
} from "@/lib/database/config";

async function connectWithCertificate(options: {
  trust: "none" | "server" | "other";
  hostnameMatches?: boolean;
  escapedPem?: boolean;
  driver: "postgres" | "pg";
  stalledQuery?: boolean;
}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "feedy-tls-"));
  const sockets = new Set<net.Socket>();
  let server: net.Server | undefined;
  let client: ReturnType<typeof postgres> | undefined;
  let pool: Pool | undefined;
  function createCertificate(name: string, subjectAltName: string) {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        path.join(directory, name + ".key"),
        "-out",
        path.join(directory, name + ".crt"),
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=" + subjectAltName,
      ],
      { stdio: "ignore" },
    );
  }
  try {
    createCertificate(
      "server",
      options.hostnameMatches === false ? "DNS:other.example" : "IP:127.0.0.1",
    );
    const certificate = await readFile(
      path.join(directory, "server.crt"),
      "utf8",
    );
    const context = tls.createSecureContext({
      key: await readFile(path.join(directory, "server.key")),
      cert: certificate,
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
        secure.once("data", () => {
          // AuthenticationOk and ReadyForQuery complete the startup handshake.
          secure.write(
            Buffer.from([82, 0, 0, 0, 8, 0, 0, 0, 0, 90, 0, 0, 0, 5, 73]),
          );
          secure.on("data", () => {
            if (options.stalledQuery) return;
            // Finish a simple query with CommandComplete and ReadyForQuery.
            secure.write(
              Buffer.concat([
                Buffer.from([67, 0, 0, 0, 13]),
                Buffer.from("SELECT 0\0"),
                Buffer.from([90, 0, 0, 0, 5, 73]),
              ]),
            );
          });
        });
      });
    });
    let trustedCertificate: string | undefined;
    if (options.trust === "server") trustedCertificate = certificate;
    if (options.trust === "other") {
      createCertificate("other", "IP:127.0.0.1");
      trustedCertificate = await readFile(
        path.join(directory, "other.crt"),
        "utf8",
      );
    }
    if (options.escapedPem)
      trustedCertificate = trustedCertificate?.replaceAll("\n", "\\n");
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as net.AddressInfo;
    const url = getDatabaseUrl({
      DATABASE_URL: `postgresql://test:test@127.0.0.1:${address.port}/test?sslmode=require`,
    });
    const environment = { DATABASE_CA_CERT: trustedCertificate };
    if (options.driver === "pg") {
      pool = new Pool({
        ...getDatabasePoolOptions(url, environment),
        connectionTimeoutMillis: 2000,
        query_timeout: 200,
        max: 1,
      });
      await pool.query("select 1");
    } else {
      client = postgres(url, {
        ...getDatabaseConnectionOptions(url, environment),
        connect_timeout: 2,
        fetch_types: false,
        max: 1,
      });
      await client.unsafe("select 1").simple();
    }
  } finally {
    if (client) await client.end({ timeout: 0 });
    if (pool) await pool.end();
    for (const socket of sockets) socket.destroy();
    if (server?.listening)
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}

it.each(["postgres", "pg"] as const)(
  "%s rejects an untrusted certificate even for a legacy require URL",
  async (driver) => {
    await expect(
      connectWithCertificate({ trust: "none", driver }),
    ).rejects.toThrow(/self.signed|certificate/i);
  },
  15000,
);

it.each([
  ["postgres", false],
  ["postgres", true],
  ["pg", false],
  ["pg", true],
] as const)(
  "%s accepts the configured CA with matching hostname (escaped PEM: %s)",
  async (driver, escapedPem) => {
    await expect(
      connectWithCertificate({ trust: "server", escapedPem, driver }),
    ).resolves.toBeUndefined();
  },
  15000,
);

it.each(["postgres", "pg"] as const)(
  "%s rejects a different certificate despite having a configured CA",
  async (driver) => {
    await expect(
      connectWithCertificate({ trust: "other", driver }),
    ).rejects.toThrow(/self.signed|certificate/i);
  },
  15000,
);

it.each(["postgres", "pg"] as const)(
  "%s rejects a hostname mismatch even when the CA is trusted",
  async (driver) => {
    await expect(
      connectWithCertificate({
        trust: "server",
        hostnameMatches: false,
        driver,
      }),
    ).rejects.toThrow(/Hostname\/IP|altnames/i);
  },
  15000,
);

it("the runtime pool times out a stalled query", async () => {
  await expect(
    connectWithCertificate({
      trust: "server",
      driver: "pg",
      stalledQuery: true,
    }),
  ).rejects.toThrow(/timeout/i);
}, 15000);
