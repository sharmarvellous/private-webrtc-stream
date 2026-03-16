export class AuditLogRepository {
  constructor(db) {
    this.db = db;
  }

  async append(entry) {
    await this.db.write((data) => {
      data.auditLogs.push(entry);
      return data;
    });
    return entry;
  }
}
