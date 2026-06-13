export const getKeysInAnArray = (obj: Record<string, any>): string[] => {
  return Object.keys(obj);
};

export const getValuesInAnArray = (obj: Record<string, any>): string[] => {
  return Object.values(obj);
};

export const getKeysCommaSeparated = (obj: Record<string, any>): string => {
  return Object.keys(obj).join(",");
};

export const getValuesCommaSeparated = (obj: Record<string, any>): string => {
  return Object.values(obj).join(",");
};
