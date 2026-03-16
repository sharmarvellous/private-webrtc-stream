export class VideoRepository {
  constructor(db) {
    this.db = db;
  }

  async findAccessibleByOwner(ownerUserId) {
    const data = await this.db.read();
    return data.videos.filter((video) => video.ownerUserId === ownerUserId);
  }

  async findById(id) {
    const data = await this.db.read();
    return data.videos.find((video) => video.id === id) ?? null;
  }
}
