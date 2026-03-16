export class UserRepository {
  constructor(db) {
    this.db = db;
  }

  async findByEmail(email) {
    const data = await this.db.read();
    return data.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async findById(id) {
    const data = await this.db.read();
    return data.users.find((user) => user.id === id) ?? null;
  }

  async listByRole(role) {
    const data = await this.db.read();
    return data.users.filter((user) => user.role === role);
  }
}
