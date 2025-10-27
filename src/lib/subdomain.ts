/**
 * Generates a URL-safe subdomain from an email address
 * @param email - User email address
 * @returns A URL-safe subdomain string with random suffix
 */
export function generateSubdomain(email: string): string {
  const username = email.split('@')[0];
  
  // Random suffix is 5 characters plus the hyphen separator (6 total)
  // So base subdomain should be max 57 characters to leave room for suffix
  const subdomain = username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 57); // Leave 6 characters for -xxxxx suffix
  
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${subdomain}-${randomSuffix}`;
}

/**
 * Validates that a subdomain is URL-safe
 * @param subdomain - The subdomain to validate
 * @returns True if the subdomain is valid, false otherwise
 */
export function isValidSubdomain(subdomain: string): boolean {
  // Check length (DNS subdomain limit is 63 characters)
  if (subdomain.length === 0 || subdomain.length > 63) {
    return false;
  }

  // Check that it contains only lowercase alphanumeric characters and hyphens
  const validPattern = /^[a-z0-9-]+$/;
  if (!validPattern.test(subdomain)) {
    return false;
  }

  // Check that it doesn't start or end with a hyphen
  if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
    return false;
  }

  return true;
}
