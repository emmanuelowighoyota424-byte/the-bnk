/** Email delivery adapter intentionally disabled until an approved provider is configured. */

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  timestamp: Date
}

function disabled(): EmailResult {
  return { success: false, error: 'Email delivery is not configured.', timestamp: new Date() }
}

export async function sendOTPEmail(..._args: unknown[]): Promise<EmailResult> { return disabled() }
export async function sendLoginAlertEmail(..._args: unknown[]): Promise<EmailResult> { return disabled() }
export async function sendSecurityAlertEmail(..._args: unknown[]): Promise<EmailResult> { return disabled() }
export async function send2FACodeEmail(..._args: unknown[]): Promise<EmailResult> { return disabled() }
export async function sendWelcomeEmail(..._args: unknown[]): Promise<EmailResult> { return disabled() }
export async function sendPasswordResetEmail(..._args: unknown[]): Promise<EmailResult> { return disabled() }
