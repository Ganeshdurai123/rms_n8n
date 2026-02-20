import { User } from '../modules/auth/auth.model.js';
import logger from './logger.js';

/**
 * Seed the default admin user on first boot.
 * Ensures there is always at least one admin to bootstrap the system.
 * Only creates the admin if no admin user exists in the database.
 */
export async function seedAdmin(): Promise<void> {
  try {
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      logger.info('Admin user already exists, skipping seed');
      return;
    }

    const adminEmail = 'admin@rms.local';
    const adminPassword = 'Admin123!@#';

    await User.create({
      email: adminEmail,
      password: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin',
    });

    logger.warn('========================================');
    logger.warn('  DEFAULT ADMIN USER CREATED');
    logger.warn(`  Email:    ${adminEmail}`);
    logger.warn(`  Password: ${adminPassword}`);
    logger.warn('  CHANGE THIS PASSWORD IMMEDIATELY!');
    logger.warn('========================================');
  } catch (err) {
    logger.error('Failed to seed admin user:', err);
    // Non-fatal: don't crash the server if seeding fails
  }
}
