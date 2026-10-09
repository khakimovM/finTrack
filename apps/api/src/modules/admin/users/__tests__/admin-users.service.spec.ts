import { maskPhoneForAdmin } from '../admin-users.service';

describe('maskPhoneForAdmin', () => {
  it('keeps only the last two digits', () => {
    expect(maskPhoneForAdmin('+998901234567')).toBe('+998 •• ••• •• 67');
    expect(maskPhoneForAdmin('998901234567')).toBe('+998 •• ••• •• 67');
    expect(maskPhoneForAdmin('+7 912 345 67 89')).toBe('+•• ••• •• 89');
    expect(maskPhoneForAdmin(null)).toBeNull();
  });
});
