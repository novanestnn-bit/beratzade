export function compareTableNames(a?: string | null, b?: string | null): number {
  return (a ?? '').localeCompare(b ?? '', 'tr', { numeric: true, sensitivity: 'base' });
}
