import mongoose from 'mongoose';
import { AgentReport } from '../modules/agent-reports/agent-report.model';
import { User } from '../modules/users/user.model';
import { env } from './env';

/**
 * Older schemas used `aadhaarFingerprint: { index: true }` (non-unique
 * `aadhaarFingerprint_1`). Current schema wants the same key unique — Mongo
 * rejects createIndex with IndexKeySpecsConflict. Drop the non-unique one first.
 *
 * Also rewrite duplicate fingerprints (legacy seed/test data) so the unique
 * index can build; keep the oldest document per fingerprint.
 */
async function reconcileUserAadhaarIndex(): Promise<void> {
  const indexes = await User.collection.indexes();
  const existing = indexes.find((idx) => idx.name === 'aadhaarFingerprint_1');
  if (existing && !existing.unique) {
    await User.collection.dropIndex('aadhaarFingerprint_1');
    console.log(
      '[indexes] Dropped non-unique aadhaarFingerprint_1 (will recreate as unique)'
    );
  }

  const dups = await User.collection
    .aggregate<{
      _id: string;
      ids: { id: mongoose.Types.ObjectId; createdAt?: Date }[];
    }>([
      {
        $group: {
          _id: '$aadhaarFingerprint',
          ids: {
            $push: { id: '$_id', createdAt: '$createdAt' },
          },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();

  for (const group of dups) {
    const sorted = [...group.ids].sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return at - bt;
    });
    const [, ...extras] = sorted;
    for (const extra of extras) {
      const nextFp = `legacy-dup:${extra.id.toString()}:${group._id}`;
      await User.collection.updateOne(
        { _id: extra.id },
        { $set: { aadhaarFingerprint: nextFp } }
      );
      console.warn(
        `[indexes] Rewrote duplicate aadhaarFingerprint on user ${extra.id.toString()} (kept oldest)`
      );
    }
  }
}

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  console.log('MongoDB connected');

  try {
    await reconcileUserAadhaarIndex();
    await User.syncIndexes();
  } catch (err) {
    console.warn('[indexes] User.syncIndexes warning:', err);
  }
  try {
    await AgentReport.syncIndexes();
  } catch (err) {
    console.warn('[indexes] AgentReport.syncIndexes warning:', err);
  }
}
