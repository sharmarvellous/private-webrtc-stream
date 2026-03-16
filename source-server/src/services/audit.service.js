import { v4 as uuidv4 } from "uuid";

export class AuditService {
  constructor({ auditLogRepository, logger }) {
    this.auditLogRepository = auditLogRepository;
    this.logger = logger;
  }

  async log(eventType, payload) {
    const entry = {
      id: uuidv4(),
      eventType,
      createdAt: new Date().toISOString(),
      ...payload
    };

    this.logger.info(eventType, payload);
    await this.auditLogRepository.append(entry);
    return entry;
  }
}
