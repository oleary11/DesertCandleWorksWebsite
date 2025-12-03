/**
 * Centralized validation utilities
 */

export type ValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; error: string };

/**
 * Validates and normalizes email addresses
 * - Prevents injection attacks with strict regex
 * - Enforces RFC 5321 length limits
 * - Rejects dangerous characters and patterns
 */
export function validateEmail(email: string): ValidationResult {
  // Normalize: trim and lowercase
  const normalized = email.trim().toLowerCase();

  // Length check (RFC 5321: max 254 characters for entire address)
  if (normalized.length === 0) {
    return { valid: false, error: "Email is required" };
  }
  if (normalized.length > 254) {
    return { valid: false, error: "Email is too long" };
  }

  // Reject emails with dangerous characters that could be used for injection
  if (/[<>(){}\[\]\\;,]/.test(normalized)) {
    return { valid: false, error: "Email contains invalid characters" };
  }

  // Strict email regex (more restrictive than basic validation)
  // Allows: letters, numbers, dots, hyphens, underscores, plus signs
  // Must have exactly one @ symbol, domain must have at least one dot
  const emailRegex = /^[a-z0-9._+%-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  if (!emailRegex.test(normalized)) {
    return { valid: false, error: "Invalid email format" };
  }

  // Split into local and domain parts
  const [local, domain] = normalized.split("@");

  // Local part (before @) must be 1-64 characters
  if (local.length === 0 || local.length > 64) {
    return { valid: false, error: "Invalid email format" };
  }

  // Domain part must be 1-255 characters
  if (domain.length === 0 || domain.length > 255) {
    return { valid: false, error: "Invalid email format" };
  }

  // Reject consecutive dots (invalid per RFC)
  if (normalized.includes("..")) {
    return { valid: false, error: "Invalid email format" };
  }

  // Reject emails starting or ending with dot
  if (local.startsWith(".") || local.endsWith(".")) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true, normalized };
}

/**
 * Common weak passwords to reject
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "12345678",
  "qwerty",
  "abc123",
  "letmein",
  "welcome",
  "monkey",
  "1234567890",
  "password1",
  "iloveyou",
  "admin",
  "admin123",
  "root",
  "toor",
  "pass",
  "test",
  "guest",
  "user",
  "default",
]);

/**
 * Validates password strength
 * - Minimum 8 characters
 * - Must contain mix of uppercase, lowercase, and numbers
 * - Rejects common weak passwords
 */
export function validatePassword(password: string): ValidationResult {
  // Length check
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }

  if (password.length > 128) {
    return { valid: false, error: "Password is too long" };
  }

  // Complexity requirements
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const complexityCount = [hasLowercase, hasUppercase, hasNumber].filter(Boolean).length;

  if (complexityCount < 2) {
    return {
      valid: false,
      error: "Password must contain at least 2 of: lowercase, uppercase, numbers",
    };
  }

  // Check against common passwords
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    return { valid: false, error: "Password is too common. Please choose a stronger password" };
  }

  // Check for simple patterns
  if (/^(.)\1+$/.test(password)) {
    // All same character
    return { valid: false, error: "Password is too simple" };
  }

  if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i.test(password)) {
    // Sequential characters
    return { valid: false, error: "Password is too simple" };
  }

  return { valid: true, normalized: password };
}
