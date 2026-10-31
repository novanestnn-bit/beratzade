import { pendingRequest } from './durable-request-key';

describe('durable request keys', () => {
  it('retains a key until a successful response, then permits a new action', () => {
    const scope = crypto.randomUUID();
    const first = pendingRequest(scope, { amount: 50 });
    expect(pendingRequest(scope, { amount: 50 }).key).toBe(first.key);
    first.done();
    expect(pendingRequest(scope, { amount: 50 }).key).not.toBe(first.key);
  });
  it('does not let a late response discard a newer pending request', () => {
    const scope = crypto.randomUUID();
    const first = pendingRequest(scope, { amount: 50 });
    const newer = pendingRequest(scope, { amount: 100 });
    first.done();
    expect(pendingRequest(scope, { amount: 100 }).key).toBe(newer.key);
    newer.done();
  });
  it('retains the retry key in memory when storage is unavailable', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('unavailable');
    spyOn(Storage.prototype, 'setItem').and.throwError('unavailable');
    const scope = crypto.randomUUID();
    const first = pendingRequest(scope, { item: 1 });
    expect(pendingRequest(scope, { item: 1 }).key).toBe(first.key);
    first.done();
  });
});
