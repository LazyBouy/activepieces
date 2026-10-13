/// <reference types="vitest/globals" />

import { keys } from '../src/lib/common/keys';
import { testUtils } from './test-utils';

const rsa = testUtils.rsaKeys();
const otherRsa = testUtils.rsaKeys();
const p256 = testUtils.ecKeys('P-256');
const p384 = testUtils.ecKeys('P-384');
const p521 = testUtils.ecKeys('P-521');

describe('JSON Web Tokens connection', () => {
  test('a shared secret is valid with the default algorithm and with every HS algorithm', async () => {
    expect(await testUtils.validate(testUtils.secretAuth({ secret: 'top-secret' }))).toEqual({ valid: true });
    for (const algorithm of ['HS256', 'HS384', 'HS512'] as const) {
      expect(await testUtils.validate(testUtils.secretAuth({ secret: 'top-secret', algorithm }))).toEqual({ valid: true });
    }
  });

  test('an RSA key pair is valid with the default algorithm and with every RS and PS algorithm', async () => {
    expect(await testUtils.validate(testUtils.keyPairAuth(rsa))).toEqual({ valid: true });
    for (const algorithm of ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512'] as const) {
      expect(await testUtils.validate(testUtils.keyPairAuth({ ...rsa, algorithm }))).toEqual({ valid: true });
    }
  });

  test('EC key pairs are valid with the ES algorithm for their curve', async () => {
    expect(await testUtils.validate(testUtils.keyPairAuth({ ...p256, algorithm: 'ES256' }))).toEqual({ valid: true });
    expect(await testUtils.validate(testUtils.keyPairAuth({ ...p384, algorithm: 'ES384' }))).toEqual({ valid: true });
    expect(await testUtils.validate(testUtils.keyPairAuth({ ...p521, algorithm: 'ES512' }))).toEqual({ valid: true });
  });

  test('a private key alone or a public key alone is enough', async () => {
    expect(await testUtils.validate(testUtils.keyPairAuth({ privateKey: rsa.privateKey }))).toEqual({ valid: true });
    expect(await testUtils.validate(testUtils.keyPairAuth({ publicKey: rsa.publicKey }))).toEqual({ valid: true });
  });

  test('a missing secret or missing keys fail with a plain message', async () => {
    expect(await testUtils.validate(testUtils.secretAuth({ secret: '' }))).toEqual({
      valid: false,
      error: 'Enter the shared secret in the connection.',
    });
    expect(await testUtils.validate(testUtils.keyPairAuth({}))).toEqual({
      valid: false,
      error:
        'Add a private key, a public key or both to the connection. The private key creates tokens and the public key checks them.',
    });
  });

  test('an algorithm from the wrong family fails', async () => {
    expect(await testUtils.validate(testUtils.secretAuth({ secret: 'x', algorithm: 'RS256' }))).toEqual({
      valid: false,
      error: 'RS256 needs a key pair. For a shared secret choose HS256, HS384 or HS512, or set Key type to Key pair.',
    });
    expect(await testUtils.validate(testUtils.keyPairAuth({ ...rsa, algorithm: 'HS256' }))).toEqual({
      valid: false,
      error: 'HS256 needs a shared secret. For a key pair choose an RS, PS or ES algorithm, or set Key type to Shared secret.',
    });
  });

  test('the unsigned algorithm and unknown values are refused', async () => {
    expect(await testUtils.validate({ ...testUtils.secretAuth({ secret: 'x' }), algorithm: undefined })).toEqual({
      valid: true,
    });
    expect(keys.readConnection.bind(null, { key_type: 'secret', secret: 'x', algorithm: 'none' })).toThrow(
      '"none" is not a supported algorithm. Choose one of the listed algorithms.',
    );
    expect(keys.readConnection.bind(null, { key_type: 'certificate', secret: 'x' })).toThrow(
      'Choose Shared secret or Key pair for Key type.',
    );
  });

  test('a key that does not fit the algorithm fails and says what is needed', async () => {
    expect(await testUtils.validate(testUtils.keyPairAuth(p256))).toEqual({
      valid: false,
      error: 'The private key does not fit RS256, which needs an RSA key. This key is an EC key on the P-256 curve.',
    });
    expect(await testUtils.validate(testUtils.keyPairAuth({ ...p256, algorithm: 'ES384' }))).toEqual({
      valid: false,
      error: 'The private key does not fit ES384, which needs an EC key on the P-384 curve. This key is an EC key on the P-256 curve.',
    });
    expect(await testUtils.validate(testUtils.keyPairAuth({ publicKey: rsa.publicKey, algorithm: 'ES256' }))).toEqual({
      valid: false,
      error: 'The public key does not fit ES256, which needs an EC key on the P-256 curve. This key is an RSA key.',
    });
  });

  test('a private key and a public key that do not belong together fail', async () => {
    expect(await testUtils.validate(testUtils.keyPairAuth({ privateKey: rsa.privateKey, publicKey: otherRsa.publicKey }))).toEqual({
      valid: false,
      error: 'The public key does not belong to the private key. Use the public key that was made together with this private key.',
    });
  });

  test('keys that cannot be read fail with a plain message', async () => {
    expect(await testUtils.validate(testUtils.keyPairAuth({ privateKey: 'not a key' }))).toEqual({
      valid: false,
      error:
        'The private key could not be read. Paste the whole PEM text, including the -----BEGIN and -----END lines. Keys protected by a passphrase are not supported.',
    });
    expect(await testUtils.validate(testUtils.keyPairAuth({ privateKey: rsa.publicKey }))).toEqual({
      valid: false,
      error:
        'The private key could not be read. Paste the whole PEM text, including the -----BEGIN and -----END lines. Keys protected by a passphrase are not supported.',
    });
    expect(await testUtils.validate(testUtils.keyPairAuth({ publicKey: '-----BEGIN PUBLIC KEY-----abc-----END PUBLIC KEY-----' }))).toEqual({
      valid: false,
      error:
        'The public key could not be read. Paste the whole PEM text of the public key or certificate, including the -----BEGIN and -----END lines.',
    });
  });

  test('RSA keys shorter than 2048 bits fail', async () => {
    const short = testUtils.rsaKeys({ modulusLength: 1024 });
    expect(await testUtils.validate(testUtils.keyPairAuth(short))).toEqual({
      valid: false,
      error: 'The private key is too short. RSA keys must be at least 2048 bits long.',
    });
  });

  test('a PEM key pasted with its line breaks lost, turned into spaces or escaped still works', async () => {
    const joined = rsa.privateKey.replace(/\n/g, '');
    const spaced = rsa.privateKey.replace(/\n/g, ' ');
    const escaped = rsa.privateKey.replace(/\n/g, '\\n');
    for (const privateKey of [joined, spaced, escaped]) {
      expect(await testUtils.validate(testUtils.keyPairAuth({ privateKey, publicKey: rsa.publicKey.replace(/\n/g, ' ') }))).toEqual({
        valid: true,
      });
    }
    expect(keys.normalizePem(joined)).toBe(rsa.privateKey);
  });
});
