import { OpencodeConnection } from '@activepieces/shared';
import { t } from 'i18next';
import { PlugZap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { opencodeConnectionMutations } from '@/features/opencode';
import { formatUtils } from '@/lib/format-utils';

export function ConnectionStatus({ connection }: ConnectionStatusProps) {
  const { mutate: testConnection, isPending } =
    opencodeConnectionMutations.useTest();
  const health = connection.lastHealth;

  return (
    <Item variant="outline">
      <ItemMedia variant="icon">
        <PlugZap />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {t('Connection')}
          {health === null ? (
            <Badge variant="neutral">{t('Not checked yet')}</Badge>
          ) : health.healthy ? (
            <Badge variant="success">{t('Connected')}</Badge>
          ) : (
            <Badge variant="destructive">{t('Not reachable')}</Badge>
          )}
        </ItemTitle>
        <ItemDescription className="line-clamp-none">
          {health === null
            ? t('Test the connection to see whether OpenCode answers.')
            : health.healthy
            ? t('OpenCode {version} answered at {time}.', {
                version: health.version ?? '',
                time: formatUtils.formatDate(new Date(health.checkedAt)),
              })
            : t('OpenCode did not answer at {time}: {reason}', {
                time: formatUtils.formatDate(new Date(health.checkedAt)),
                reason: health.error ?? '',
              })}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={isPending}
          onClick={() => testConnection()}
        >
          {t('Test connection')}
        </Button>
      </ItemActions>
    </Item>
  );
}

type ConnectionStatusProps = {
  connection: OpencodeConnection;
};
