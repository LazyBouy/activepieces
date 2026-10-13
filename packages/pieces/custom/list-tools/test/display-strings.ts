import { createMockActionContext, InputPropertyMap, PropertyContext, PropertyType } from '@activepieces/pieces-framework';
import { listTools } from '../src';

async function collectDisplayStrings(): Promise<string[]> {
  const metadata = listTools.metadata();
  const context = createMockActionContext({ propsValue: {} });
  const propertyContext: PropertyContext = {
    server: context.server,
    project: context.project,
    flows: context.flows,
    connections: context.connections,
  };
  const actionStrings = await Promise.all(
    Object.values(metadata.actions).map(async (action) => [
      action.displayName,
      action.description,
      ...(await propertyStrings({ props: action.props, propertyContext })),
    ]),
  );
  return [...new Set([metadata.displayName, metadata.description, ...actionStrings.flat()])];
}

async function propertyStrings({
  props,
  propertyContext,
}: {
  props: InputPropertyMap;
  propertyContext: PropertyContext;
}): Promise<string[]> {
  const nested = await Promise.all(
    Object.values(props).map(async (property): Promise<string[]> => {
      const own = [property.displayName, property.description ?? ''];
      if (property.type === PropertyType.STATIC_DROPDOWN) {
        return [...own, ...property.options.options.map((option) => option.label)];
      }
      if (property.type === PropertyType.ARRAY) {
        return [...own, ...(await propertyStrings({ props: property.properties ?? {}, propertyContext }))];
      }
      if (property.type === PropertyType.DYNAMIC) {
        const refresher = property.refreshers[0];
        const refresherProperty = props[refresher];
        const choices =
          refresherProperty !== undefined && refresherProperty.type === PropertyType.STATIC_DROPDOWN
            ? refresherProperty.options.options.map((option) => option.value)
            : [];
        const built = await Promise.all(
          choices.map(async (choice) =>
            propertyStrings({ props: await property.props({ [refresher]: choice }, propertyContext), propertyContext }),
          ),
        );
        return [...own, ...built.flat()];
      }
      return own;
    }),
  );
  return nested.flat().filter((text) => text !== '');
}

export const displayStrings = {
  collectDisplayStrings,
};
