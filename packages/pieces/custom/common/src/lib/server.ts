import { AuthenticationType, httpClient, HttpError, HttpMethod } from '@activepieces/pieces-common';
import { isNil } from '@activepieces/pieces-framework';

async function read<T>({ server, path, query }: ReadParams): Promise<T> {
  const response = await call(() =>
    httpClient.sendRequest<T>({
      method: HttpMethod.GET,
      url: `${server.apiUrl}v1/opencode/steps${path}`,
      authentication: { type: AuthenticationType.BEARER_TOKEN, token: server.token },
      queryParams: Object.fromEntries(Object.entries(query ?? {}).filter((entry): entry is [string, string] => !isNil(entry[1]) && entry[1].length > 0)),
    }),
  );
  return response.body;
}

async function start({ server, body }: StartParams): Promise<StepResponse> {
  const response = await call(() =>
    httpClient.sendRequest<StepResponse>({
      method: HttpMethod.POST,
      url: `${server.apiUrl}v1/opencode/steps`,
      authentication: { type: AuthenticationType.BEARER_TOKEN, token: server.token },
      body,
    }),
  );
  return response.body;
}

async function call<T>(send: () => Promise<T>): Promise<T> {
  try {
    return await send();
  } catch (error) {
    throw new Error(messageOf(error));
  }
}

function messageOf(error: unknown): string {
  if (error instanceof HttpError) {
    const body = error.errorMessage().response.body;
    const fromBody = bodyMessage(body);
    return fromBody ?? `Activepieces answered with status ${error.errorMessage().response.status}.`;
  }
  return error instanceof Error ? error.message : String(error);
}

function bodyMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || isNil(body)) {
    return undefined;
  }
  const params = 'params' in body ? body.params : undefined;
  if (typeof params === 'object' && !isNil(params) && 'message' in params && typeof params.message === 'string') {
    return params.message;
  }
  return 'message' in body && typeof body.message === 'string' ? body.message : undefined;
}

export const opencodeServer = {
  read,
  start,
};

export type ServerAccess = {
  apiUrl: string;
  token: string;
};

export type StepResponse = {
  requestId: string;
  output?: unknown;
  failure?: string;
};

type ReadParams = {
  server: ServerAccess;
  path: string;
  query?: Record<string, string | undefined>;
};

type StartParams = {
  server: ServerAccess;
  body: Record<string, unknown>;
};
