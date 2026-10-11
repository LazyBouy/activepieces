import { isNil } from '@activepieces/core-utils';
import { t } from 'i18next';
import { ChevronRight, Copy, Download } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import ReactJson from 'react-json-view';
import { toast } from 'sonner';

import { useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { syntaxTheme } from '@/lib/syntax-theme';
import { cn } from '@/lib/utils';

type JsonViewerProps = {
  json: any;
  title: React.ReactNode;
  hideDownload?: boolean;
  hideHeader?: boolean;
  className?: string;
  variant?: 'default' | 'pane';
  renderKey?: (args: JsonKeyRenderArgs) => React.ReactNode;
};

const removeUndefined = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, removeUndefined(value)]),
    );
  }
  return obj;
};

const JsonViewer = React.memo(
  ({
    json: unclearJson,
    title,
    hideDownload = false,
    hideHeader = false,
    className,
    variant = 'default',
    renderKey,
  }: JsonViewerProps) => {
    const { resolvedTheme } = useTheme();
    const json = useMemo(() => {
      return removeUndefined(unclearJson);
    }, [unclearJson]);
    if (variant === 'pane') {
      return (
        <JsonPaneTree json={json} renderKey={renderKey} className={className} />
      );
    }

    const viewerTheme = syntaxTheme.jsonView(resolvedTheme);
    const handleCopy = () => {
      navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      toast.success(t('Copied to clipboard'), {
        duration: 1000,
      });
    };

    const handleDownload = () => {
      const blob = new Blob([JSON.stringify(json, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${typeof title === 'string' ? title : 'data'}.json`;
      link.click();
      URL.revokeObjectURL(url);
    };
    return (
      <div
        className={cn(
          'rounded-lg border border-solid border-gray-6 overflow-hidden relative',
          className,
        )}
      >
        {!hideHeader && (
          <div className="px-3 py-2 flex border-solid border-b border-gray-6 justify-center items-center">
            <div className="grow justify-center items-center">
              <span>{title}</span>
            </div>
            <div className="flex items-center gap-0">
              {!hideDownload && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={'ghost'}
                        size={'sm'}
                        onClick={handleDownload}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t('Download JSON')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={'ghost'} size={'sm'} onClick={handleCopy}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {t('Copy to clipboard')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}

        {
          <>
            {isNil(json) ? (
              <pre className="text-sm whitespace-pre-wrap overflow-x-auto p-2">
                {json === null ? 'null' : 'undefined'}
              </pre>
            ) : (
              <>
                {typeof json !== 'string' && typeof json !== 'object' && (
                  <pre className="text-sm whitespace-pre-wrap  break-all overflow-x-auto p-2">
                    {JSON.stringify(json)}
                  </pre>
                )}
                {typeof json === 'string' && (
                  <pre className="text-sm whitespace-pre-wrap break-all overflow-x-auto p-2">
                    {json}
                  </pre>
                )}
                {typeof json === 'object' && (
                  <div className="max-w-full">
                    <ReactJson
                      style={{
                        overflowX: 'auto',
                        padding: '0.5rem',
                        wordBreak: 'break-word',
                      }}
                      theme={viewerTheme}
                      enableClipboard={false}
                      groupArraysAfterLength={20}
                      displayDataTypes={false}
                      name={false}
                      quotesOnKeys={false}
                      src={json}
                    />
                  </div>
                )}
              </>
            )}
          </>
        }
      </div>
    );
  },
);

const JsonPaneTree = ({
  json,
  renderKey,
  className,
}: {
  json: unknown;
  renderKey?: (args: JsonKeyRenderArgs) => React.ReactNode;
  className?: string;
}) => (
  <div
    data-json-pane-tree
    className={cn(
      'font-mono text-xs leading-normal text-gray-11 [overflow-wrap:anywhere]',
      className,
    )}
  >
    <JsonPaneNode
      value={json}
      path={[]}
      name={null}
      depth={0}
      isLast={true}
      renderKey={renderKey}
    />
  </div>
);

const JsonPaneNode = ({
  value,
  path,
  name,
  depth,
  isLast,
  renderKey,
}: JsonPaneNodeProps) => {
  const entries = getJsonEntries(value);
  const [expanded, setExpanded] = useState(
    () =>
      depth < PANE_DEFAULT_EXPANDED_DEPTH &&
      (entries?.length ?? 0) <= PANE_COLLAPSE_LARGER_THAN,
  );
  const keyLabel =
    name === null ? null : (
      <>
        {renderKey ? (
          renderKey({ keyLabel: String(name), path })
        ) : (
          <span className="text-canvas-json-key">{String(name)}</span>
        )}
        <span>: </span>
      </>
    );
  const comma = isLast ? '' : ',';
  if (entries === null) {
    return (
      <div className="flex min-h-4.5 items-start pl-4">
        <span>
          {keyLabel}
          <JsonPaneValue value={value} />
          {comma}
        </span>
      </div>
    );
  }
  const isArray = Array.isArray(value);
  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';
  if (entries.length === 0) {
    return (
      <div className="flex min-h-4.5 items-start pl-4">
        <span>
          {keyLabel}
          {open}
          {close}
          {comma}
        </span>
      </div>
    );
  }
  return (
    <div>
      <div className="flex min-h-4.5 items-start">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? t('Collapse') : t('Expand')}
          onClick={() => setExpanded(!expanded)}
          className="flex h-4.5 w-4 shrink-0 items-center justify-center text-gray-11 hover:text-gray-12"
        >
          <ChevronRight
            className={cn('size-3 transition-transform', {
              'rotate-90': expanded,
            })}
          />
        </button>
        <span>
          {keyLabel}
          {open}
          {!expanded && (
            <>
              <span className="text-gray-11">…</span>
              {close}
              {comma}
            </>
          )}
        </span>
      </div>
      {expanded && (
        <>
          <div className="ml-1.5 border-l border-canvas-json-guide pl-2.5">
            {entries.map(([childName, childValue], index) => (
              <JsonPaneNode
                key={String(childName)}
                value={childValue}
                path={[...path, childName]}
                name={childName}
                depth={depth + 1}
                isLast={index === entries.length - 1}
                renderKey={renderKey}
              />
            ))}
          </div>
          <div className="pl-4">
            {close}
            {comma}
          </div>
        </>
      )}
    </div>
  );
};

const JsonPaneValue = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) {
    return <span className="text-canvas-json-null">null</span>;
  }
  if (typeof value === 'string') {
    return (
      <span className="text-canvas-json-string">{JSON.stringify(value)}</span>
    );
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="text-canvas-json-number">{String(value)}</span>;
  }
  return <span>{JSON.stringify(value)}</span>;
};

function getJsonEntries(value: unknown): [string | number, unknown][] | null {
  if (Array.isArray(value)) {
    return value.map((item, index) => [index, item]);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value);
  }
  return null;
}

const PANE_DEFAULT_EXPANDED_DEPTH = 3;
const PANE_COLLAPSE_LARGER_THAN = 50;

JsonViewer.displayName = 'JsonViewer';
export { JsonViewer };

export type JsonKeyRenderArgs = {
  keyLabel: string;
  path: (string | number)[];
};

type JsonPaneNodeProps = {
  value: unknown;
  path: (string | number)[];
  name: string | number | null;
  depth: number;
  isLast: boolean;
  renderKey?: (args: JsonKeyRenderArgs) => React.ReactNode;
};
