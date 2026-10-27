import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { agentChannelAction } from './lib/actions/agent-channel';
import { continueSessionAction } from './lib/actions/continue-session';
import { runAgentAction } from './lib/actions/run-agent';
import { runCommandAction } from './lib/actions/run-command';
import { sendToInboxAction } from './lib/actions/send-to-inbox';
import { opencodeLogo } from './lib/logo';

export const opencode = createPiece({
  displayName: 'OpenCode',
  description: 'Run OpenCode agents, commands and sessions, and message OpenCode projects',
  minimumSupportedRelease: '0.88.2',
  logoUrl: opencodeLogo,
  auth: PieceAuth.None(),
  categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
  actions: [runAgentAction, runCommandAction, sendToInboxAction, continueSessionAction, agentChannelAction],
  authors: ['LazyBouy'],
  triggers: [],
});
