export function uuidV7ForTest(timestampMs: number, random: number): string {
  // Clamp timestamp to 48 bits
  const ts = BigInt(timestampMs) & ((1n << 48n) - 1n);
  // Clamp random to 74 bits (the remaining space after version/variant)
  const rand = BigInt(random) & ((1n << 74n) - 1n);

  // Build 128-bit value
  let uuid = ts << 80n; // put timestamp in high 48 bits
  uuid |= 0x7n << 76n; // version = 7
  uuid |= rand << 2n; // fill random bits, leaving space for variant
  uuid |= 0x2n; // variant = 10x (RFC 9562)

  // Format as UUID string
  const hex = uuid.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
