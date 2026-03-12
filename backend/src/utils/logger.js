/**
 * SKYDASH BANK — Système de logging sécurisé
 * Conformité PCI-DSS Req. 10 & ISO 27001 A.12.4
 *
 * Logs structurés JSON avec rotation quotidienne
 * Audit trail immuable pour toutes les actions sensibles
 */
'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../config');
const fs = require('fs');

// Création du répertoire de logs si inexistant
const logDir = path.resolve(config.log.dir);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Format JSON structuré pour ingestion SIEM
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Transport fichier avec rotation quotidienne (PCI-DSS : conservation 12 mois)
const fileTransport = new DailyRotateFile({
  dirname: logDir,
  filename: 'skydash-bank-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '365d',   // Conservation 1 an — PCI-DSS Req. 10.7
  zippedArchive: true,
  format: jsonFormat,
});

// Transport audit trail séparé (append-only)
const auditTransport = new DailyRotateFile({
  dirname: path.join(logDir, 'audit'),
  filename: 'audit-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '100m',
  maxFiles: '365d',
  zippedArchive: true,
  format: jsonFormat,
  level: 'info',
});

// Transport erreurs critiques
const errorTransport = new DailyRotateFile({
  dirname: path.join(logDir, 'errors'),
  filename: 'errors-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '365d',
  zippedArchive: true,
  format: jsonFormat,
  level: 'error',
});

const logger = winston.createLogger({
  level: config.log.level,
  format: jsonFormat,
  defaultMeta: {
    service: 'skydash-bank-api',
    environment: config.env,
  },
  transports: [
    fileTransport,
    errorTransport,
    // Console uniquement en développement
    ...(config.env !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      })
    ] : []),
  ],
});

// Logger d'audit séparé
const auditLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { service: 'skydash-bank-audit' },
  transports: [auditTransport],
});

/**
 * Enregistre un événement d'audit de sécurité
 * Format conforme PCI-DSS Req. 10.3
 */
const audit = (eventType, data) => {
  const entry = {
    eventType,
    timestamp: new Date().toISOString(),
    ...data,
    // Masquage des données sensibles
    password: undefined,
    token: undefined,
    secret: undefined,
  };
  auditLogger.info(entry);
  logger.info({ audit: true, ...entry });
};

module.exports = { logger, audit };
