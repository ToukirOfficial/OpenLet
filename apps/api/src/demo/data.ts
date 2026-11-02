/**
 * The fake West Yorkshire portfolio. Street names are invented and postcodes use unallocated "9Z?"
 * inward codes, so nothing points at a real home. Every person is made up.
 */
export const PROPERTIES = [
  { key: 'calder', addressLine1: '14 Calder View Terrace', town: 'Hebden Bridge', postcode: 'HX7 9ZZ', type: 'HOUSE', bedrooms: 3, bathrooms: 1, furnished: 'UNFURNISHED', hasGas: true, units: ['Whole property'] },
  { key: 'mill', addressLine1: '8 Mill Lane', town: 'Halifax', postcode: 'HX1 9ZY', type: 'FLAT', bedrooms: 2, bathrooms: 1, furnished: 'FURNISHED', hasGas: true, units: ['Flat 1', 'Flat 2'] },
  { key: 'weavers', addressLine1: '27 Weavers Row', town: 'Huddersfield', postcode: 'HD1 9ZX', type: 'HMO', bedrooms: 5, bathrooms: 2, furnished: 'FURNISHED', hasGas: true, units: ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5'] },
  { key: 'beacon', addressLine1: '5 Beacon Close', town: 'Bradford', postcode: 'BD9 9ZW', type: 'HOUSE', bedrooms: 2, bathrooms: 1, furnished: 'UNFURNISHED', hasGas: true, units: ['Whole property'] },
  { key: 'station', addressLine1: '33 Station Road', town: 'Wakefield', postcode: 'WF1 9ZV', type: 'BUNGALOW', bedrooms: 2, bathrooms: 1, furnished: 'PART_FURNISHED', hasGas: false, units: ['Whole property'] },
  { key: 'moorside', addressLine1: '9 Moorside Avenue', town: 'Keighley', postcode: 'BD21 9ZU', type: 'HOUSE', bedrooms: 4, bathrooms: 2, furnished: 'UNFURNISHED', hasGas: true, units: ['Whole property'] },
  { key: 'canal', addressLine1: '61 Canal Wharf', addressLine2: 'Apartment 12', town: 'Leeds', postcode: 'LS11 9ZT', type: 'FLAT', bedrooms: 1, bathrooms: 1, furnished: 'FURNISHED', hasGas: false, units: ['Whole property'] },
  { key: 'chapel', addressLine1: '2 Chapel Fold', town: 'Todmorden', postcode: 'OL14 9ZS', type: 'HOUSE', bedrooms: 3, bathrooms: 1, furnished: 'UNFURNISHED', hasGas: true, units: ['Whole property'] },
] as const;

export const TENANTS = [
  { key: 'tom', firstName: 'Tom', lastName: 'Ashworth', phone: '07700 900101', emergencyName: 'Jean Ashworth', emergencyPhone: '07700 900102' },
  { key: 'priya', firstName: 'Priya', lastName: 'Ashworth', phone: '07700 900103' },
  { key: 'dan', firstName: 'Daniel', lastName: 'Okafor', phone: '07700 900104' },
  { key: 'ellie', firstName: 'Ellie', lastName: 'Brennan', phone: '07700 900105' },
  { key: 'kasia', firstName: 'Kasia', lastName: 'Nowak', phone: '07700 900106' },
  { key: 'ravi', firstName: 'Ravi', lastName: 'Mistry', phone: '07700 900107' },
  { key: 'lucy', firstName: 'Lucy', lastName: 'Fairbairn', phone: '07700 900108' },
  { key: 'jack', firstName: 'Jack', lastName: 'Holroyd', phone: '07700 900109' },
  { key: 'amira', firstName: 'Amira', lastName: 'Haddad', phone: '07700 900110' },
  { key: 'george', firstName: 'George', lastName: 'Sutcliffe', phone: '07700 900111' },
  { key: 'mei', firstName: 'Mei', lastName: 'Lin', phone: '07700 900112' },
  { key: 'sean', firstName: 'Seán', lastName: 'Gallagher', phone: '07700 900113' },
] as const;

export const CONTRACTORS = [
  { key: 'gas', name: 'Gary Pickles', company: 'Pennine Heating', trade: 'Gas engineer', phone: '07700 900201' },
  { key: 'plumb', name: 'Nadia Shah', company: 'Valley Plumbing', trade: 'Plumber', phone: '07700 900202' },
  { key: 'spark', name: 'Owen Firth', company: 'Firth Electrical', trade: 'Electrician', phone: '07700 900203' },
  { key: 'handy', name: 'Bill Crowther', company: null, trade: 'Handyman', phone: '07700 900204' },
] as const;
