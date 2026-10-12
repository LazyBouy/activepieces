import { PropertyType } from '@activepieces/pieces-framework';
import { PieceOptionRequest } from '@activepieces/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({ t: (key: string) => key }));

const internalErrorToast = vi.fn();
vi.mock('@/components/ui/sonner', () => ({
  internalErrorToast: () => internalErrorToast(),
}));

const post = vi.fn();
const get = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
    get: (...args: unknown[]) => get(...args),
  },
}));

import { piecesApi } from '@/features/pieces/api/pieces-api';

const request = {} as PieceOptionRequest;

describe('piecesApi.options', () => {
  beforeEach(() => {
    post.mockReset();
    internalErrorToast.mockReset();
  });

  it('rejects for DYNAMIC so callers can restore the cleared value', async () => {
    const failure = new Error('boom');
    post.mockRejectedValue(failure);

    await expect(piecesApi.options(request, PropertyType.DYNAMIC)).rejects.toBe(
      failure,
    );
  });

  it('rejects for DYNAMIC when the engine answers with the dropdown placeholder', async () => {
    post.mockResolvedValue({
      type: PropertyType.DYNAMIC,
      options: {
        disabled: true,
        options: [],
        placeholder: 'Throws an error, reconnect or refresh the page',
      },
    });

    await expect(
      piecesApi.options(request, PropertyType.DYNAMIC),
    ).rejects.toThrow();
  });

  it('rejects for DYNAMIC when the engine answers with an empty body', async () => {
    post.mockResolvedValue('');

    await expect(
      piecesApi.options(request, PropertyType.DYNAMIC),
    ).rejects.toThrow();
  });

  it('resolves for DYNAMIC when the engine answers with a property map', async () => {
    const response = {
      type: PropertyType.DYNAMIC,
      options: {
        url: { type: PropertyType.SHORT_TEXT, displayName: 'URL' },
      },
    };
    post.mockResolvedValue(response);

    await expect(
      piecesApi.options(request, PropertyType.DYNAMIC),
    ).resolves.toBe(response);
  });

  it('resolves for DYNAMIC when the engine answers with an empty property map', async () => {
    const response = { type: PropertyType.DYNAMIC, options: {} };
    post.mockResolvedValue(response);

    await expect(
      piecesApi.options(request, PropertyType.DYNAMIC),
    ).resolves.toBe(response);
  });

  it('resolves the engine placeholder unchanged for DROPDOWN', async () => {
    const response = {
      type: PropertyType.DROPDOWN,
      options: { disabled: true, options: [], placeholder: 'reconnect' },
    };
    post.mockResolvedValue(response);

    await expect(
      piecesApi.options(request, PropertyType.DROPDOWN),
    ).resolves.toBe(response);
  });

  it('resolves a disabled dropdown state for DROPDOWN', async () => {
    post.mockRejectedValue(new Error('boom'));

    const result = await piecesApi.options(request, PropertyType.DROPDOWN);

    expect(result.type).toBe(PropertyType.DROPDOWN);
    expect(result.options.disabled).toBe(true);
    expect(internalErrorToast).toHaveBeenCalledTimes(1);
  });
});

describe('piecesApi catalog', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
  });

  it('lists the catalog for the given locale', async () => {
    get.mockResolvedValue([]);

    await expect(piecesApi.catalog({ locale: 'fr' })).resolves.toEqual([]);

    expect(get).toHaveBeenCalledWith('/v1/pieces/catalog', { locale: 'fr' });
  });

  it('downloads one piece through the sync endpoint by name', async () => {
    post.mockResolvedValue('');

    await piecesApi.downloadFromCatalog({
      pieceName: '@activepieces/piece-asana',
    });

    expect(post).toHaveBeenCalledWith('/v1/pieces/sync', {
      pieceName: '@activepieces/piece-asana',
    });
  });
});
