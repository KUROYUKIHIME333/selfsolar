export const getKeysInAnArray = (obj: Record<string, any>): string[] => {
  // Use Object.keys to create an array of property names
  return Object.keys(obj);
};

export const getValuesInAnArray = (obj: Record<string, any>): string[] => {
  // Use Object.keys to create an array of property names
  return Object.values(obj);
};

export const getKeysCommaSeparated = (obj: Record<string, any>): string => {
  // Use Object.keys to create an array of property names
  return Object.keys(obj).join(",");
};

export const getValuesCommaSeparated = (obj: Record<string, any>): string => {
  // Use Object.values to create an array of property values
  return Object.values(obj).join(",");
};
