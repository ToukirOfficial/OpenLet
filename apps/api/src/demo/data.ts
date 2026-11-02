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
  { key: 'hannah', firstName: 'Hannah', lastName: 'Royd', phone: '07700 900114' },
  { key: 'kofi', firstName: 'Kofi', lastName: 'Mensah', phone: '07700 900115' },
] as const;

/**
 * Tenancies, with dates relative to today (in months or days) so the demo always looks current.
 * `start`/`end` are month offsets from today (negative = past); `day` is the day of the month.
 */
export const TENANCIES = [
  { property: 'calder', unit: 0, tenants: ['tom', 'priya'], startMonths: -14, day: 1, endMonths: null, rent: 89500, frequency: 'MONTHLY', deposit: { amount: 103200, protected: true }, pays: 'ON_TIME' },
  { property: 'mill', unit: 0, tenants: ['dan'], startMonths: -9, day: 15, endMonths: 3, rent: 65000, frequency: 'MONTHLY', deposit: { amount: 75000, protected: false }, pays: 'ON_TIME' },
  { property: 'mill', unit: 1, tenants: ['ellie'], startMonths: -11, day: 28, endMonths: null, rent: 62500, frequency: 'MONTHLY', deposit: { amount: 72100, protected: true }, pays: 'ARREARS' },
  { property: 'weavers', unit: 0, tenants: ['kasia'], startMonths: -8, day: 2, endMonths: null, rent: 12000, frequency: 'WEEKLY', deposit: { amount: 52000, protected: true }, pays: 'ON_TIME' },
  { property: 'weavers', unit: 1, tenants: ['ravi'], startMonths: -10, day: 5, endMonths: null, rent: 48000, frequency: 'FOUR_WEEKLY', deposit: { amount: 55000, protected: true }, pays: 'PART' },
  { property: 'weavers', unit: 2, tenants: ['lucy'], startMonths: -6, day: 4, endMonths: null, rent: 11800, frequency: 'WEEKLY', deposit: { amount: 51000, protected: true }, pays: 'ON_TIME', noticeDays: 27 },
  { property: 'weavers', unit: 4, tenants: ['jack'], startMonths: -13, day: 6, endMonths: null, rent: 52000, frequency: 'FOUR_WEEKLY', deposit: { amount: 60000, protected: true }, pays: 'LATE' },
  { property: 'beacon', unit: 0, tenants: ['amira'], startMonths: -9, day: 31, endMonths: 3, rent: 76000, frequency: 'MONTHLY', deposit: { amount: 87600, protected: true }, pays: 'ON_TIME' },
  { property: 'station', unit: 0, tenants: ['george'], startMonths: -7, day: 10, endMonths: 1, rent: 69500, frequency: 'MONTHLY', deposit: { amount: 80100, protected: true }, pays: 'ON_TIME' },
  { property: 'moorside', unit: 0, tenants: ['mei', 'sean'], startMonths: -17, day: 5, endMonths: null, rent: 110000, frequency: 'MONTHLY', deposit: { amount: 126900, protected: true }, pays: 'ON_TIME', rentRise: { months: -5, rent: 115000 } },
  { property: 'canal', unit: 0, tenants: ['hannah'], startMonths: -20, day: 1, endMonths: -3, rent: 72000, frequency: 'MONTHLY', deposit: { amount: 83000, protected: true, returned: true }, pays: 'ON_TIME', ended: true },
  { property: 'canal', unit: 0, tenants: ['kofi'], startMonths: 1, day: 1, endMonths: 13, rent: 74500, frequency: 'MONTHLY', deposit: { amount: 85900, protected: false, notReceived: true }, pays: 'NONE' },
] as const;

export const CONTRACTORS = [
  { key: 'gas', name: 'Gary Pickles', company: 'Pennine Heating', trade: 'Gas engineer', phone: '07700 900201' },
  { key: 'plumb', name: 'Nadia Shah', company: 'Valley Plumbing', trade: 'Plumber', phone: '07700 900202' },
  { key: 'spark', name: 'Owen Firth', company: 'Firth Electrical', trade: 'Electrician', phone: '07700 900203' },
  { key: 'handy', name: 'Bill Crowther', company: null, trade: 'Handyman', phone: '07700 900204' },
] as const;

/** Repairs in every status. `daysAgo` = when reported. */
export const REPAIRS = [
  { property: 'calder', unit: 0, tenancy: 'calder:0:tom', category: 'HEATING', title: 'Boiler not working', description: 'No heating or hot water since this morning. The boiler shows error F28.', priority: 'URGENT', status: 'SCHEDULED', contractor: 'gas', daysAgo: 1, byTenant: true, visitInDays: 1, accessNotes: 'Tenant home after 9am. Dog is friendly.', link: true },
  { property: 'mill', unit: 1, tenancy: 'mill:1:ellie', category: 'DAMP_MOULD', title: 'Black mould on bedroom wall', description: 'Patch of mould near the window in the back bedroom, getting bigger.', priority: 'ROUTINE', status: 'REPORTED', contractor: null, daysAgo: 2, byTenant: true },
  { property: 'weavers', unit: 0, tenancy: 'weavers:0:kasia', category: 'PLUMBING', title: 'Shower leaking into kitchen ceiling', description: 'Water coming through the kitchen ceiling when the upstairs shower runs.', priority: 'URGENT', status: 'IN_PROGRESS', contractor: 'plumb', daysAgo: 4, byTenant: false, visitInDays: -1 },
  { property: 'station', unit: 0, tenancy: 'station:0:george', category: 'ELECTRICAL', title: 'Hallway light fitting sparking', description: 'The hall light flickers and sparked when switched on. Tenant has turned it off at the switch.', priority: 'EMERGENCY', status: 'ACKNOWLEDGED', contractor: 'spark', daysAgo: 2, byTenant: true },
  { property: 'beacon', unit: 0, tenancy: 'beacon:0:amira', category: 'APPLIANCES', title: 'Bathroom extractor fan not working', description: 'Fan makes no noise when the light is on.', priority: 'ROUTINE', status: 'COMPLETED', contractor: 'spark', daysAgo: 12, byTenant: true, cost: 8500 },
  { property: 'moorside', unit: 0, tenancy: 'moorside:0:mei', category: 'SECURITY', title: 'Front door lock sticking', description: 'Key is hard to turn in the front door.', priority: 'ROUTINE', status: 'CLOSED', contractor: 'handy', daysAgo: 30, byTenant: true, cost: 6000 },
  { property: 'weavers', unit: 4, tenancy: 'weavers:4:jack', category: 'APPLIANCES', title: 'Washing machine not draining', description: 'Turned out to be a blocked filter, cleared by the tenant.', priority: 'ROUTINE', status: 'CANCELLED', contractor: null, daysAgo: 9, byTenant: true },
  { property: 'canal', unit: 0, tenancy: null, category: 'HEATING', title: 'Bedroom radiator cold', description: 'Radiator needed bleeding and a new valve.', priority: 'ROUTINE', status: 'CLOSED', contractor: 'gas', daysAgo: 130, byTenant: false, cost: 12000 },
  { property: 'chapel', unit: 0, tenancy: null, category: 'OTHER', title: 'Clear gutters before winter', description: 'Front and back gutters full of leaves.', priority: 'ROUTINE', status: 'CLOSED', contractor: 'handy', daysAgo: 60, byTenant: false, cost: 9500 },
] as const;
