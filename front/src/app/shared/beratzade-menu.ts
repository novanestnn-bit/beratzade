export function isBeratzadeMenuTenant(name?: string | null, slug?: string | null): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/&/g, ' ve ').replace(/\s+/g, ' ').trim();
  const normalizedName = normalize(name ?? '');
  return normalizedName === 'beratzade kebap ve kahvalti salonu'
    || normalizedName === 'beratzade kebap kahvalti salonu'
    || normalize(slug ?? '').startsWith('beratzade-');
}
