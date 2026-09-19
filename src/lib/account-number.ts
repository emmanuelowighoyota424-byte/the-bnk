import { randomInt } from 'crypto';

const ACCOUNT_NUMBER_LENGTH = 12;

/** Generate a customer account number; uniqueness is enforced by the database. */
export function generateAccountNumber(): string {
  let value = '';
  for (let i = 0; i < ACCOUNT_NUMBER_LENGTH; i++) {
    value += randomInt(0, 10).toString();
  }
  return value;
}
