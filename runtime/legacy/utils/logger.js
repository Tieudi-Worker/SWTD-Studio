const pino = require('pino');
const path = require('path');

/**
 * Centralized structured logger for Handmade Media Agent.
 *
 * Usage:
 *   const { createLogger } = require('../utils/logger');
 *   const log = createLogger('Master');
 *   log.info({ sku: 'ABC', slot: 2 }, 'Generating in-use image');
 *
 * Environment:
 *   LOG_LEVEL  — pino level: fatal, error, warn, info (default), debug, trace
 *   LOG_FILE   — if set, also writes JSON logs to this path (e.g. output/pipeline.log)
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Streams: always console (pretty for humans) + optional file (JSON for machines)
function buildStreams() {
  const streams = [];

  // Console: human-readable with colors
  streams.push({
    level: LOG_LEVEL,
    stream: pino.destination({ fd: 1, sync: false })
  });

  // Optional file output: structured JSON
  if (process.env.LOG_FILE) {
    const logPath = path.resolve(process.env.LOG_FILE);
    streams.push({
      level: LOG_LEVEL,
      stream: pino.destination({ dest: logPath, sync: false, mkdir: true })
    });
  }

  return streams;
}

// Base pino instance (multistream if file logging enabled)
let baseLogger;

function getBase() {
  if (!baseLogger) {
    const streams = buildStreams();
    if (streams.length === 1) {
      baseLogger = pino({
        level: LOG_LEVEL,
        formatters: {
          level(label) { return { level: label }; }
        },
        timestamp: pino.stdTimeFunctions.isoTime
      }, streams[0].stream);
    } else {
      baseLogger = pino({
        level: LOG_LEVEL,
        formatters: {
          level(label) { return { level: label }; }
        },
        timestamp: pino.stdTimeFunctions.isoTime
      }, pino.multistream(streams));
    }
  }
  return baseLogger;
}

/**
 * Create a child logger bound to a module name.
 * @param {string} module - e.g. 'Master', 'KIE', 'Slot 3', 'A+ 2'
 * @param {Object} [bindings] - extra default fields, e.g. { sku: 'TNTD...' }
 */
function createLogger(module, bindings = {}) {
  return getBase().child({ module, ...bindings });
}

module.exports = { createLogger };
