import { ApEdition, ApFlagId } from '@activepieces/shared';
import { Navigate } from 'react-router-dom';

import { flagsHooks } from '@/hooks/flags-hooks';

import { CapabilitiesTab } from './capabilities-tab';
import { OpencodeTab } from './opencode-tab';
import { ProvidersTab } from './providers-tab';
import { TiersTab } from './tiers-tab';

export default function AIProvidersPage({ section }: AIProvidersPageProps) {
  return <AICenter section={section} />;
}

function AICenter({ section }: { section: AISection }) {
  const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);

  if (section === 'capabilities' && edition === ApEdition.COMMUNITY) {
    return <Navigate to="/platform/ai" replace />;
  }

  return (
    <div className="flex w-full flex-1 min-h-0 flex-col overflow-auto">
      <div className="flex min-h-full w-full flex-col py-6">
        {section === 'providers' ? (
          <div className="flex flex-1 flex-col">
            <ProvidersTab />
          </div>
        ) : section === 'tiers' ? (
          <TiersTab />
        ) : section === 'opencode' ? (
          <OpencodeTab />
        ) : (
          <CapabilitiesTab />
        )}
      </div>
    </div>
  );
}

type AISection = 'providers' | 'capabilities' | 'tiers' | 'opencode';

type AIProvidersPageProps = {
  section: AISection;
};
