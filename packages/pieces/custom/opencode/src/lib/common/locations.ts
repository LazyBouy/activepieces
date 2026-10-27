import { isNil } from '@activepieces/pieces-framework';
import { SessionChoice } from './props';

function locationOf({ namespace, project, agent }: LocationInput): Location {
  const hasNamespace = !isNil(namespace) && namespace.length > 0;
  const hasProject = !isNil(project) && project.length > 0;
  if (hasNamespace !== hasProject) {
    throw new Error('Pick both a namespace and a project, or leave both empty to use this project\'s own OpenCode project.');
  }
  return {
    ...(hasNamespace && hasProject ? { namespace, project } : {}),
    ...(isNil(agent) || agent.length === 0 ? {} : { agent }),
  };
}

function sessionOf({ session, sessionId }: { session: SessionChoice; sessionId: string | undefined }): SessionRequest {
  if (session !== 'EXISTING') {
    return { kind: session };
  }
  const id = sessionId?.trim() ?? '';
  if (id.length === 0) {
    throw new Error('Session is "A session id", so enter the session id to continue.');
  }
  return { kind: 'EXISTING', sessionId: id };
}

function schemaOf({ value }: { value: unknown }): Record<string, unknown> | undefined {
  if (isNil(value) || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'string' ? parseJson({ text: value }) : value;
  if (typeof parsed !== 'object' || isNil(parsed) || Array.isArray(parsed)) {
    throw new Error('The Output schema must be a JSON schema object, for example {"type": "object", "properties": {…}}.');
  }
  return Object.fromEntries(Object.entries(parsed));
}

function parseJson({ text }: { text: string }): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The Output schema is not valid JSON.');
  }
}

export const opencodeLocations = {
  locationOf,
  sessionOf,
  schemaOf,
};

export type SessionRequest =
  | { kind: 'NEW' }
  | { kind: 'RUN' }
  | { kind: 'EXISTING'; sessionId: string };

type LocationInput = {
  namespace: string | undefined;
  project: string | undefined;
  agent: string | undefined;
};

type Location = {
  namespace?: string;
  project?: string;
  agent?: string;
};
