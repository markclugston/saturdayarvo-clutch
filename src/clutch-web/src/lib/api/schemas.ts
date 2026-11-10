import { z } from 'zod'

export const ProblemDetailsSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().int().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
}).passthrough()

export const CurrencyAmountFormatSchema = z.object({
  id: z.string().min(1),
  decimalSeparator: z.string().min(1),
  groupSeparator: z.string().min(1),
  reference: z.string().min(1),
  version: z.string().min(1),
})

export const CurrencySchema = z.object({
  code: z.string().regex(/^[A-Z]{3}$/),
  name: z.string().min(1),
  amountFormats: z.array(CurrencyAmountFormatSchema).min(1),
})

export const AccountSchema = z.object({
  id: z.uuid(),
  description: z.string().min(1).max(200),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  lastSuccessfulImportAtUtc: z.iso.datetime({ offset: true }).nullable().optional(),
})

export const ImportReviewRowSchema = z.object({
  sourceRowNumber: z.number().int().min(2),
  transactionDate: z.iso.date(),
  description: z.string().min(1).max(200),
  amount: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
  direction: z.enum(['Incoming', 'Outgoing']),
  isPossibleDuplicate: z.boolean(),
  balance: z.string().regex(/^-?[0-9]+(\.[0-9]+)?$/).nullable().optional(),
})

export const ImportReviewSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  rowCount: z.number().int().positive(),
  duplicateConfirmationRequired: z.boolean(),
  expiresAtUtc: z.iso.datetime({ offset: true }),
  rows: z.array(ImportReviewRowSchema),
})

export const ConfirmImportResponseSchema = z.object({
  importedCount: z.number().int().positive(),
  completedAtUtc: z.iso.datetime({ offset: true }),
  settingsSaved: z.boolean(),
})

export const ImportMappingSchema = z.object({
  dateColumn: z.number().int().nonnegative(),
  descriptionColumn: z.number().int().nonnegative(),
  dateFormat: z.string().min(1),
  amountMode: z.enum(['Signed', 'SeparateIncomingOutgoing', 'AmountWithDirection']),
  signedAmountColumn: z.number().int().nonnegative().nullable().optional(),
  incomingAmountColumn: z.number().int().nonnegative().nullable().optional(),
  outgoingAmountColumn: z.number().int().nonnegative().nullable().optional(),
  amountColumn: z.number().int().nonnegative().nullable().optional(),
  directionColumn: z.number().int().nonnegative().nullable().optional(),
  incomingSign: z.enum(['Positive', 'Negative']).nullable().optional(),
  incomingDirectionValue: z.string().nullable().optional(),
  outgoingDirectionValue: z.string().nullable().optional(),
  numberFormat: z.string().min(1),
  balanceColumn: z.number().int().nonnegative().nullable().optional(),
}).strict()

export const AccountImportSettingsSchema = z.object({
  mapping: ImportMappingSchema.nullable(),
})

export const TransactionSchema = z.object({
  id: z.uuid(),
  transactionDate: z.iso.date(),
  description: z.string().min(1).max(200),
  amount: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
  direction: z.enum(['Incoming', 'Outgoing']),
  balance: z.string().regex(/^-?[0-9]+(\.[0-9]+)?$/).nullable().optional(),
})

export const TransactionPageSchema = z.object({
  items: z.array(TransactionSchema),
  nextCursor: z.string().nullable().optional(),
})

export const SessionSchema = z.object({
  id: z.string().min(1),
  roles: z.array(z.string()).optional(),
})

export const ImportLimitsSchema = z.object({
  maxFileSizeBytes: z.number().int().positive(),
  maxRowsPerImport: z.number().int().positive(),
  maxImportAttemptsPerUserPerMinute: z.number().int().positive(),
})

export const CsrfTokenSchema = z.object({
  requestToken: z.string().min(1),
})

export const ThemeModeSchema = z.enum(['Light', 'Dark', 'System'])

export const ThemePreferenceSchema = z.object({
  mode: ThemeModeSchema,
}).strict()

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>
export type Currency = z.infer<typeof CurrencySchema>
export type CurrencyAmountFormat = z.infer<typeof CurrencyAmountFormatSchema>
export type Account = z.infer<typeof AccountSchema>
export type ImportReview = z.infer<typeof ImportReviewSchema>
export type ImportReviewRow = z.infer<typeof ImportReviewRowSchema>
export type AccountImportSettings = z.infer<typeof AccountImportSettingsSchema>
export type TransactionItem = z.infer<typeof TransactionSchema>
export type TransactionPage = z.infer<typeof TransactionPageSchema>
export type UserSession = z.infer<typeof SessionSchema>
export type ImportLimits = z.infer<typeof ImportLimitsSchema>
export type ThemeMode = z.infer<typeof ThemeModeSchema>
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>
