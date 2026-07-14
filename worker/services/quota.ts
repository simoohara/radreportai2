import type { User } from '../types';

interface QuotaResult {
  canProceed: boolean;
  error?: string;
}

/**
 * Check if a user can generate and decrement their quota.
 * - Active subscribers: unlimited, just increment generations_used
 * - Free users: decrement generations_remaining
 * - Returns canProceed=false if no quota left (402 Payment Required)
 */
export async function checkAndDecrementQuota(
  db: D1Database,
  user: User
): Promise<QuotaResult> {
  const hasActiveSub =
    user.subscription_plan &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at) > new Date();

  if (hasActiveSub) {
    await db
      .prepare('UPDATE users SET generations_used = generations_used + 1 WHERE id = ?')
      .bind(user.id)
      .run();
    return { canProceed: true };
  }

  const remaining = user.generations_remaining || 0;
  if (remaining <= 0) {
    return { canProceed: false, error: 'Payment required' };
  }

  const isLastGeneration = remaining === 1;

  await db
    .prepare(
      'UPDATE users SET generations_remaining = generations_remaining - 1, generations_used = generations_used + 1 WHERE id = ?'
    )
    .bind(user.id)
    .run();

  if (isLastGeneration) {
    console.log(
      `User ${user.id} has used their last free generation. Upgrade email should be triggered.`
    );
    // Upgrade email will be triggered in Phase 9
  }

  return { canProceed: true };
}
