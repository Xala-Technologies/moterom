/** Norwegian organisation number: 9 digits with Modulus-11 check. */

export function normalizeOrgNumber(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/\D/g, "");
}

export function isValidOrgNumber(raw: string): boolean {
  const digits = normalizeOrgNumber(raw);
  if (!/^\d{9}$/.test(digits)) return false;
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(digits[i]) * weights[i];
  const rem = sum % 11;
  const check = rem === 0 ? 0 : 11 - rem;
  if (check === 10) return false;
  return check === Number(digits[8]);
}

export function formatOrgNumber(raw: string): string {
  const digits = normalizeOrgNumber(raw);
  if (digits.length !== 9) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
