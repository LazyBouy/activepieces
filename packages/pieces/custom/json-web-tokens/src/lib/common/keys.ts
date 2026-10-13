import { createPrivateKey, createPublicKey, createSecretKey, KeyObject } from 'node:crypto';
import { algorithms, JwtAlgorithm, KeyType } from './algorithms';
import { values } from './values';

function readConnection(input: ConnectionInput): JwtConnection {
  const keyType = readKeyType(input.key_type);
  const algorithm = readAlgorithm({ value: input.algorithm, keyType });
  if (keyType === 'secret') {
    if (typeof input.secret !== 'string' || values.isBlank(input.secret)) {
      throw new Error('Enter the shared secret in the connection.');
    }
    const secretKey = createSecretKey(Buffer.from(input.secret, 'utf8'));
    return { keyType, algorithm, signingKey: secretKey, verifyingKey: secretKey };
  }
  const privateKey = values.isBlank(input.private_key)
    ? null
    : loadKey({ text: input.private_key, which: 'private' });
  const publicKey = values.isBlank(input.public_key) ? null : loadKey({ text: input.public_key, which: 'public' });
  const verifyingKey = publicKey ?? (privateKey === null ? null : createPublicKey(privateKey));
  if (verifyingKey === null) {
    throw new Error(
      'Add a private key, a public key or both to the connection. The private key creates tokens and the public key checks them.',
    );
  }
  if (privateKey !== null) {
    checkKeyFits({ key: privateKey, algorithm, which: 'private' });
  }
  if (publicKey !== null) {
    checkKeyFits({ key: publicKey, algorithm, which: 'public' });
  }
  return { keyType, algorithm, signingKey: privateKey, verifyingKey };
}

function requireSigningKey(connection: JwtConnection): KeyObject {
  if (connection.signingKey === null) {
    throw new Error(
      'This connection has only a public key, so it can check tokens but not create them. Add the private key to the connection to create tokens.',
    );
  }
  return connection.signingKey;
}

function normalizePem(text: string): string {
  const unescaped = text
    .replace(/\\r\\n|\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .trim();
  const match = PEM_BLOCK.exec(unescaped);
  if (match === null) {
    return unescaped;
  }
  const [, label, body] = match;
  if (body.includes(':')) {
    return unescaped;
  }
  const lines = body.replace(/\s+/g, '').match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

function readKeyType(value: unknown): KeyType {
  if (values.isBlank(value)) {
    return 'secret';
  }
  if (value === 'secret' || value === 'key_pair') {
    return value;
  }
  throw new Error('Choose Shared secret or Key pair for Key type.');
}

function readAlgorithm({ value, keyType }: { value: unknown; keyType: KeyType }): JwtAlgorithm {
  if (values.isBlank(value)) {
    return algorithms.defaultFor(keyType);
  }
  if (!algorithms.isAlgorithm(value)) {
    throw new Error(`"${values.readText(value)}" is not a supported algorithm. Choose one of the listed algorithms.`);
  }
  if (!algorithms.fitsKeyType({ algorithm: value, keyType })) {
    throw new Error(
      keyType === 'secret'
        ? `${value} needs a key pair. For a shared secret choose HS256, HS384 or HS512, or set Key type to Key pair.`
        : `${value} needs a shared secret. For a key pair choose an RS, PS or ES algorithm, or set Key type to Shared secret.`,
    );
  }
  return value;
}

function loadKey({ text, which }: { text: unknown; which: KeyRole }): KeyObject {
  const pem = normalizePem(values.readText(text));
  try {
    return which === 'private' ? createPrivateKey(pem) : createPublicKey(pem);
  } catch {
    throw new Error(
      which === 'private'
        ? 'The private key could not be read. Paste the whole PEM text, including the -----BEGIN and -----END lines. Keys protected by a passphrase are not supported.'
        : 'The public key could not be read. Paste the whole PEM text of the public key or certificate, including the -----BEGIN and -----END lines.',
    );
  }
}

function checkKeyFits({ key, algorithm, which }: { key: KeyObject; algorithm: JwtAlgorithm; which: KeyRole }): void {
  const family = algorithms.familyOf(algorithm);
  const keyType = key.asymmetricKeyType;
  const curve = algorithms.curveFor(algorithm);
  const fits =
    (family === 'rsa' && keyType === 'rsa') ||
    (family === 'rsa-pss' && (keyType === 'rsa' || keyType === 'rsa-pss')) ||
    (family === 'ecdsa' && keyType === 'ec' && curve !== null && key.asymmetricKeyDetails?.namedCurve === curve.nodeName);
  if (!fits) {
    throw new Error(`The ${which} key does not fit ${algorithm}, which needs ${neededKey(algorithm)}. This key is ${describeKey(key)}.`);
  }
  const modulusLength = key.asymmetricKeyDetails?.modulusLength;
  if (modulusLength !== undefined && modulusLength < MIN_RSA_BITS) {
    throw new Error(`The ${which} key is too short. RSA keys must be at least ${MIN_RSA_BITS} bits long.`);
  }
}

function neededKey(algorithm: JwtAlgorithm): string {
  const curve = algorithms.curveFor(algorithm);
  if (curve !== null) {
    return `an EC key on the ${curve.label} curve`;
  }
  return 'an RSA key';
}

function describeKey(key: KeyObject): string {
  switch (key.asymmetricKeyType) {
    case 'rsa':
      return 'an RSA key';
    case 'rsa-pss':
      return 'an RSA-PSS key';
    case 'ec': {
      const namedCurve = key.asymmetricKeyDetails?.namedCurve ?? 'unknown';
      const curve = CURVE_LABELS[namedCurve] ?? namedCurve;
      return `an EC key on the ${curve} curve`;
    }
    default:
      return `a key of type ${key.asymmetricKeyType ?? 'unknown'}`;
  }
}

const PEM_BLOCK = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/;

const MIN_RSA_BITS = 2048;

const CURVE_LABELS: Record<string, string> = {
  prime256v1: 'P-256',
  secp384r1: 'P-384',
  secp521r1: 'P-521',
};

export const keys = {
  readConnection,
  requireSigningKey,
  normalizePem,
};

export type JwtConnection = {
  keyType: KeyType;
  algorithm: JwtAlgorithm;
  signingKey: KeyObject | null;
  verifyingKey: KeyObject;
};

export type ConnectionInput = {
  key_type?: unknown;
  secret?: unknown;
  private_key?: unknown;
  public_key?: unknown;
  algorithm?: unknown;
};

type KeyRole = 'private' | 'public';
