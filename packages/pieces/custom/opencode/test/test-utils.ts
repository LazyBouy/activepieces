/// <reference types="vitest/globals" />

import { httpClient, HttpError, HttpMessageBody, HttpRequest, HttpResponse } from '@activepieces/pieces-common';
import { createMockActionContext, CreateWaitpointParams, ResumePayload } from '@activepieces/pieces-framework';

function mockServer({ answer }: { answer: (request: HttpRequest) => unknown }): HttpRequest[] {
  const requests: HttpRequest[] = [];
  vi.spyOn(httpClient, 'sendRequest').mockImplementation(async <T extends HttpMessageBody>(request: HttpRequest): Promise<HttpResponse<T>> => {
    requests.push(request);
    const body = answer(request);
    if (body instanceof HttpError) {
      throw body;
    }
    return { status: 200, headers: {}, body: body as T };
  });
  return requests;
}

function contextOf({ propsValue, resumePayload, canPause = true }: ContextParams) {
  const waitpoints: CreateWaitpointParams[] = [];
  const waited: string[] = [];
  const uploads: string[] = [];
  const base = createMockActionContext({
    propsValue,
    resumePayload,
    canPause,
    onCreateWaitpoint: (waitpoint) => waitpoints.push(waitpoint),
    onWaitForWaitpoint: (id) => waited.push(id),
  });
  const context = {
    ...base,
    files: {
      ...base.files,
      upload: async ({ fileName }: { fileName: string }) => {
        uploads.push(fileName);
        return { id: `file_${uploads.length}`, url: `http://files/${fileName}` };
      },
    },
  };
  return { context, waitpoints, waited, uploads };
}

function httpError({ status, body }: { status: number; body: unknown }): HttpError {
  return new HttpError({}, { status, responseBody: body });
}

function resumeWith({ body }: { body: unknown }): ResumePayload {
  return { body, headers: {}, queryParams: {} };
}

export const testUtils = {
  mockServer,
  contextOf,
  httpError,
  resumeWith,
};

type ContextParams = {
  propsValue: Record<string, unknown>;
  resumePayload?: ResumePayload;
  canPause?: boolean;
};
