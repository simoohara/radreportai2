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
  const isUnlimited = user.generations_remaining === null;

  if (isUnlimited) {
    await db
      .prepare('UPDATE users SET generations_used = generations_used + 1 WHERE id = ?')
      .bind(user.id)
      .run();
    return { canProceed: true };
  }

  // Atomic decrement: Only updates if generations_remaining > 0
  const result = await db
    .prepare(
      'UPDATE users SET generations_remaining = generations_remaining - 1, generations_used = generations_used + 1 WHERE id = ? AND generations_remaining > 0 RETURNING generations_remaining'
    )
    .bind(user.id)
    .all<{ generations_remaining: number }>();

  if (!result.success || result.results.length === 0) {
    return { canProceed: false, error: 'Payment required' };
  }

  const newRemaining = result.results[0].generations_remaining;
  const isLastGeneration = newRemaining === 0;

  if (isLastGeneration) {
    console.log(
      `User ${user.id} has used their last free generation. Upgrade email should be triggered.`
    );
    // Upgrade email will be triggered in Phase 9
  }

  return { canProceed: true };
}

/** Undo a quota charge when the upstream AI provider fails before producing a result. */
export async function refundQuota(db: D1Database, user: User): Promise<void> {
  const isUnlimited = user.generations_remaining === null;

  if (isUnlimited) {
    await db
      .prepare('UPDATE users SET generations_used = MAX(generations_used - 1, 0) WHERE id = ?')
      .bind(user.id)
      .run();
    return;
  }

  await db
    .prepare(
      'UPDATE users SET generations_remaining = generations_remaining + 1, generations_used = MAX(generations_used - 1, 0) WHERE id = ?'
    )
    .bind(user.id)
    .run();
}

/**
 * Check if a user can transcribe and decrement their quota.
 * - Active subscribers: unlimited, just increment transcriptions_used
 * - Free users: decrement transcriptions_remaining
 */
export async function checkAndDecrementTranscriptionQuota(
  db: D1Database,
  user: User
): Promise<QuotaResult> {
  const isUnlimited = user.transcriptions_remaining === null;

  if (isUnlimited) {
    await db
      .prepare('UPDATE users SET transcriptions_used = transcriptions_used + 1 WHERE id = ?')
      .bind(user.id)
      .run();
    return { canProceed: true };
  }

  // Atomic decrement: Only updates if transcriptions_remaining > 0
  const result = await db
    .prepare(
      'UPDATE users SET transcriptions_remaining = transcriptions_remaining - 1, transcriptions_used = transcriptions_used + 1 WHERE id = ? AND transcriptions_remaining > 0 RETURNING transcriptions_remaining'
    )
    .bind(user.id)
    .all<{ transcriptions_remaining: number }>();

  if (!result.success || result.results.length === 0) {
    return { canProceed: false, error: 'Vous avez utilisé toutes vos dictées gratuites. Veuillez passer à un forfait payant pour continuer.' };
  }

  return { canProceed: true };
}

/** Undo a transcription quota charge when the upstream AI provider fails. */
export async function refundTranscriptionQuota(db: D1Database, user: User): Promise<void> {
  const isUnlimited = user.transcriptions_remaining === null;

  if (isUnlimited) {
    await db
      .prepare('UPDATE users SET transcriptions_used = MAX(transcriptions_used - 1, 0) WHERE id = ?')
      .bind(user.id)
      .run();
    return;
  }

  await db
    .prepare(
      'UPDATE users SET transcriptions_remaining = transcriptions_remaining + 1, transcriptions_used = MAX(transcriptions_used - 1, 0) WHERE id = ?'
    )
    .bind(user.id)
    .run();
}
