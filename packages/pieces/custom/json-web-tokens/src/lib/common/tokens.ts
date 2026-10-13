import jwt, { JwtHeader } from 'jsonwebtoken';
import { JwtAlgorithm } from './algorithms';
import { JwtConnection, keys } from './keys';
import { values } from './values';

function decode(token: unknown): DecodedToken {
  const text = values.readText(token);
  const parts = text.split('.');
  if (parts.length !== 3) {
    throw new Error(MESSAGES.notValid);
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  if (!SEGMENT.test(headerPart) || !SEGMENT.test(payloadPart) || !SIGNATURE.test(signaturePart)) {
    throw new Error(MESSAGES.notValid);
  }
  const header = values.parseJson(Buffer.from(headerPart, 'base64url').toString('utf8'));
  const payload = values.parseJson(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  if (!values.isRecord(header) || typeof header['alg'] !== 'string' || !values.isRecord(payload)) {
    throw new Error(MESSAGES.notValid);
  }
  return { token: text, header, payload };
}

function buildHeader({
  algorithm,
  extraFields,
  keyId,
}: {
  algorithm: JwtAlgorithm;
  extraFields: Record<string, unknown>;
  keyId: string;
}): JwtHeader {
  const extra = Object.fromEntries(Object.entries(extraFields).filter(([name]) => name !== 'alg'));
  const header: JwtHeader = { alg: algorithm, typ: 'JWT' };
  return Object.assign(header, extra, keyId === '' ? {} : { kid: keyId });
}

function sign({
  connection,
  payload,
  header,
}: {
  connection: JwtConnection;
  payload: Record<string, unknown>;
  header: JwtHeader;
}): string {
  const signingKey = keys.requireSigningKey(connection);
  try {
    return jwt.sign(payload, signingKey, { algorithm: connection.algorithm, header });
  } catch {
    throw new Error(
      `The connection's key could not sign a token with ${connection.algorithm}. Check that the key and the algorithm belong together.`,
    );
  }
}

function verify({
  connection,
  token,
  options,
}: {
  connection: JwtConnection;
  token: string;
  options: VerifyChecks;
}): void {
  try {
    jwt.verify(token, connection.verifyingKey, {
      algorithms: [connection.algorithm],
      audience: options.audience === '' ? undefined : options.audience,
      issuer: options.issuer === '' ? undefined : options.issuer,
      ignoreExpiration: options.ignoreExpiration,
      ignoreNotBefore: options.ignoreNotBefore,
      clockTolerance: options.clockTolerance,
      clockTimestamp: options.clockTimestamp,
    });
  } catch (error) {
    throw new Error(describeFailure(error));
  }
}

function checkConnection(connection: JwtConnection): void {
  if (connection.signingKey === null) {
    return;
  }
  const sample = sign({
    connection,
    payload: { purpose: 'connection check' },
    header: { alg: connection.algorithm, typ: 'JWT' },
  });
  try {
    jwt.verify(sample, connection.verifyingKey, { algorithms: [connection.algorithm] });
  } catch {
    throw new Error(
      'The public key does not belong to the private key. Use the public key that was made together with this private key.',
    );
  }
}

function describeFailure(error: unknown): string {
  if (error instanceof jwt.TokenExpiredError) {
    return `The token expired at ${formatTime(error.expiredAt)}.`;
  }
  if (error instanceof jwt.NotBeforeError) {
    return `The token is not valid until ${formatTime(error.date)}.`;
  }
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('jwt audience invalid')) {
    return MESSAGES.audience;
  }
  if (message.startsWith('jwt issuer invalid')) {
    return MESSAGES.issuer;
  }
  if (NOT_VALID_LIBRARY_MESSAGES.includes(message)) {
    return MESSAGES.notValid;
  }
  return MESSAGES.signature;
}

function formatTime(date: Date): string {
  return Number.isNaN(date.getTime()) ? 'a time too far in the future to show' : date.toISOString();
}

const SEGMENT = /^[A-Za-z0-9_-]+$/;

const SIGNATURE = /^[A-Za-z0-9_-]*$/;

const NOT_VALID_LIBRARY_MESSAGES = ['jwt malformed', 'invalid token', 'invalid exp value', 'invalid nbf value'];

const MESSAGES = {
  notValid: 'This is not a valid JSON Web Token.',
  signature: "The token's signature does not match this connection's key.",
  audience: "The token's audience does not match.",
  issuer: "The token's issuer does not match.",
};

export const tokens = {
  decode,
  buildHeader,
  sign,
  verify,
  checkConnection,
  MESSAGES,
};

export type DecodedToken = {
  token: string;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
};

export type VerifyChecks = {
  audience: string;
  issuer: string;
  ignoreExpiration: boolean;
  ignoreNotBefore: boolean;
  clockTolerance: number;
  clockTimestamp: number;
};
