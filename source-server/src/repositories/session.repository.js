export class SessionRepository {
  constructor(db) {
    this.db = db;
  }

  async create(session) {
    await this.db.write((data) => {
      data.sessions.push(session);
      return data;
    });
    return session;
  }

  async findById(id) {
    const data = await this.db.read();
    return data.sessions.find((session) => session.id === id) ?? null;
  }

  async listForUser(user) {
    const data = await this.db.read();
    if (user.role === "source") {
      return data.sessions.filter((session) => session.sourceOwnerId === user.id);
    }

    return data.sessions.filter(
      (session) =>
        session.approvedViewerId === user.id ||
        session.pendingViewerId === user.id
    );
  }

  async update(sessionId, mutator) {
    let updated = null;
    await this.db.write((data) => {
      const index = data.sessions.findIndex((session) => session.id === sessionId);
      if (index === -1) {
        return data;
      }

      const session = structuredClone(data.sessions[index]);
      updated = mutator(session);
      data.sessions[index] = updated;
      return data;
    });
    return updated;
  }

  async expireSessions(nowIso) {
    const now = new Date(nowIso).getTime();
    const expiredIds = [];
    await this.db.write((data) => {
      data.sessions = data.sessions.map((session) => {
        if (session.status === "ended" || session.status === "expired") {
          return session;
        }

        if (new Date(session.expiresAt).getTime() <= now) {
          expiredIds.push(session.id);
          return {
            ...session,
            status: "expired",
            endedAt: nowIso,
            endReason: "expired_by_ttl"
          };
        }

        return session;
      });
      return data;
    });

    return expiredIds;
  }
}
