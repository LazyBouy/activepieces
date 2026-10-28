import { createAction, Property } from '@activepieces/pieces-framework';
import { opencodeStepRun, opencodeVendor } from '@iphi-flow/opencode-pieces-common';
import { identity } from '../identity';
import { generateContentFromImageOutputSchema } from '../output-schemas';

export const generateContentFromImage = createAction({
  audience: 'both',
  description: 'Ask Gemini about an image and get a text response.',
  aiMetadata: {
    description:
      'Sends an image together with a prompt to a vision-capable Gemini model on OpenCode and returns the generated text describing or answering questions about that image, covering captioning, text extraction and visual question answering, plus a Gemini-shaped raw response (model version, candidate, token counts). Pick it over generate_content whenever a picture is part of the question. Not idempotent: each call produces a fresh completion.',
    idempotent: false,
  },
  displayName: 'Generate Content from Image',
  name: 'generate_content_from_image',
  classification: 'READ',
  props: {
    prompt: Property.LongText({
      displayName: 'Prompt',
      required: true,
      description: 'What you want to know about the image.',
    }),
    image: Property.File({
      displayName: 'Image',
      required: true,
      description: 'The image Gemini looks at.',
    }),
    model: opencodeVendor.modelDropdown({ identity, displayName: 'Model', description: 'Gemini model that writes the response.', required: true }),
  },
  outputSchema: generateContentFromImageOutputSchema,
  async run(context) {
    const { prompt, image, model } = context.propsValue;
    const result = await opencodeVendor.run({
      context,
      identity,
      buildRequest: async () => ({ model, prompt, files: [await opencodeStepRun.uploadFile({ context, file: image })] }),
    });
    if (result.status === 'paused') {
      return {};
    }
    return {
      text: result.answer.answer,
      raw: {
        ...opencodeVendor.geminiResponseOf({ answer: result.answer, includeThoughts: false }),
        sessionId: result.answer.sessionId,
        adminPanelUrl: result.answer.adminPanelUrl,
      },
    };
  },
});
