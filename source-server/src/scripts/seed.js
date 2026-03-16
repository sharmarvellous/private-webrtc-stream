import { env } from "../config/env.js";
import { FileDatabase } from "../utils/file-db.js";

const db = new FileDatabase({
  dataFile: env.dataFile,
  seedFile: env.seedFile
});

await db.init();
console.log(`Seeded database at ${env.dataFile}`);
