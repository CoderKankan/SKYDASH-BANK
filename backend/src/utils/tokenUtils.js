/**
 * SKYDASH BANK — Gestion sécurisée des tokens JWT
 * Conformité OWASP JWT Security Cheat Sheet
 */
'use strict';

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { logger } = require('./logger');

// Store en mémoire pour les refresh tokens (remplacer par Redis en production)
const refreshTokenStore = new Map();

/**
 * Génère un access token JWT (durée courte : 15min)
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    {
      sub: payload.userId,
      role: payload.role,
      email: payload.email,
      jti: uuidv4(),         // Identifiant unique du token (permet révocation)
      iat: Math.floor(Date.now() / 1000),
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
      issuer: 'skydash-bank',
      audience: 'skydash-bank-client',
      algorithm: 'HS256',
    }
  );
};

/**
 * Génère un refresh token opaque (durée longue : 7j)
 * Stocké côté serveur pour permettre la révocation
 */
const generateRefreshToken = (userId) => {
  const token = uuidv4() + '-' + uuidv4(); // 72 caractères aléatoires
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  refreshTokenStore.set(token, {
    userId,
    expiresAt,
    createdAt: new Date(),
  });

  return token;
};

/**
 * Valide et retourne les données d'un access token
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.secret, {
    issuer: 'skydash-bank',
    audience: 'skydash-bank-client',
    algorithms: ['HS256'],
  });
};

/**
 * Valide un refresh token et retourne le userId associé
 */
const verifyRefreshToken = (token) => {
  const data = refreshTokenStore.get(token);
  if (!data) return null;
  if (new Date() > data.expiresAt) {
    refreshTokenStore.delete(token);
    return null;
  }
  return data.userId;
};

/**
 * Révoque un refresh token (déconnexion)
 */
const revokeRefreshToken = (token) => {
  refreshTokenStore.delete(token);
};

/**
 * Révoque tous les refresh tokens d'un utilisateur (déconnexion globale)
 */
const revokeAllUserTokens = (userId) => {
  for (const [token, data] of refreshTokenStore.entries()) {
    if (data.userId === userId) {
      refreshTokenStore.delete(token);
    }
  }
};

// Nettoyage automatique des tokens expirés (toutes les heures)
setInterval(() => {
  const now = new Date();
  let cleaned = 0;
  for (const [token, data] of refreshTokenStore.entries()) {
    if (now > data.expiresAt) {
      refreshTokenStore.delete(token);
      cleaned++;
    }
  }
  if (cleaned > 0) logger.info({ message: `Nettoyage tokens expirés: ${cleaned} supprimés` });
}, 60 * 60 * 1000);

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
