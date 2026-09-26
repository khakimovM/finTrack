# @fintrack/shared

Backend va frontend **ikkalasi** ishlatadigan kod. Bu yerdagi Zod sxema bitta nusxada
yashaydi: NestJS uni `createZodDto` bilan DTOga, React `zodResolver` bilan formaga aylantiradi.

```
src/
├── schemas/          auth, account, category, transaction, debt, budget, recurring, stats
├── types/            z.infer natijalari, enumlar
├── money.ts          somToTiyin, tiyinToSom, formatMoney, addMoney, subMoney
├── date.ts           getPeriodRange, formatDate, bucketLabel
└── constants.ts      TRANSACTION_TYPES, PERIOD_PRESETS, ERROR_CODES
```

Qoida: pul arifmetikasi **faqat** `money.ts` da. Zod sxemani `apps/api` yoki `apps/web`
ichida takrorlash taqiqlanadi.
