import {
  AppConnectionType,
  AppConnectionValueForAuthProperty,
  createMockActionContext,
} from '@activepieces/pieces-framework';
import { createHmac, generateKeyPairSync, KeyObject } from 'node:crypto';
import { createTokenAction } from '../src/lib/actions/create-token';
import { readTokenAction } from '../src/lib/actions/read-token';
import { verifyTokenAction } from '../src/lib/actions/verify-token';
import { jsonWebTokensAuth } from '../src/lib/auth';
import { JwtAlgorithm } from '../src/lib/common/algorithms';

function secretAuth({ secret, algorithm }: { secret: string; algorithm?: JwtAlgorithm }): JwtAuthProps {
  return { key_type: 'secret', secret, private_key: undefined, public_key: undefined, algorithm };
}

function keyPairAuth({
  privateKey,
  publicKey,
  algorithm,
}: {
  privateKey?: string;
  publicKey?: string;
  algorithm?: JwtAlgorithm;
}): JwtAuthProps {
  return { key_type: 'key_pair', secret: undefined, private_key: privateKey, public_key: publicKey, algorithm };
}

function rsaKeys({ modulusLength = 2048 }: { modulusLength?: number } = {}): PemKeys {
  return toPem(generateKeyPairSync('rsa', { modulusLength }));
}

function ecKeys(namedCurve: 'P-256' | 'P-384' | 'P-521'): PemKeys {
  return toPem(generateKeyPairSync('ec', { namedCurve }));
}

function toPem({ privateKey, publicKey }: { privateKey: KeyObject; publicKey: KeyObject }): PemKeys {
  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

function withAuth(props: JwtAuthProps): JwtAuthValue {
  return { type: AppConnectionType.CUSTOM_AUTH, props };
}

function createToken({ auth, propsValue }: { auth: JwtAuthProps; propsValue: Record<string, unknown> }) {
  return createTokenAction.run({ ...createMockActionContext({ propsValue }), auth: withAuth(auth) });
}

function verifyToken({ auth, propsValue }: { auth: JwtAuthProps; propsValue: Record<string, unknown> }) {
  return verifyTokenAction.run({ ...createMockActionContext({ propsValue }), auth: withAuth(auth) });
}

function readToken({ propsValue }: { propsValue: Record<string, unknown> }) {
  return readTokenAction.run({ ...createMockActionContext({ propsValue }), auth: undefined });
}

function validate(props: JwtAuthProps) {
  const validator = jsonWebTokensAuth.validate;
  if (validator === undefined) {
    throw new Error('The connection has no validate function.');
  }
  return validator({
    auth: props,
    server: {
      apiUrl: 'http://localhost:3000',
      publicUrl: 'http://localhost:4200',
      mintOidcToken: async () => 'test-oidc-token',
    },
  });
}

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function signWithHmac({
  header,
  payload,
  secret,
}: {
  header: Record<string, unknown>;
  payload: unknown;
  secret: string;
}): string {
  const body = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function unsignedToken(payload: Record<string, unknown>): string {
  return `${encodeSegment({ alg: 'none', typ: 'JWT' })}.${encodeSegment(payload)}.`;
}

function toIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

const FIXED_NOW_MS = Date.UTC(2026, 0, 15, 12, 0, 0, 500);

const FIXED_NOW = Math.floor(FIXED_NOW_MS / 1000);

export const testUtils = {
  secretAuth,
  keyPairAuth,
  rsaKeys,
  ecKeys,
  createToken,
  verifyToken,
  readToken,
  validate,
  encodeSegment,
  signWithHmac,
  unsignedToken,
  toIso,
  FIXED_NOW_MS,
  FIXED_NOW,
};

export type JwtAuthValue = AppConnectionValueForAuthProperty<typeof jsonWebTokensAuth>;

export type JwtAuthProps = JwtAuthValue['props'];

export type PemKeys = {
  privateKey: string;
  publicKey: string;
};
