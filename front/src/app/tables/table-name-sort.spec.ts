import { compareTableNames } from '../shared/table-name-sort';

describe('compareTableNames', () => {
  it('sorts numbered tables by their numeric suffix', () => {
    const names = ['Masa 10', 'Masa 2', 'Masa 1'];
    expect(names.sort(compareTableNames)).toEqual(['Masa 1', 'Masa 2', 'Masa 10']);
  });

  it('sorts joined table names naturally and ignores letter case', () => {
    const names = ['Masa 10 + Masa 11', 'masa 2 + Masa 3'];
    expect(names.sort(compareTableNames)).toEqual(['masa 2 + Masa 3', 'Masa 10 + Masa 11']);
  });
});
