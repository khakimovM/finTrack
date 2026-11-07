/**
 * What a merchant line on a card notification says about the operation. Only a shop is a plain
 * expense: card-to-card between networks is nearly always the person's own money moving, a P2P
 * can be a gift, a debt or one's own card, and a payment service can be anything it collects for.
 */
export type MerchantKind = 'OWN_TRANSFER' | 'P2P' | 'PAYMENT_SERVICE' | 'SHOP';

const NETWORK = '(?:UZCARD|HUMO|VISA|MASTERCARD|MC|UNIONPAY)';
const NETWORK_TO_NETWORK = new RegExp(`\\b${NETWORK}\\s*(?:2|TO)\\s*${NETWORK}\\b`);
const P2P = /\bP2P\b/;
// Wallets and payment apps: the line names the app, not what was paid for.
const PAYMENT_SERVICE = /^(?:(?:AO|OOO|LLC|MCHJ)\s+)?(?:CLICK|PAYME|PAYNET|APELSIN|UZUM BANK)\b(?!.*\b(?:YANDEX|TAXI|SCOOTER)\b)/;

/** The merchant as a stable key: the same shop always reads the same, so a choice is remembered. */
export function merchantKey(merchant: string): string {
  return merchant
    .toUpperCase()
    .replace(/[‘’ʼ`´']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function merchantKind(merchant: string): MerchantKind {
  const key = merchantKey(merchant);
  if (NETWORK_TO_NETWORK.test(key)) return 'OWN_TRANSFER';
  if (P2P.test(key)) return 'P2P';
  if (PAYMENT_SERVICE.test(key)) return 'PAYMENT_SERVICE';
  return 'SHOP';
}

/**
 * Legal names on the terminal → one of the default categories, by its Uzbek and Russian name
 * (an account keeps the names it was created with). Earlier entries win: "YANDEXPLUS" is a
 * subscription before "YANDEX" is a ride.
 */
const KNOWN: Array<{ names: string[]; patterns: RegExp }> = [
  {
    names: ["Ko'ngilochar", 'Развлечения'],
    patterns: /YANDEX ?PLUS|NETFLIX|SPOTIFY|MEGOGO|ITUNES|APPLE\.COM|STEAM|PLAYSTATION|CINEMA|KINO/,
  },
  {
    names: ['Transport', 'Транспорт'],
    patterns: /\bATTO\b|TRANSPORT|YANDEX ?GO|TAXI|TAKSI|SCOOTER|METRO|TEMIR YO|UZAIRWAYS|AVTOBUS|BENZIN|\bAZS\b|GAS ?STATION/,
  },
  {
    names: ["Sog'liq", 'Здоровье'],
    patterns: /FARM|PHARM|APTEKA|DORIXONA|KLINIK|CLINIC|MEDICAL|STOMATOLOG/,
  },
  {
    names: ['Kommunal', 'Коммунальные услуги'],
    patterns: /BEELINE|UCELL|UZMOBILE|MOBIUZ|UZTELECOM|HUDUDGAZ|ELEKTR|SUVOKAVA|SUVTA'MINOT|TOSHSHAHARSUV|ISSIQLIK/,
  },
  {
    names: ['Oziq-ovqat', 'Продукты'],
    // ANGLESEY FOOD is the company behind Korzinka.
    patterns: /ANGLESEY|KORZINKA|MAKRO|HAVAS|CARREFOUR|\bFOOD|QANDOLAT|DATES|EVOS|MAX ?WAY|KFC|BELLISSIMO|OQTEPA|SAFIA|LAVASH|BURGER|PIZZA|CAFE|KAFE|RESTORAN|SUPERMARKET/,
  },
];

/** The default category names a known merchant belongs to, or null when the name says nothing. */
export function knownMerchantCategory(merchant: string): string[] | null {
  const key = merchantKey(merchant);
  return KNOWN.find(({ patterns }) => patterns.test(key))?.names ?? null;
}
