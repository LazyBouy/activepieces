import { t } from 'i18next';
import {
  ClipboardList,
  Clock,
  Ellipsis,
  LucideIcon,
  MessageCircle,
  MousePointerClick,
  Radio,
  Webhook,
  Workflow,
} from 'lucide-react';

import { PieceSelectorTriggerOptionId } from '@/features/pieces';

function getTriggerOptionDisplay(
  id: PieceSelectorTriggerOptionId,
): TriggerOptionDisplay {
  switch (id) {
    case 'manual':
      return {
        Icon: MousePointerClick,
        title: t('Start manually'),
        description: t('Run the flow yourself with a button'),
      };
    case 'apps':
      return {
        Icon: Radio,
        title: t('From an app'),
        description: t('Start when something happens in an app you connect'),
      };
    case 'schedule':
      return {
        Icon: Clock,
        title: t('Scheduled'),
        description: t(
          'Every few minutes, hours or days, or a cron expression',
        ),
      };
    case 'webhook':
      return {
        Icon: Webhook,
        title: t('When a webhook is called'),
        description: t('Start when another system sends an HTTP request'),
      };
    case 'form':
      return {
        Icon: ClipboardList,
        title: t('When a form is submitted'),
        description: t('Start when someone fills in a hosted form'),
      };
    case 'chat':
      return {
        Icon: MessageCircle,
        title: t('When a chat message arrives'),
        description: t('Start when someone writes in a hosted chat'),
      };
    case 'subflow':
      return {
        Icon: Workflow,
        title: t('When another flow calls it'),
        description: t(
          'Start when a Sub Flows step in another flow runs this one',
        ),
      };
    case 'other':
      return {
        Icon: Ellipsis,
        title: t('Other triggers'),
        description: t('Tables, file servers and other core triggers'),
      };
  }
}

export const triggerOptionDisplay = { get: getTriggerOptionDisplay };

type TriggerOptionDisplay = {
  Icon: LucideIcon;
  title: string;
  description: string;
};
