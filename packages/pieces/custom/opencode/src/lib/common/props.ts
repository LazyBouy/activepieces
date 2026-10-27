import { DropdownState, InputPropertyMap, isNil, PieceAuth, Property } from '@activepieces/pieces-framework';
import { opencodeServer, ServerAccess } from './server';

async function namespaceOptions({ server }: { server: ServerAccess }): Promise<DropdownState<string>> {
  const options = await opencodeServer.read<ProjectOptions>({ server, path: '/options' });
  if (!options.enabled) {
    return { disabled: true, options: [], placeholder: ROUTING_OFF };
  }
  return {
    disabled: false,
    options: options.namespaces.map((namespace) => ({ label: namespace.name, value: namespace.id })),
    placeholder: `Leave empty for this project's own (${options.defaultLocation.namespace})`,
  };
}

async function projectOptions({ server, namespace }: { server: ServerAccess; namespace: unknown }): Promise<DropdownState<string>> {
  if (typeof namespace !== 'string' || namespace.length === 0) {
    return { disabled: true, options: [], placeholder: 'Pick a namespace, or leave both empty for this project\'s own OpenCode project' };
  }
  const options = await opencodeServer.read<ProjectOptions>({ server, path: '/options' });
  if (!options.enabled) {
    return { disabled: true, options: [], placeholder: ROUTING_OFF };
  }
  const projects = options.namespaces.find((candidate) => candidate.id === namespace)?.projects ?? [];
  return {
    disabled: false,
    options: projects.map((project) => ({ label: project.name, value: project.id })),
    placeholder: projects.length === 0 ? 'No allowlisted projects in this namespace' : 'Pick a project',
  };
}

async function inboxProjectOptions({ server }: { server: ServerAccess }): Promise<DropdownState<InboxProject>> {
  const options = await opencodeServer.read<ProjectOptions>({ server, path: '/options' });
  if (!options.enabled) {
    return { disabled: true, options: [], placeholder: ROUTING_OFF };
  }
  return {
    disabled: false,
    options: options.namespaces.flatMap((namespace) =>
      namespace.projects.map((project) => ({
        label: `${namespace.name} / ${project.name}${project.id === options.defaultLocation.project ? ' (this project\'s own)' : ''}`,
        value: { namespace: namespace.id, project: project.id },
      })),
    ),
    placeholder: 'Pick a project',
  };
}

async function agentOptions({ server, namespace, project }: LocationParams): Promise<DropdownState<string>> {
  const listed = await opencodeServer.read<AgentList>({ server, path: '/agents', query: locationQuery({ namespace, project }) });
  return {
    disabled: false,
    options: listed.agents.map((agent) => ({ label: isNil(agent.description) ? agent.name : `${agent.name} (${agent.description})`, value: agent.name })),
    placeholder: listed.error ?? 'Leave empty for the flow agent',
  };
}

async function commandOptions({ server, namespace, project }: LocationParams): Promise<DropdownState<string>> {
  const listed = await opencodeServer.read<CommandList>({ server, path: '/commands', query: locationQuery({ namespace, project }) });
  return {
    disabled: false,
    options: listed.commands.map((command) => ({ label: `${command.name} (${command.source === 'skill' ? 'skill' : 'command'})`, value: command.name })),
    placeholder: listed.error ?? 'Pick a command or skill',
  };
}

async function modelOptions({ server, namespace, project }: LocationParams): Promise<DropdownState<ModelChoice | null>> {
  const listed = await opencodeServer.read<ProviderList>({ server, path: '/models', query: locationQuery({ namespace, project }) });
  return {
    disabled: false,
    options: [
      { label: AGENT_DEFAULT, value: null },
      ...listed.providers.flatMap((provider) =>
        provider.models.map((model) => ({ label: `${provider.name}: ${model.name}`, value: { providerID: provider.id, modelID: model.id } })),
      ),
    ],
    placeholder: listed.error ?? AGENT_DEFAULT,
  };
}

async function recipientProps({ server, project, to }: RecipientParams): Promise<InputPropertyMap> {
  const location = inboxLocation({ value: project });
  if (to === 'session') {
    return {
      id: Property.ShortText({ displayName: 'Session id', description: 'The OpenCode session to deliver the message to, for example ses_…', required: true }),
    };
  }
  if ((to !== 'agent' && to !== 'group') || isNil(location)) {
    return {};
  }
  if (to === 'agent') {
    const listed = await opencodeServer.read<AgentList>({ server, path: '/agents', query: location });
    return {
      id: Property.StaticDropdown({
        displayName: 'Agent',
        required: true,
        options: { options: listed.agents.map((agent) => ({ label: agent.name, value: agent.name })), placeholder: listed.error ?? 'Pick an agent' },
      }),
    };
  }
  const listed = await opencodeServer.read<GroupList>({ server, path: '/groups', query: location });
  return {
    id: Property.StaticDropdown({
      displayName: 'Group',
      required: true,
      options: { options: listed.groups.map((group) => ({ label: group.name, value: group.id })), placeholder: listed.error ?? (listed.groups.length === 0 ? 'This project has no groups' : 'Pick a group') },
    }),
  };
}

function locationQuery({ namespace, project }: { namespace: unknown; project: unknown }): Record<string, string | undefined> {
  return {
    namespace: typeof namespace === 'string' ? namespace : undefined,
    project: typeof project === 'string' ? project : undefined,
  };
}

function inboxLocation({ value }: { value: unknown }): InboxProject | null {
  if (typeof value !== 'object' || isNil(value) || !('namespace' in value) || !('project' in value)) {
    return null;
  }
  return typeof value.namespace === 'string' && typeof value.project === 'string' ? { namespace: value.namespace, project: value.project } : null;
}

const ROUTING_OFF = 'Run AI on OpenCode is off. Turn it on in Platform → AI → OpenCode.';

const AGENT_DEFAULT = 'Agent default';

const namespace = Property.Dropdown<string, false>({
  auth: PieceAuth.None(),
  displayName: 'Namespace',
  description: 'The OpenCode namespace. Leave Namespace and Project empty to use this Activepieces project\'s own OpenCode project.',
  required: false,
  refreshers: [],
  options: async (_, ctx) => namespaceOptions({ server: ctx.server }),
});

const project = Property.Dropdown<string, false>({
  auth: PieceAuth.None(),
  displayName: 'Project',
  description: 'The OpenCode project in that namespace. Only allowlisted projects are listed.',
  required: false,
  refreshers: ['namespace'],
  options: async (propsValue, ctx) => projectOptions({ server: ctx.server, namespace: propsValue['namespace'] }),
});

const agent = Property.Dropdown<string, false>({
  auth: PieceAuth.None(),
  displayName: 'Agent',
  description: 'The OpenCode agent that does the work. Leave empty for the flow agent.',
  required: false,
  refreshers: ['namespace', 'project'],
  options: async (propsValue, ctx) => agentOptions({ server: ctx.server, namespace: propsValue['namespace'], project: propsValue['project'] }),
});

const session = Property.StaticDropdown<SessionChoice, true>({
  displayName: 'Session',
  description: 'New starts a fresh OpenCode session. This run\'s session shares one session with the other steps of this run that pick it. A session id continues that session.',
  required: true,
  defaultValue: 'NEW',
  options: {
    options: [
      { label: 'New', value: 'NEW' },
      { label: 'This run\'s session', value: 'RUN' },
      { label: 'A session id', value: 'EXISTING' },
    ],
  },
});

const sessionId = Property.ShortText({
  displayName: 'Session id',
  description: 'Used when Session is "A session id": the OpenCode session to continue, for example the Session id from an earlier OpenCode step.',
  required: false,
});

const files = Property.Array({
  displayName: 'Files',
  description: 'Files to send with the prompt. Text files are read as text; images and PDFs go to the model as they are.',
  required: false,
  properties: {
    file: Property.File({ displayName: 'File', required: true }),
  },
});

const outputSchema = Property.Json({
  displayName: 'Output schema',
  description: 'A JSON schema for a structured answer. Leave empty for a text answer.',
  required: false,
});

const model = Property.Dropdown<ModelChoice | null, false>({
  auth: PieceAuth.None(),
  displayName: 'Model',
  description: 'The model to use for this step. Agent default uses the model the agent, project or namespace sets in OpenCode.',
  required: false,
  refreshers: ['namespace', 'project'],
  options: async (propsValue, ctx) => modelOptions({ server: ctx.server, namespace: propsValue['namespace'], project: propsValue['project'] }),
});

const command = Property.Dropdown<string, true>({
  auth: PieceAuth.None(),
  displayName: 'Command',
  description: 'A command or skill of the OpenCode project.',
  required: true,
  refreshers: ['namespace', 'project'],
  options: async (propsValue, ctx) => commandOptions({ server: ctx.server, namespace: propsValue['namespace'], project: propsValue['project'] }),
});

const inboxProject = Property.Dropdown<InboxProject, true>({
  auth: PieceAuth.None(),
  displayName: 'Project',
  description: 'The OpenCode project whose inbox gets the message. Only allowlisted projects are listed.',
  required: true,
  refreshers: [],
  options: async (_, ctx) => inboxProjectOptions({ server: ctx.server }),
});

const inboxTo = Property.StaticDropdown<InboxTo, false>({
  displayName: 'To',
  description: 'Who the message is for. Leave empty to let the inbox rules or the project manager decide.',
  required: false,
  options: {
    options: [
      { label: 'An agent', value: 'agent' },
      { label: 'A group', value: 'group' },
      { label: 'A session', value: 'session' },
    ],
  },
});

const inboxRecipient = Property.DynamicProperties({
  auth: PieceAuth.None(),
  displayName: 'Recipient',
  required: false,
  refreshers: ['project', 'to'],
  props: async (propsValue, ctx) => recipientProps({ server: ctx.server, project: propsValue['project'], to: propsValue['to'] }),
});

export const opencodeProps = {
  namespace,
  project,
  agent,
  session,
  sessionId,
  files,
  outputSchema,
  model,
  command,
  inboxProject,
  inboxTo,
  inboxRecipient,
};

export const opencodeOptions = {
  inboxLocation,
};

export type SessionChoice = 'NEW' | 'RUN' | 'EXISTING';

export type InboxTo = 'agent' | 'group' | 'session';

export type InboxProject = {
  namespace: string;
  project: string;
};

export type ModelChoice = {
  providerID: string;
  modelID: string;
};

type LocationParams = {
  server: ServerAccess;
  namespace: unknown;
  project: unknown;
};

type RecipientParams = {
  server: ServerAccess;
  project: unknown;
  to: unknown;
};

type ProjectOptions = {
  enabled: boolean;
  namespaces: { id: string; name: string; projects: { id: string; name: string }[] }[];
  defaultLocation: { namespace: string; project: string | null; agent: string };
};

type AgentList = {
  agents: { name: string; description?: string }[];
  error?: string;
};

type CommandList = {
  commands: { name: string; source: string; description?: string }[];
  error?: string;
};

type GroupList = {
  groups: { id: string; name: string }[];
  error?: string;
};

type ProviderList = {
  providers: { id: string; name: string; models: { id: string; name: string }[] }[];
  error?: string;
};
