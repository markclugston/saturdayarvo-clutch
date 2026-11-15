import { z } from 'zod'
import { apiRequest } from '@/lib/api/client'
import {
  AccountSchema,
  CurrencySchema,
  type Account,
  type Currency,
} from '@/lib/api/schemas'

const AccountsSchema = z.array(AccountSchema)
const CurrenciesSchema = z.array(CurrencySchema)
const EmptyResponseSchema = z.undefined()

export function getAccounts(): Promise<Account[]> {
  return apiRequest('/api/accounts', AccountsSchema)
}

export function getAccount(accountId: string): Promise<Account> {
  return apiRequest(`/api/accounts/${encodeURIComponent(accountId)}`, AccountSchema)
}

export function getCurrencies(): Promise<Currency[]> {
  return apiRequest('/api/currencies', CurrenciesSchema)
}

export function createAccount(description: string, currencyCode: string): Promise<Account> {
  return apiRequest('/api/accounts', AccountSchema, {
    method: 'POST',
    body: JSON.stringify({ description, currencyCode }),
  })
}

export function deleteTransaction(
  accountId: string,
  transactionId: string,
  signal?: AbortSignal,
): Promise<void> {
  const timeoutSignal = AbortSignal.timeout(8000)
  const requestSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal

  return apiRequest(
    `/api/accounts/${encodeURIComponent(accountId)}/transactions/${encodeURIComponent(transactionId)}`,
    EmptyResponseSchema,
    { method: 'DELETE', signal: requestSignal },
  ).then(() => undefined)
}

export function updateAccountDescription(
  accountId: string,
  description: string,
): Promise<Account> {
  return apiRequest(`/api/accounts/${encodeURIComponent(accountId)}`, AccountSchema, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  })
}
