import { OpencodeConnection } from '@activepieces/shared';
import { describe, expect, it } from 'vitest';

import {
  opencodeForm,
  OpencodeFormSchema,
} from '@/app/routes/platform/setup/ai/opencode-tab/opencode-form';

const connection: OpencodeConnection = {
  id: 'connection_1',
  serverUrl: 'http://127.0.0.1:4444',
  username: 'opencode',
  hasPassword: true,
  adminPanelUrl: 'http://127.0.0.1:4444',
  callbackUrl: 'http://localhost:4200/api',
  projectsFolder: null,
  enabled: true,
  askCapMinutes: 1440,
  allowlist: ['iphi-flow'],
  lastHealth: null,
  emailNotices: false,
};

describe('opencodeForm', () => {
  it('shows hours, an empty projects folder and no password', () => {
    expect(opencodeForm.toFormValues(connection)).toMatchObject({
      askCapHours: 24,
      projectsFolder: '',
      password: '',
      clearPassword: false,
    });
  });

  it('keeps the saved password when the field is left empty', () => {
    const request = opencodeForm.toRequest(
      opencodeForm.toFormValues(connection),
    );

    expect(request.password).toBeUndefined();
    expect(request.projectsFolder).toBeNull();
    expect(request.askCapMinutes).toBe(1440);
  });

  it('sends a new password, or null to remove the saved one', () => {
    const values = opencodeForm.toFormValues(connection);

    expect(
      opencodeForm.toRequest({ ...values, password: 'new' }).password,
    ).toBe('new');
    expect(
      opencodeForm.toRequest({
        ...values,
        password: 'new',
        clearPassword: true,
      }).password,
    ).toBeNull();
  });

  it('trims the projects folder and converts hours to minutes', () => {
    const values = opencodeForm.toFormValues(connection);

    expect(
      opencodeForm.toRequest({
        ...values,
        projectsFolder: '  /root/projects/flows  ',
        askCapHours: 2,
      }),
    ).toMatchObject({
      projectsFolder: '/root/projects/flows',
      askCapMinutes: 120,
    });
  });

  it('rejects a URL without a scheme and hours outside 1 to 720', () => {
    const values = opencodeForm.toFormValues(connection);

    expect(
      OpencodeFormSchema.safeParse({ ...values, serverUrl: '127.0.0.1:4444' })
        .success,
    ).toBe(false);
    expect(
      OpencodeFormSchema.safeParse({ ...values, askCapHours: 0 }).success,
    ).toBe(false);
    expect(
      OpencodeFormSchema.safeParse({ ...values, askCapHours: 721 }).success,
    ).toBe(false);
    expect(OpencodeFormSchema.safeParse(values).success).toBe(true);
  });
});
