function isAlgorithm(value: unknown): value is JwtAlgorithm {
  return ALL.some((algorithm) => algorithm === value);
}

function familyOf(algorithm: JwtAlgorithm): AlgorithmFamily {
  if (algorithm.startsWith('HS')) {
    return 'hmac';
  }
  if (algorithm.startsWith('RS')) {
    return 'rsa';
  }
  if (algorithm.startsWith('PS')) {
    return 'rsa-pss';
  }
  return 'ecdsa';
}

function defaultFor(keyType: KeyType): JwtAlgorithm {
  return keyType === 'secret' ? 'HS256' : 'RS256';
}

function fitsKeyType({ algorithm, keyType }: { algorithm: JwtAlgorithm; keyType: KeyType }): boolean {
  return (familyOf(algorithm) === 'hmac') === (keyType === 'secret');
}

function curveFor(algorithm: JwtAlgorithm): EcCurve | null {
  return EC_CURVES.find((entry) => entry.algorithm === algorithm) ?? null;
}

const SECRET_ALGORITHMS: readonly JwtAlgorithm[] = ['HS256', 'HS384', 'HS512'];

const KEY_PAIR_ALGORITHMS: readonly JwtAlgorithm[] = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
];

const ALL: readonly JwtAlgorithm[] = [...SECRET_ALGORITHMS, ...KEY_PAIR_ALGORITHMS];

const EC_CURVES: readonly EcCurve[] = [
  { algorithm: 'ES256', nodeName: 'prime256v1', label: 'P-256' },
  { algorithm: 'ES384', nodeName: 'secp384r1', label: 'P-384' },
  { algorithm: 'ES512', nodeName: 'secp521r1', label: 'P-521' },
];

const OPTIONS: { label: string; value: JwtAlgorithm }[] = [
  { label: 'HS256 (shared secret, HMAC with SHA-256)', value: 'HS256' },
  { label: 'HS384 (shared secret, HMAC with SHA-384)', value: 'HS384' },
  { label: 'HS512 (shared secret, HMAC with SHA-512)', value: 'HS512' },
  { label: 'RS256 (key pair, RSA with SHA-256)', value: 'RS256' },
  { label: 'RS384 (key pair, RSA with SHA-384)', value: 'RS384' },
  { label: 'RS512 (key pair, RSA with SHA-512)', value: 'RS512' },
  { label: 'PS256 (key pair, RSA-PSS with SHA-256)', value: 'PS256' },
  { label: 'PS384 (key pair, RSA-PSS with SHA-384)', value: 'PS384' },
  { label: 'PS512 (key pair, RSA-PSS with SHA-512)', value: 'PS512' },
  { label: 'ES256 (key pair, ECDSA on P-256)', value: 'ES256' },
  { label: 'ES384 (key pair, ECDSA on P-384)', value: 'ES384' },
  { label: 'ES512 (key pair, ECDSA on P-521)', value: 'ES512' },
];

export const algorithms = {
  isAlgorithm,
  familyOf,
  defaultFor,
  fitsKeyType,
  curveFor,
  SECRET_ALGORITHMS,
  KEY_PAIR_ALGORITHMS,
  ALL,
  OPTIONS,
};

export type JwtAlgorithm =
  | 'HS256'
  | 'HS384'
  | 'HS512'
  | 'RS256'
  | 'RS384'
  | 'RS512'
  | 'PS256'
  | 'PS384'
  | 'PS512'
  | 'ES256'
  | 'ES384'
  | 'ES512';

export type AlgorithmFamily = 'hmac' | 'rsa' | 'rsa-pss' | 'ecdsa';

export type KeyType = 'secret' | 'key_pair';

type EcCurve = {
  algorithm: JwtAlgorithm;
  nodeName: string;
  label: string;
};
