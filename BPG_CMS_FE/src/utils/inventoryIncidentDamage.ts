const METADATA_MARKER = 'BPG_INVENTORY_DAMAGE_V2';

export interface InventoryIncidentDamageItem {
  materialId?: number;
  materialCode: string;
  materialName: string;
  unitId?: number;
  unitName: string;
  /**
   * Number of selected units represented by one base-unit balance.
   * selected quantity = base quantity * conversionRate.
   */
  conversionRate: number;
  /** Available stock captured when the incident was reported, in unitName. */
  stockQuantity?: number;
  /** Damaged/lost quantity in the same unit as stockQuantity. */
  quantityLost: number;
}

interface InventoryDamagePayloadV2 {
  version: 2;
  items: InventoryIncidentDamageItem[];
}

const asPositiveNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const asNonNegativeNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const cleanTableCell = (value: string): string => value.replace(/[|\r\n]+/g, ' ').trim();

/**
 * Keeps the original four-column Markdown table for old clients, then appends a
 * hidden, versioned payload so newer clients can identify materials and units
 * without relying on mutable names/codes.
 */
export const serializeInventoryIncidentDamage = (
  items: InventoryIncidentDamageItem[],
): string => {
  const normalizedItems = items.map(item => ({
    materialId: asPositiveNumber(item.materialId),
    materialCode: item.materialCode.trim(),
    materialName: item.materialName.trim(),
    unitId: asPositiveNumber(item.unitId),
    unitName: item.unitName.trim(),
    conversionRate: asPositiveNumber(item.conversionRate) ?? 1,
    stockQuantity: asNonNegativeNumber(item.stockQuantity),
    quantityLost: asPositiveNumber(item.quantityLost) ?? 0,
  }));

  let description = '### Bảng thống kê vật tư thiệt hại\n\n'
    + '| Mã vật tư | Tên vật tư | ĐVT | SL Lỗi/Mất |\n'
    + '|---|---|---|---|\n';

  normalizedItems.forEach(item => {
    description += `| ${cleanTableCell(item.materialCode)} | ${cleanTableCell(item.materialName)} | ${cleanTableCell(item.unitName)} | **${item.quantityLost}** |\n`;
  });

  const payload: InventoryDamagePayloadV2 = { version: 2, items: normalizedItems };
  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  return `${description}\n<!-- ${METADATA_MARKER}:${encodedPayload} -->`;
};

const parseLegacyTable = (description: string): InventoryIncidentDamageItem[] => {
  const items: InventoryIncidentDamageItem[] = [];

  description.split('\n').forEach(line => {
    if (!line.trim().startsWith('|') || line.includes('Mã vật tư') || line.includes('---')) {
      return;
    }

    const parts = line.split('|').map(part => part.trim());
    if (parts.length < 5) return;

    const quantityLost = Number.parseFloat(parts[4].replace(/\*\*/g, ''));
    if (!parts[1] || !parts[2] || !Number.isFinite(quantityLost)) return;

    items.push({
      materialCode: parts[1],
      materialName: parts[2],
      unitName: parts[3],
      conversionRate: 1,
      quantityLost,
    });
  });

  return items;
};

const parseV2Payload = (description: string): InventoryIncidentDamageItem[] | null => {
  const markerPattern = new RegExp(`<!--\\s*${METADATA_MARKER}:([^\\s]+)\\s*-->`);
  const match = description.match(markerPattern);
  if (!match) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as Partial<InventoryDamagePayloadV2>;
    if (parsed.version !== 2 || !Array.isArray(parsed.items)) return null;

    const items = parsed.items.flatMap(rawItem => {
      if (!rawItem || typeof rawItem !== 'object') return [];

      const materialCode = typeof rawItem.materialCode === 'string' ? rawItem.materialCode.trim() : '';
      const materialName = typeof rawItem.materialName === 'string' ? rawItem.materialName.trim() : '';
      const unitName = typeof rawItem.unitName === 'string' ? rawItem.unitName.trim() : '';
      const quantityLost = asPositiveNumber(rawItem.quantityLost);
      if (!materialCode || !materialName || !quantityLost) return [];

      return [{
        materialId: asPositiveNumber(rawItem.materialId),
        materialCode,
        materialName,
        unitId: asPositiveNumber(rawItem.unitId),
        unitName,
        conversionRate: asPositiveNumber(rawItem.conversionRate) ?? 1,
        stockQuantity: asNonNegativeNumber(rawItem.stockQuantity),
        quantityLost,
      } satisfies InventoryIncidentDamageItem];
    });

    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
};

/** Prefer stable V2 IDs/unit metadata, while continuing to read old tables. */
export const parseInventoryIncidentDamage = (
  description: string | null | undefined,
): InventoryIncidentDamageItem[] => {
  if (!description) return [];
  return parseV2Payload(description) ?? parseLegacyTable(description);
};
