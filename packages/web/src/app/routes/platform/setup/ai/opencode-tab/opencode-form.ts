import {
  formErrors,
  OPENCODE_MAX_ASK_CAP_MINUTES,
  OpencodeConnection,
  UpdateOpencodeConnectionRequest,
} from '@activepieces/shared';
import { z } from 'zod';

function toFormValues(connection: OpencodeConnection): OpencodeFormValues {
  return {
    enabled: connection.enabled,
    serverUrl: connection.serverUrl,
    username: connection.username,
    password: '',
    clearPassword: false,
    adminPanelUrl: connection.adminPanelUrl,
    callbackUrl: connection.callbackUrl,
    projectsFolder: connection.projectsFolder ?? '',
    askCapHours: Math.round(connection.askCapMinutes / MINUTES_PER_HOUR),
    allowlist: connection.allowlist,
  };
}

function toRequest(
  values: OpencodeFormValues,
): UpdateOpencodeConnectionRequest {
  return {
    enabled: values.enabled,
    serverUrl: values.serverUrl,
    username: values.username,
    password: values.clearPassword
      ? null
      : values.password.length > 0
      ? values.password
      : undefined,
    adminPanelUrl: values.adminPanelUrl,
    callbackUrl: values.callbackUrl,
    projectsFolder:
      values.projectsFolder.trim().length === 0
        ? null
        : values.projectsFolder.trim(),
    askCapMinutes: values.askCapHours * MINUTES_PER_HOUR,
    allowlist: values.allowlist,
  };
}

const MINUTES_PER_HOUR = 60;

const URL_MESSAGE = 'Enter a full URL, for example http://127.0.0.1:4444';

const HOURS_MESSAGE = 'Enter a whole number of hours from 1 to 720';

export const OpencodeFormSchema = z.object({
  enabled: z.boolean(),
  serverUrl: z.url(URL_MESSAGE),
  username: z.string().min(1, formErrors.required),
  password: z.string(),
  clearPassword: z.boolean(),
  adminPanelUrl: z.url(URL_MESSAGE),
  callbackUrl: z.url(URL_MESSAGE),
  projectsFolder: z.string(),
  askCapHours: z
    .number(HOURS_MESSAGE)
    .int(HOURS_MESSAGE)
    .min(1, HOURS_MESSAGE)
    .max(OPENCODE_MAX_ASK_CAP_MINUTES / MINUTES_PER_HOUR, HOURS_MESSAGE),
  allowlist: z.array(z.string()),
});
export type OpencodeFormValues = z.infer<typeof OpencodeFormSchema>;

export const opencodeForm = {
  toFormValues,
  toRequest,
};
