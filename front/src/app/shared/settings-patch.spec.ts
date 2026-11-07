import { settingsPatch } from './settings-patch';

describe('settingsPatch', () => {
  it('does not resend stale unrelated fields when another manager changes them', () => {
    const baseline = { name: 'Restaurant', phone: 'old', enabled: true };
    const payload = settingsPatch(baseline, { ...baseline, name: 'Updated restaurant' });
    expect(payload).toEqual({ name: 'Updated restaurant' });
    expect({ ...baseline, phone: 'another manager', ...payload }.phone).toBe('another manager');
  });

  it('preserves explicit false and null changes', () => {
    expect(settingsPatch({ enabled: true, phone: 'old' as string | null }, { enabled: false, phone: null }))
      .toEqual({ enabled: false, phone: null });
  });

  it('patches only edited module switches so concurrent module changes survive', () => {
    const baseline = { ui_modules: { tables: true, reservations: true, users: true } };
    const edited = { ui_modules: { ...baseline.ui_modules, tables: false } };
    expect(Object.entries(settingsPatch(baseline, edited).ui_modules ?? {})).toEqual([['tables', false]]);
    expect(baseline.ui_modules.tables).toBeTrue();
  });

  it('does not submit unchanged arrays or undefined fields', () => {
    expect(settingsPatch({ tips: [5, 10], phone: undefined }, { tips: [5, 10], phone: undefined })).toEqual({});
  });
});
