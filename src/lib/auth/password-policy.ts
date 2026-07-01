export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Za-z]/.test(password)) {
    return "Password must contain at least one letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }
  return null;
}

export function validateAdminSetPassword(password: string, confirmPassword: string): string | null {
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return validatePassword(password);
}
