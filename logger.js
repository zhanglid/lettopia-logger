"use strict";

const winston = require("winston");
const { getEnv } = require("./utils");
const { LoggingWinston } = require("@google-cloud/logging-winston");
const colors = require("./colors");

const { format } = winston;
const env = getEnv();

/**
 * Gcloud Node app tracing
 */
if (env === "GcloudKube") {
  require("@google-cloud/trace-agent").start();
}

const myFormat = format.printf(info => {
  let str = `${colors.FgBlue}${info.timestamp} ${info.label} ${info.level}: ${
    info.message
  }`;
  if (info.timeUsage != null) {
    str += ` ${colors.FgYellow}${info.timeUsage} ms`;
  }
  if (info.stack != null) {
    str += `stack:
    ${colors.FgRed}${info.stack}`;
  }
  return str;
});

/**
 * Config transports for diffrent env
 */
const transportsConfig = {
  development: () => [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.label({ label: `[${env}]` }),
        format.timestamp(),
        format.splat(),
        myFormat
      )
    }),
    new winston.transports.File({
      filename: "combined.log",
      format: format.json()
    }),
    new winston.transports.File({
      filename: "error.log",
      level: "error",
      format: format.json()
    })
  ],
  production: () => [new winston.transports.Console(), new LoggingWinston()]
};
transportsConfig["GcloudKube"] = transportsConfig.production;

const logger = winston.createLogger({
  level: "info", //  Log only if info.level less than or equal to this level
  format: format.combine(format.errors({ stack: true }), format.timestamp()),
  defaultMeta: { env },
  transports: transportsConfig[env]()
});

/**
 *  parse info from request
 * @param {Object} req
 */
function reqParser(req) {
  return {
    requestUrl: req.url,
    requestMethod: req.method,
    remoteIp: req.connection.remoteAddress,
    payload: req.body,
    user: req && req.user && req.user.email
  };
}

/**
 *
 * @param {Object} res
 */
function resParser(res) {
  return {
    status: res.statusCode
  };
}

/**
 * request log handler
 */
logger.expressRequestHandler = function(req, res, next) {
  const start = Date.now();

  // normal finish request
  res.once("finish", () => {
    const httpRequest = reqParser(req);
    const timeUsage = Date.now() - start;
    logger.info(
      `${colors.FgGreen}${httpRequest.requestMethod} ${
        httpRequest.requestUrl
      } ${httpRequest.remoteIp} ${httpRequest.user || ""}`,
      {
        httpRequest,
        httpResponse: resParser(res),
        timeUsage,
        status: "finish"
      }
    );
  });

  // terminated request
  res.once("close", () => {
    const timeUsage = Date.now() - start;
    logger.info(`${req.method} ${req.url}`, {
      httpRequest: reqParser(req),
      httpResponse: resParser(res),
      timeUsage: timeUsage,
      status: "close"
    });
  });

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
