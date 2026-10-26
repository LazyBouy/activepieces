import { OpencodeProviderView } from '@activepieces/shared';
import { t } from 'i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export const OpencodeProviderModels = ({
  provider,
}: {
  provider: OpencodeProviderView;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start px-0 text-gray-12"
        >
          {open ? <ChevronDown /> : <ChevronRight />}
          {t('{provider}: {count} models', {
            provider: provider.name,
            count: provider.models.length,
          })}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex max-h-60 flex-col gap-0.5 overflow-y-auto pl-6">
        {provider.models.map((model) => (
          <span key={model.id} className="text-xs text-gray-11">
            {model.name}
            {model.id === provider.defaultModel && (
              <span className="text-gray-12">{` · ${t('default')}`}</span>
            )}
          </span>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
