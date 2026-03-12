/**
 * SKYDASH BANK — Store utilisateurs en mémoire
 * (Remplacer par PostgreSQL/MySQL en production)
 *
 * Structure conforme RGPD : séparation PII / données d'authentification
 */
'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { logger } = require('../utils/logger');

// Base utilisateurs en mémoire (simule une DB)
const users = new Map();
const failedAttempts = new Map();  // Suivi des tentatives échouées

/**
 * Crée un utilisateur avec mot de passe haché
 */
const createUser = async ({ email, password, firstName, lastName, role = 'client' }) => {
  const existingUser = findByEmail(email);
  if (existingUser) {
    throw new Error('EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);
  const userId = uuidv4();

  const user = {
    id: userId,
    email: email.toLowerCase().trim(),
    passwordHash,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    role,                          // 'client' | 'agent' | 'admin'
    mfaSecret: null,
    mfaEnabled: false,
    isActive: true,
    isLocked: false,
    lockedUntil: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
    lastLoginIp: null,
    passwordChangedAt: new Date().toISOString(),
  };

  users.set(userId, user);
  logger.info({ message: 'Utilisateur créé', userId, email: user.email, role });

  return sanitizeUser(user);
};

/**
 * Recherche par email (insensible à la casse)
 */
const findByEmail = (email) => {
  const emailNorm = email.toLowerCase().trim();
  for (const user of users.values()) {
    if (user.email === emailNorm) return user;
  }
  return null;
};

/**
 * Recherche par ID
 */
const findById = (userId) => users.get(userId) || null;

/**
 * Vérifie le mot de passe
 * Retourne l'utilisateur si valide, null sinon
 * Implémente le verrouillage après N tentatives (PCI-DSS Req. 8.3.4)
 */
const verifyPassword = async (email, password, ipAddress) => {
  const user = findByEmail(email);

  // Même délai si utilisateur inexistant (prévention timing attack)
  const dummyHash = '$2a$12$dummyhashfordummyusertopreventimenumeration123456789';
  if (!user) {
    await bcrypt.compare(password, dummyHash);
    return null;
  }

  // Vérification du verrouillage
  if (user.isLocked) {
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      throw new Error('ACCOUNT_LOCKED');
    }
    // Déverrouillage automatique après expiration
    user.isLocked = false;
    user.lockedUntil = null;
    resetFailedAttempts(user.email);
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    incrementFailedAttempts(user, ipAddress);
    return null;
  }

  // Succès : réinitialiser les tentatives
  resetFailedAttempts(user.email);
  user.lastLoginAt = new Date().toISOString();
  user.lastLoginIp = ipAddress;
  user.updatedAt = new Date().toISOString();

  return user;
};

/**
 * Incrémente les tentatives échouées et verrouille si seuil atteint
 */
const incrementFailedAttempts = (user, ipAddress) => {
  const key = user.email;
  const current = failedAttempts.get(key) || { count: 0, firstAttempt: new Date() };
  current.count += 1;
  current.lastIp = ipAddress;
  failedAttempts.set(key, current);

  logger.warn({
    message: 'Tentative de connexion échouée',
    email: user.email,
    attempt: current.count,
    ip: ipAddress,
  });

  if (current.count >= config.security.maxFailedAttempts) {
    user.isLocked = true;
    user.lockedUntil = new Date(
      Date.now() + config.security.lockoutDurationMinutes * 60 * 1000
    ).toISOString();
    user.updatedAt = new Date().toISOString();

    logger.warn({
      message: 'Compte verrouillé après trop de tentatives',
      userId: user.id,
      email: user.email,
      lockedUntil: user.lockedUntil,
    });
  }
};

const resetFailedAttempts = (email) => {
  failedAttempts.delete(email.toLowerCase().trim());
};

/**
 * Met à jour le secret MFA d'un utilisateur
 */
const updateMfaSecret = (userId, secret, enabled = false) => {
  const user = findById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  user.mfaSecret = secret;
  user.mfaEnabled = enabled;
  user.updatedAt = new Date().toISOString();
};

/**
 * Supprime les champs sensibles avant envoi au client
 * Principe de minimisation RGPD Art. 5(1)(c)
 */
const sanitizeUser = (user) => {
  const { passwordHash, mfaSecret, isLocked, lockedUntil, ...safeUser } = user;
  return safeUser;
};

// Création d'un compte admin de démonstration au démarrage
const initDemoData = async () => {
  try {
    await createUser({
      email: 'admin@skydash-bank.com',
      password: 'SkyDash@Admin2026!',
      firstName: 'Admin',
      lastName: 'SkyDash',
      role: 'admin',
    });

    await createUser({
      email: 'demo@skydash-bank.com',
      password: 'SkyDash@Demo2026!',
      firstName: 'Demo',
      lastName: 'Client',
      role: 'client',
    });

    logger.info({ message: 'Données de démo initialisées' });
  } catch (err) {
    // Ignoré si déjà créés
  }
};

initDemoData();

module.exports = {
  createUser,
  findByEmail,
  findById,
  verifyPassword,
  updateMfaSecret,
  sanitizeUser,
};
