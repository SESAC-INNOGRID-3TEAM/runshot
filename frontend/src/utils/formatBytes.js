export function formatBytes(bytes) {
  if (!bytes) return "0MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  return `${mb.toFixed(1)}MB`;
}
