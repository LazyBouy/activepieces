import { createAction, DynamicPropsValue, MarkdownVariant, PieceAuth, Property } from '@activepieces/pieces-framework';
import { opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';
import { generateContentOutputSchema } from '../output-schemas';

export const generateContent = createAction({
  audience: 'both',
  description: 'Send a prompt to Gemini and get a text response.',
  aiMetadata: {
    description:
      'Runs a single prompt through a Gemini model on OpenCode and returns the generated text. The Built-in Tool can ask the agent to search the web (Google Search) or read the pages linked in the prompt (URL Context) with OpenCode\'s own web tools; Google Maps and File Search run only on Google\'s API and fail here. Prefer chat_gemini when the exchange needs conversation memory and generate_content_from_image when the input includes an image. Not idempotent: each call produces a fresh completion.',
    idempotent: false,
  },
  displayName: 'Generate Content',
  name: 'generate_content',
  classification: 'WRITE',
  props: {
    prompt: Property.LongText({
      displayName: 'Prompt',
      required: true,
      description: 'What you want Gemini to write or answer.',
    }),
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'Gemini model that writes the response.', required: true }),
    toolType: Property.StaticDropdown({
      displayName: 'Built-in Tool',
      description: 'Lets Gemini search the web or read links with OpenCode\'s web tools. Maps and File Search run only on Google\'s API.',
      required: false,
      options: {
        options: [
          { label: 'Google Search', value: 'google-search' },
          { label: 'File Search', value: 'file-search' },
          { label: 'Google Maps', value: 'google-maps' },
          { label: 'URL Context', value: 'url-context' },
        ],
      },
    }),
    toolProperties: Property.DynamicProperties({
      displayName: 'Tool Settings',
      auth: PieceAuth.None(),
      refreshers: ['toolType'],
      required: false,
      props: async ({ toolType }) => toolPropsOf({ toolType }),
    }),
  },
  outputSchema: generateContentOutputSchema,
  async run(context) {
    const { prompt, model, toolType } = context.propsValue;
    if (toolType === 'file-search') {
      throw opencodeVendor.unsupported({ feature: 'File Search', identity });
    }
    if (toolType === 'google-maps') {
      throw opencodeVendor.unsupported({ feature: 'Google Maps', identity });
    }
    const notes = toolType === 'google-search' ? [SEARCH_NOTE] : toolType === 'url-context' ? [URL_NOTE] : [];
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({ model, prompt: opencodeVendor.promptOf({ question: prompt, notes }) }),
    });
    return result.status === 'paused' ? {} : result.answer.answer;
  },
});

function toolPropsOf({ toolType }: { toolType: unknown }): DynamicPropsValue {
  switch (toolType) {
    case 'file-search':
      return {
        file: Property.File({ displayName: 'File', required: true, description: 'File Gemini searches to answer the prompt.' }),
        fileStoreName: Property.ShortText({ displayName: 'File Store Name', required: true, description: 'Name for the search store this step creates on each run.' }),
      };
    case 'url-context':
      return {
        mrkdown: Property.MarkDown({
          variant: MarkdownVariant.INFO,
          value: 'Put the links in the prompt. The agent reads those pages with its web fetch tool before it answers.',
        }),
      };
    case 'google-search':
      return {
        mrkdown: Property.MarkDown({
          variant: MarkdownVariant.INFO,
          value: 'The agent searches the web with its OpenCode web tools when the prompt needs up-to-date information.',
        }),
      };
    case 'google-maps':
      return {
        latitude: Property.Number({ displayName: 'Latitude', required: true, description: 'Center of the Maps search, in decimal degrees from -90 to 90.' }),
        longitude: Property.Number({ displayName: 'Longitude', required: true, description: 'Center of the Maps search, in decimal degrees from -180 to 180.' }),
      };
    default:
      return {};
  }
}

const SEARCH_NOTE = 'Search the web for current information before you answer.';

const URL_NOTE = 'Read the pages linked above before you answer.';
