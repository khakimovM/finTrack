import { escapeCsvField, toCsv } from '../csv';

describe('csv', () => {
  it('quotes separators and quotes, and defuses cells a spreadsheet would run as formulas', () => {
    expect(escapeCsvField('Ali, Vali')).toBe('"Ali, Vali"');
    expect(escapeCsvField('"Ega"')).toBe('"""Ega"""');
    expect(escapeCsvField('=1+1')).toBe("'=1+1");
    expect(escapeCsvField('@cmd')).toBe("'@cmd");
  });

  it('writes CRLF rows after a UTF-8 BOM', () => {
    expect(toCsv(['A', 'B'], [['1', 'x,y']])).toBe('\uFEFFA,B\r\n1,"x,y"');
  });
});
