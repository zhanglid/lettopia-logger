"use strict";

const winston = require("winston");
const { getEnv } = require("./utils");
const { LoggingWinston } = require("@google-cloud/logging-winston");

const { format } = winston;

/**
 * Gcloud Node app tracing
 */
if (getEnv() === "GcloudKube") {
  require("@google-cloud/trace-agent").start();
}

/**
 * Config transports for diffrent env
 */
const transportsConfig = {
  development: () => [
    new winston.transports.Console({ timestamp: true }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.File({ filename: "error.log", level: "error" })
  ],
  production: () => [new winston.transports.Console(), new LoggingWinston()]
};
transportsConfig["GcloudKube"] = transportsConfig.production;

const env = getEnv();
const logger = winston.createLogger({
  level: "info", //  Log only if info.level less than or equal to this level
  format: format.combine(
    format.errors({ stack: true }),
    format.timestamp(),
    format.json()
  ),
  defaultMeta: { env },
  transports: transportsConfig[env]()
});

/**
 *  parse info from request
 * @param {Object} req
 */
function reqParser(req) {
  return {
    status: req.statusCode,
    requestUrl: req.url,
    requestMethod: req.method,
    remoteIp: req.connection.remoteAddress
  };
}

/**
 * request log handler
 */
logger.expressRequestHandler = function(req, res, next) {
  logger.info(`${req.method} ${req.url}`, { httpRequest: reqParser(req) });
  next();
};

/**
 * request error log handler
 */
logger.expressErrorHandler = function(err, req, res, next) {
  logger.error(err, {
    httpRequest: reqParser(req)
  });
  next();
};

/**
 * log UncaughtException, UnhandledRejection
 */

logger.listenUnhandle = function() {
  process.on("uncaughtException", err =>
    this.error("uncaught exception: ", err)
  );
  process.on("unhandledRejection", err =>
    this.error("uncaught rejection: ", err)
  );
};

module.exports = logger;
