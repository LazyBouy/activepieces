import { OpencodeAskEvent, WebsocketClientEvent } from '@activepieces/shared';
import { t } from 'i18next';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useSocket } from '@/components/providers/socket-provider';
import { authenticationSession } from '@/lib/authentication-session';

export const OpencodeAskNotices = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  useEffect(() => {
    const notify = (event: OpencodeAskEvent) => {
      const id = `opencode-ask-${event.askId}`;
      if (event.state !== 'opened') {
        toast.dismiss(id);
        return;
      }
      toast(t('An agent is waiting for an answer'), {
        id,
        description: event.title,
        duration: NOTICE_DURATION_MS,
        action: {
          label: t('Review'),
          onClick: () =>
            navigate(
              authenticationSession.appendProjectRoutePrefix(
                `/runs/${event.flowRunId}`,
              ),
            ),
        },
      });
    };
    socket.on(WebsocketClientEvent.OPENCODE_ASK, notify);
    return () => {
      socket.off(WebsocketClientEvent.OPENCODE_ASK, notify);
    };
  }, [navigate, socket]);
  return null;
};

const NOTICE_DURATION_MS = 15_000;
