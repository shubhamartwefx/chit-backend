export interface IVerifiedAadhaarProfile {
  fullName: string;
  gender: string;
  dateOfBirth: string;
  aadhaarAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  aadhaarLast4: string;
}

export const MOCK_AADHAAR_DEMOGRAPHICS: Omit<
  IVerifiedAadhaarProfile,
  'aadhaarLast4'
> = {
  fullName: 'Rajesh Kumar',
  gender: 'Male',
  dateOfBirth: '15/08/1990',
  aadhaarAddress: {
    street: '42, MG Road, Koramangala',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560034',
    country: 'India',
  },
};
