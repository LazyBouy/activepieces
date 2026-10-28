import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { createAction, isNil, Property } from '@activepieces/pieces-framework';
import { opencodeStepRun, opencodeVendor, UploadedFile, VendorContext } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';

export const generateContent = createAction({
  name: 'generate_content',
  classification: 'READ',
  displayName: 'Generate Content',
  description: 'Call a Gemini model on Vertex AI to generate a text response.',
  audience: 'both',
  aiMetadata: {
    description:
      'Sends a prompt (with optional system instruction) to a Gemini model on Google Vertex AI through OpenCode and returns the generated text with a Gemini-shaped candidate list and token counts. You can attach files and public image URLs for the model to analyze alongside the prompt; YouTube videos run only on Google\'s API. The region is set on OpenCode\'s Vertex AI provider. Not idempotent: each call is a fresh generation.',
    idempotent: false,
  },
  props: {
    model: opencodeVendor.modelDropdown({
      identity,
      displayName: 'Model',
      description: 'Gemini model to use for content generation.',
      required: true,
      defaultValue: 'gemini-2.5-flash',
    }),
    systemMessage: Property.LongText({
      displayName: 'System Message',
      description: "Instructions that guide the model's behavior throughout the conversation.",
      required: false,
    }),
    userMessage: Property.LongText({
      displayName: 'User Message',
      description: 'The prompt to send to the model.',
      required: true,
    }),
    files: Property.Array({
      displayName: 'Files',
      required: false,
      description: 'Optional files to include in the prompt (images, PDFs, text, audio, video)',
      properties: {
        file: Property.File({ displayName: 'File', required: true }),
      },
    }),
    youtubeUrl: Property.ShortText({
      displayName: 'YouTube URL',
      required: false,
      description: 'Optional public YouTube video URL for the AI to use as a reference. Runs only on Google\'s API.',
    }),
    imageUrls: Property.Array({
      displayName: 'Image URLs',
      description: 'Public image URLs to include alongside the user message. The model will analyze these images.',
      required: false,
    }),
    temperature: Property.Number({
      displayName: 'Temperature',
      description: 'Controls randomness. Lower values are more deterministic (0–2). Leave empty to use the model default.',
      required: false,
    }),
    maxOutputTokens: Property.Number({
      displayName: 'Max Output Tokens',
      description: 'Maximum number of tokens to generate. Leave empty to use the model default.',
      required: false,
    }),
    thinkingLevel: Property.StaticDropdown({
      displayName: 'Thinking Level',
      description: 'Controls how much the model thinks before responding. Supported on Gemini 2.5 and later models.',
      required: false,
      options: {
        options: [
          { label: 'Low', value: 'LOW' },
          { label: 'Medium', value: 'MEDIUM' },
          { label: 'High', value: 'HIGH' },
        ],
      },
    }),
    thinkingBudget: Property.Number({
      displayName: 'Thinking Budget (tokens)',
      description:
        'Maximum number of tokens the model can use for internal reasoning. Set to 0 to disable thinking. Supported on Gemini 2.5 and later models.',
      required: false,
    }),
    includeThoughts: Property.Checkbox({
      displayName: 'Include Thoughts in Response',
      description: "When enabled, the model's reasoning is returned alongside the final response. Supported on Gemini 2.5 and later models.",
      required: false,
      defaultValue: false,
    }),
  },
  async run(context) {
    const { model, systemMessage, userMessage, files, youtubeUrl, imageUrls, temperature, maxOutputTokens, thinkingLevel, thinkingBudget, includeThoughts } =
      context.propsValue;
    if (!isNil(youtubeUrl) && youtubeUrl.length > 0) {
      throw opencodeVendor.unsupported({ feature: 'A YouTube URL', identity });
    }
    const variant = variantOf({ thinkingLevel, thinkingBudget });
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({
        model,
        prompt: userMessage,
        system: opencodeVendor.systemOf({ texts: [systemMessage] }),
        files: [
          ...(await opencodeStepRun.uploadFiles({ context, value: files })),
          ...(await Promise.all(urlsOf({ value: imageUrls }).map((url) => uploadImage({ context, url })))),
        ],
        ...opencodeVendor.optionsOf({ options: { temperature, maxOutputTokens } }),
        ...(isNil(variant) ? {} : { variant }),
      }),
    });
    if (result.status === 'paused') {
      return {};
    }
    if (result.answer.finish === 'length') {
      throw new Error('Generation stopped due to token limit. Consider removing the max output tokens or shortening your prompt.');
    }
    const response = opencodeVendor.geminiResponseOf({ answer: result.answer, includeThoughts: includeThoughts === true });
    return { text: result.answer.answer, candidates: response.candidates, usageMetadata: response.usageMetadata };
  },
});

function variantOf({ thinkingLevel, thinkingBudget }: { thinkingLevel: string | undefined; thinkingBudget: number | undefined }): string | undefined {
  if (!isNil(thinkingLevel) && thinkingLevel.length > 0) {
    return thinkingLevel.toLowerCase();
  }
  if (isNil(thinkingBudget) || thinkingBudget === 0) {
    return undefined;
  }
  return opencodeVendor.thinkingVariantOf({ budget: thinkingBudget });
}

function urlsOf({ value }: { value: unknown }): string[] {
  return Array.isArray(value) ? value.flatMap((entry: unknown) => (typeof entry === 'string' && entry.length > 0 ? [entry] : [])) : [];
}

async function uploadImage({ context, url }: { context: VendorContext; url: string }): Promise<UploadedFile> {
  try {
    const response = await httpClient.sendRequest<ArrayBuffer>({ method: HttpMethod.GET, url, responseType: 'arraybuffer' });
    const name = new URL(url).pathname.split('/').filter((segment) => segment.length > 0).pop() ?? 'image';
    const uploaded = await context.files.upload({ fileName: name, data: Buffer.from(response.body) });
    return { fileId: uploaded.id, filename: name };
  } catch (error) {
    throw new Error(`Failed to fetch image (${url}): ${error instanceof Error ? error.message : String(error)}`);
  }
}
