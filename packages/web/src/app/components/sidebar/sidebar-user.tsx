import { isNil } from '@activepieces/core-utils';
import { useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { ChevronRight, LogOut, UserCogIcon } from 'lucide-react';
import { useState } from 'react';

import { UserAvatar } from '@/components/custom/user-avatar';
import { useEmbedding } from '@/components/providers/embed-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar-shadcn';
import { userHooks } from '@/hooks/user-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { cn } from '@/lib/utils';

import { AccountSettingsDialog } from '../account-settings';
import { HelpAndFeedback } from '../help-and-feedback';

export function SidebarUser() {
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const { embedState } = useEmbedding();
  const { data: user } = userHooks.useCurrentUser();
  const queryClient = useQueryClient();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  if (!user || embedState.isEmbedded) {
    return null;
  }

  const handleLogout = () => {
    userHooks.invalidateCurrentUser(queryClient);
    authenticationSession.logOut();
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal>
          <DropdownMenuTrigger asChild className="w-full">
            <SidebarMenuButton className="group/nav-item h-auto min-h-8 gap-1 rounded-sm p-1 text-gray-12 hover:bg-gray-3 active:bg-gray-3 data-[state=open]:bg-gray-3 group-data-[collapsible=icon]:p-1">
              <span className="flex size-6 shrink-0 items-center justify-center">
                <span className="size-5 shrink-0 overflow-hidden rounded-full">
                  <UserAvatar
                    className={cn('size-full object-cover', {
                      'scale-150': isNil(user.imageUrl),
                    })}
                    name={user.firstName + ' ' + user.lastName}
                    email={user.email}
                    imageUrl={user.imageUrl}
                    size={20}
                    disableTooltip={true}
                  />
                </span>
              </span>

              {!isCollapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate leading-4.5">
                    {user.firstName + ' ' + user.lastName}
                  </span>
                  <ChevronRight className="ml-auto size-4 text-gray-10" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-65"
            side="right"
            align="end"
            sideOffset={19}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <div className="size-8 shrink-0 overflow-hidden rounded-full">
                  <UserAvatar
                    className="size-full object-cover"
                    name={user.firstName + ' ' + user.lastName}
                    email={user.email}
                    imageUrl={user.imageUrl}
                    size={32}
                    disableTooltip={true}
                  />
                </div>

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {user.firstName + ' ' + user.lastName}
                  </span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setAccountSettingsOpen(true)}>
                <UserCogIcon className="w-4 h-4 mr-2" />
                {t('Account Settings')}
              </DropdownMenuItem>

              <HelpAndFeedback />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              {t('Log out')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <AccountSettingsDialog
        open={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
      />
    </SidebarMenu>
  );
}
