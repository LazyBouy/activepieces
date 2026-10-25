import {
  OpencodeCatalog,
  OpencodeConnection,
  OpencodeHealth,
  UpdateOpencodeConnectionRequest,
} from '@activepieces/shared';

import { api } from '@/lib/api';

export const opencodeConnectionApi = {
  get() {
    return api.get<OpencodeConnection>('/v1/opencode/connection');
  },
  update(request: UpdateOpencodeConnectionRequest) {
    return api.post<OpencodeConnection>('/v1/opencode/connection', request);
  },
  test() {
    return api.post<OpencodeHealth>('/v1/opencode/connection/test');
  },
  catalog() {
    return api.get<OpencodeCatalog>('/v1/opencode/connection/catalog');
  },
};
