import { ApEdition, ApFlagId } from '@activepieces/shared';

import { useEmbedding } from '@/components/providers/embed-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar-shadcn';
import { ManagePlanDialog } from '@/features/billing';
import { flagsHooks } from '@/hooks/flags-hooks';

import {
  GlobalSearchProvider,
  useGlobalSearch,
} from '../global-search/global-search-context';
import { PrimaryRail } from '../primary-rail';

export function BuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalSearchProvider>
      <BuilderLayoutInner>{children}</BuilderLayoutInner>
    </GlobalSearchProvider>
  );
}

function BuilderLayoutInner({ children }: { children: React.ReactNode }) {
  const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);
  const { embedState } = useEmbedding();
  const { open: searchOpen } = useGlobalSearch();

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-1">
      {!embedState.isEmbedded && <PrimaryRail />}
      <SidebarProvider
        hoverMode={!searchOpen}
        defaultOpen={false}
        className="flex-1 min-w-0 w-auto will-change-transform"
      >
        <SidebarInset className="flex flex-col h-full overflow-hidden bg-gray-1">
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            {children}
          </div>
          {edition !== ApEdition.COMMUNITY && <ManagePlanDialog />}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
