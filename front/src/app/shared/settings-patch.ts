/** Send only edited settings, including only edited navigation modules. */
export function settingsPatch<T extends object>(baseline: T, edited: T): Partial<T> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(edited)) {
    const previous = (baseline as Record<string, unknown>)[key];
    if (value === undefined || JSON.stringify(value) === JSON.stringify(previous)) continue;
    if (key === 'ui_modules' && value && typeof value === 'object') {
      const previousModules = (previous ?? {}) as Record<string, unknown>;
      const changed = Object.fromEntries(Object.entries(value).filter(([name, enabled]) => enabled !== previousModules[name]));
      if (Object.keys(changed).length) patch[key] = changed;
    } else {
      patch[key] = value;
    }
  }
  return patch as Partial<T>;
}
