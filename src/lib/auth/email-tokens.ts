import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export function hashEmailToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function consumeEmailToken(
  token: string,
  purpose: string,
  onConsume: (transaction: Prisma.TransactionClient, userId: string, now: Date) => Promise<void>,
  now = new Date(),
): Promise<boolean> {
  const tokenHash = hashEmailToken(token);
  return prisma.$transaction(async transaction => {
    const record = await transaction.emailToken.findFirst({
      where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } },
      select: { id: true, userId: true },
    });
    if (!record) return false;

    const consumed = await transaction.emailToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) return false;

    await onConsume(transaction, record.userId, now);
    return true;
  });
}
