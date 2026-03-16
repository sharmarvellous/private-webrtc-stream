import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(serverRoot, ".env") });

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? `${fallback}`, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseCsv(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const nodeEnv = process.env.NODE_ENV ?? "development";

export const appConfig = {
  environment: {
    nodeEnv,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test"
  },
  http: {
    host: process.env.PUBLIC_HOST ?? "0.0.0.0",
    port: parseInteger(process.env.PORT, 5000),
    publicUrl: requireEnv(
      "PUBLIC_URL",
      `http://localhost:${parseInteger(process.env.PORT, 5000)}`
    ),
    allowedOrigins: unique([
      ...parseCsv(
        process.env.ALLOWED_ORIGINS ??
          process.env.CLIENT_ORIGIN ??
          "http://localhost:5000,http://127.0.0.1:5000,http://localhost:5173,http://127.0.0.1:5173"
      ),
      process.env.PUBLIC_URL ?? `http://localhost:${parseInteger(process.env.PORT, 5000)}`
    ])
  },
  auth: {
    jwtSecret: requireEnv("JWT_SECRET", "change-me-in-development"),
    jwtExpiresIn: requireEnv("JWT_EXPIRES_IN", "15m")
  },
  sessions: {
    defaultTtlMinutes: parseInteger(process.env.SESSION_DEFAULT_TTL_MINUTES, 30),
    maxTtlMinutes: parseInteger(process.env.SESSION_MAX_TTL_MINUTES, 120)
  },
  storage: {
    dataFile: path.resolve(serverRoot, process.env.DATA_FILE ?? "./data/db.json"),
    seedFile: path.resolve(serverRoot, process.env.SEED_FILE ?? "./data/seed.json")
  },
  dashboards: {
    sourceDistPath: path.resolve(
      serverRoot,
      process.env.SOURCE_DASHBOARD_DIST ?? "./ui/dist"
    )
  },
  logging: {
    level: process.env.LOG_LEVEL ?? "debug"
  },
  webrtc: {
    stunUrls: parseCsv(process.env.STUN_URLS ?? "stun:stun.l.google.com:19302"),
    turnUrls: parseCsv(process.env.TURN_URLS ?? ""),
    turnUsername: process.env.TURN_USERNAME ?? "",
    turnCredential: process.env.TURN_CREDENTIAL ?? ""
  }
};

// Legacy export kept for compatibility with the existing MVP modules.
export const env = {
  nodeEnv: appConfig.environment.nodeEnv,
  host: appConfig.http.host,
  port: appConfig.http.port,
  publicUrl: appConfig.http.publicUrl,
  allowedOrigins: appConfig.http.allowedOrigins,
  jwtSecret: appConfig.auth.jwtSecret,
  jwtExpiresIn: appConfig.auth.jwtExpiresIn,
  sessionDefaultTtlMinutes: appConfig.sessions.defaultTtlMinutes,
  sessionMaxTtlMinutes: appConfig.sessions.maxTtlMinutes,
  dataFile: appConfig.storage.dataFile,
  seedFile: appConfig.storage.seedFile,
  sourceDistPath: appConfig.dashboards.sourceDistPath,
  logLevel: appConfig.logging.level,
  stunUrls: appConfig.webrtc.stunUrls,
  turnUrls: appConfig.webrtc.turnUrls,
  turnUsername: appConfig.webrtc.turnUsername,
  turnCredential: appConfig.webrtc.turnCredential
};
