function create(detail: MappingDropDetail): CustomEvent<MappingDropDetail> {
  return new CustomEvent(MAPPING_DROP_EVENT_NAME, { detail });
}

function read(event: Event): MappingDropDetail | null {
  if (!(event instanceof CustomEvent)) {
    return null;
  }
  const detail: unknown = event.detail;
  if (!isMappingDropDetail(detail)) {
    return null;
  }
  return detail;
}

function isMappingDropDetail(value: unknown): value is MappingDropDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    'propertyPath' in value &&
    typeof value.propertyPath === 'string' &&
    'clientX' in value &&
    typeof value.clientX === 'number' &&
    'clientY' in value &&
    typeof value.clientY === 'number'
  );
}

const MAPPING_DROP_EVENT_NAME = 'ap-mapping-drop';

const MAPPING_DROP_TARGET_ATTRIBUTE = 'data-mapping-drop';
const MAPPING_DROP_OVER_ATTRIBUTE = 'data-mapping-over';

export const mappingDropEvent = {
  NAME: MAPPING_DROP_EVENT_NAME,
  TARGET_ATTRIBUTE: MAPPING_DROP_TARGET_ATTRIBUTE,
  OVER_ATTRIBUTE: MAPPING_DROP_OVER_ATTRIBUTE,
  create,
  read,
};

export type MappingDropDetail = {
  propertyPath: string;
  clientX: number;
  clientY: number;
};
