import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logsDir = join(__dirname, "logs");
const logFilePath = join(logsDir, "service.log");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

fs.openSync(logFilePath, "a").close();

function formatLog(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaString = meta ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}] ${message}${metaString}`;
}

function writeLog(entry) {
  try {
    fs.appendFileSync(logFilePath, `${entry}\n`);
  } catch {
    // Ignore logging failures to avoid breaking the service.
  }
}

function sanitizeHeaders(headers) {
  const safeHeaders = { ...headers };

  if (safeHeaders.authorization) {
    safeHeaders.authorization = "[REDACTED]";
  }
  if (safeHeaders["x-api-key"]) {
    safeHeaders["x-api-key"] = "[REDACTED]";
  }

  return safeHeaders;
}

export const logger = {
  info(message, meta) {
    writeLog(formatLog("INFO", message, meta));
  },
  warn(message, meta) {
    writeLog(formatLog("WARN", message, meta));
  },
  error(message, meta) {
    writeLog(formatLog("ERROR", message, meta));
  },
  request(req) {
    this.info("incoming request", {
      method: req.method,
      path: req.originalUrl,
      headers: sanitizeHeaders(req.headers),
      query: req.query,
      remoteAddress: req.ip || req.socket.remoteAddress,
    });
  },
  response(req, res, durationMs) {
    this.info("request completed", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  },
};
