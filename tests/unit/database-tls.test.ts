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

async function connectWithCertificate(options: {
  trust: "none" | "server" | "other";
  hostnameMatches?: boolean;
  escapedPem?: boolean;
}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "feedy-tls-"));
  const sockets = new Set<net.Socket>();
  let server: net.Server | undefined;
  let client: ReturnType<typeof postgres> | undefined;
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
    client = postgres(url, {
      ...getDatabaseConnectionOptions(url, {
        DATABASE_CA_CERT: trustedCertificate,
      }),
      connect_timeout: 2,
      fetch_types: false,
      max: 1,
    });
    await client.unsafe("select 1").simple();
  } finally {
    if (client) await client.end({ timeout: 0 });
    for (const socket of sockets) socket.destroy();
    if (server?.listening)
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}

it("rejects an untrusted certificate even for a legacy require URL", async () => {
  await expect(connectWithCertificate({ trust: "none" })).rejects.toThrow(
    /self.signed|certificate/i,
  );
}, 15000);

it.each([false, true])(
  "accepts the configured CA with matching hostname (escaped PEM: %s)",
  async (escapedPem) => {
    await expect(
      connectWithCertificate({ trust: "server", escapedPem }),
    ).resolves.toBeUndefined();
  },
  15000,
);

it("rejects a different certificate despite having a configured CA", async () => {
  await expect(connectWithCertificate({ trust: "other" })).rejects.toThrow(
    /self.signed|certificate/i,
  );
}, 15000);

it("rejects a hostname mismatch even when the CA is trusted", async () => {
  await expect(
    connectWithCertificate({ trust: "server", hostnameMatches: false }),
  ).rejects.toThrow(/Hostname\/IP|altnames/i);
}, 15000);
