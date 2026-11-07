import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DAY_MS = 86_400_000;
const DELETE_BATCH_SIZE = 1000;

export function selectExpiredKeys(objects, now, retentionDays) {
  const cutoff = now - retentionDays * DAY_MS;
  return objects.filter((object) => Date.parse(object.LastModified) < cutoff).map((object) => object.Key);
}

const aws = (args) => execFileSync('aws', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

function listAssets(bucket) {
  const output = aws(['s3api', 'list-objects-v2', '--bucket', bucket, '--prefix', 'assets/', '--query', 'Contents[].{Key:Key,LastModified:LastModified}', '--output', 'json']);
  return JSON.parse(output || 'null') ?? [];
}

function deleteKeys(bucket, keys) {
  for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
    const objects = keys.slice(start, start + DELETE_BATCH_SIZE).map((Key) => ({ Key }));
    aws(['s3api', 'delete-objects', '--bucket', bucket, '--delete', JSON.stringify({ Objects: objects, Quiet: true })]);
  }
}

function main(bucket, retentionDaysArg) {
  const retentionDays = Number(retentionDaysArg);
  if (!bucket || !Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error('Usage: node scripts/prune-assets.mjs <bucket> <retention-days>');
  }
  const expired = selectExpiredKeys(listAssets(bucket), Date.now(), retentionDays);
  deleteKeys(bucket, expired);
  console.log(`Pruned ${expired.length} asset(s) older than ${retentionDays} days from s3://${bucket}/assets/`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2], process.argv[3]);
