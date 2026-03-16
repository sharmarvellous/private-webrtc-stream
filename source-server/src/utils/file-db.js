import fs from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "./password.js";

export class FileDatabase {
  constructor({ dataFile, seedFile }) {
    this.dataFile = dataFile;
    this.seedFile = seedFile;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.dataFile), { recursive: true });

    try {
      await fs.access(this.dataFile);
    } catch {
      const seedRaw = await fs.readFile(this.seedFile, "utf8");
      const seedData = JSON.parse(seedRaw);
      const normalized = await this.normalizeSeed(seedData);
      await fs.writeFile(this.dataFile, JSON.stringify(normalized, null, 2));
    }
  }

  async normalizeSeed(seedData) {
    const users = await Promise.all(
      (seedData.users ?? []).map(async (user) => {
        if (user.passwordHash) {
          return user;
        }

        return {
          id: user.id,
          email: user.email,
          passwordHash: await hashPassword(user.password),
          role: user.role,
          displayName: user.displayName,
          createdAt: user.createdAt ?? new Date().toISOString()
        };
      })
    );

    return {
      users,
      videos: seedData.videos ?? [],
      sessions: seedData.sessions ?? [],
      auditLogs: seedData.auditLogs ?? []
    };
  }

  async read() {
    const raw = await fs.readFile(this.dataFile, "utf8");
    return JSON.parse(raw);
  }

  async write(mutator) {
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const current = await this.read();
      const next = await mutator(structuredClone(current));
      await fs.writeFile(this.dataFile, JSON.stringify(next, null, 2));
      return next;
    });

    return this.writeQueue;
  }
}
