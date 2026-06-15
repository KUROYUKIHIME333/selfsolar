export const getKeysInAnArray = (obj: Record<string, any>): string[] => {
  return Object.keys(obj);
};

export const getValuesInAnArray = (obj: Record<string, any>): string[] => {
  return Object.values(obj);
};

export const getKeysCommaSeparated = (obj: Record<string, any>): string => {
  return Object.keys(obj).join(", ");
};

export const getKeysArray = (obj: Record<string, any>): string[] => {
  return Object.keys(obj);
};

export const getValuesCommaSeparated = (obj: Record<string, any>): string => {
  let values: string[] = [];
  Object.values(obj).forEach((element) => {
    if (typeof element === "boolean" || typeof element === "number") {
      values.push(`${element}`);
    } else {
      values.push(`'${element}'`);
    }
  });
  return values.join(", ");
};
