const levelOrder = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

function serializeMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return {};
  }

  if (meta instanceof Error) {
    return {
      errorName: meta.name,
      errorMessage: meta.message,
      errorStack: meta.stack
    };
  }

  return meta;
}

export function createLogger({ level = "info", baseContext = {} } = {}) {
  function shouldLog(messageLevel) {
    return levelOrder[messageLevel] <= levelOrder[level];
  }

  function write(messageLevel, message, meta = {}) {
    if (!shouldLog(messageLevel)) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level: messageLevel,
      message,
      ...baseContext,
      ...serializeMeta(meta)
    };

    const serialized = JSON.stringify(payload);
    if (messageLevel === "error") {
      console.error(serialized);
      return;
    }

    console.log(serialized);
  }

  return {
    child(context = {}) {
      return createLogger({
        level,
        baseContext: {
          ...baseContext,
          ...context
        }
      });
    },
    error(message, meta) {
      write("error", message, meta);
    },
    warn(message, meta) {
      write("warn", message, meta);
    },
    info(message, meta) {
      write("info", message, meta);
    },
    debug(message, meta) {
      write("debug", message, meta);
    }
  };
}
