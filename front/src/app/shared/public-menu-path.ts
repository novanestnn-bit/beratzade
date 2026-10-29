/** Prefer public_slug for /public-menu links; fall back to numeric id (#413). */
export function publicMenuTenantRef(tenant: {
  id: number;
  public_slug?: string | null;
}): string | number {
  const slug = tenant.public_slug?.trim();
  return slug || tenant.id;
}

export function publicMenuPath(tenant: {
  id: number;
  public_slug?: string | null;
}): string {
  return `/public-menu/${publicMenuTenantRef(tenant)}`;
}

export function publicMenuCategorySlug(categoryId: string): string {
  return categoryId
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}