import { isNil } from '@activepieces/core-utils';
import {
  FlowAction,
  FlowActionType,
  opencodeStepUtil,
} from '@activepieces/shared';
import { t } from 'i18next';
import { Info } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';

import { opencodeOptionsQueries } from '../hooks/opencode-options-hooks';

export const OpencodeVendorNotice = ({
  step,
  projectId,
}: {
  step: FlowAction;
  projectId: string;
}) => {
  const { data: options } = opencodeOptionsQueries.useOptions({ projectId });
  const vendor =
    step.type === FlowActionType.PIECE
      ? opencodeStepUtil.vendorOfOfficialAction({
          pieceName: step.settings.pieceName,
          actionName: step.settings.actionName,
        })
      : undefined;
  if (isNil(vendor) || options?.enabled !== true) {
    return null;
  }
  return (
    <Alert data-testid="opencode-vendor-notice">
      <Info className="size-4" />
      <AlertDescription>
        {t(
          'This step calls {vendor} directly. Use {vendor} (via OpenCode) to run it on OpenCode.',
          { vendor: vendor.vendor },
        )}
      </AlertDescription>
    </Alert>
  );
};
