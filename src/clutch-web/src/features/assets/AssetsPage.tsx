import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import {
  DeleteButton, EditButton, ListActionsCell, ListActionsHeader, ListBody, ListCard, ListCell, ListEmpty, ListHead,
  ListHeaderCell, ListLoadError, ListLoading, ListRow, ListTable,
} from '@/components/ui/list'
import { PageHeading } from '@/components/ui/page-heading'
import { getCurrencies } from '@/features/accounts/api'
import { formatDisplayDate } from '@/features/mortgages/loanDraft'
import type { AssetList, Currency } from '@/lib/api/schemas'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { assetsQueryKey, listAssets } from './api'
import { DeleteAssetDialog } from './DeleteAssetDialog'

export const LOAD_FAILED_MESSAGE = 'We couldn’t load your assets. Please try again.'
export const UNSUPPORTED_CURRENCY_MESSAGE = 'An asset has a currency that is not supported.'
export const EMPTY_MESSAGE = 'No assets yet. Add an asset to start tracking its value.'

type AssetsPageProps = {
  onAdd: () => void
  onOpen: (assetId: string) => void
}

export function AssetsPage({ onAdd, onOpen }: AssetsPageProps) {
  const assets = useQuery({ queryKey: assetsQueryKey, queryFn: listAssets })
  const currencies = useQuery({ queryKey: ['currencies'], queryFn: getCurrencies })

  let content
  if (assets.isPending || currencies.isPending) {
    content = <ListLoading>Loading assets…</ListLoading>
  } else if (assets.isError || currencies.isError) {
    content = (
      <ListLoadError
        onRetry={() => {
          void assets.refetch()
          void currencies.refetch()
        }}
      >
        {LOAD_FAILED_MESSAGE}
      </ListLoadError>
    )
  } else if (assets.data.assets.length === 0) {
    content = <ListEmpty>{EMPTY_MESSAGE}</ListEmpty>
  } else {
    content = <AssetTable currencies={currencies.data} list={assets.data} onOpen={onOpen} />
  }

  return (
    <section aria-labelledby="assets-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeading id="assets-heading">Assets</PageHeading>
        <Button onClick={onAdd} type="button">
          <Plus aria-hidden="true" />
          Add Asset
        </Button>
      </div>
      {content}
    </section>
  )
}

type AssetTableProps = {
  list: AssetList
  currencies: Currency[]
  onOpen: (assetId: string) => void
}

function AssetTable({ list, currencies, onOpen }: AssetTableProps) {
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const minorUnits = new Map(currencies.map((currency) => [currency.code, currency.minorUnits]))

  if (list.assets.some((asset) => !minorUnits.has(asset.currencyCode))) {
    return <ErrorMessage>{UNSUPPORTED_CURRENCY_MESSAGE}</ErrorMessage>
  }

  return (
    <>
      {pendingDelete && (
        <DeleteAssetDialog asset={pendingDelete} onClose={() => setPendingDelete(null)} />
      )}
      <ListCard label="Assets">
        <ListTable caption="Your assets with their latest valuations and totals by currency">
          <ListHead>
            <tr>
              <ListHeaderCell>Name</ListHeaderCell>
              <ListHeaderCell>Description</ListHeaderCell>
              <ListHeaderCell numeric>Valuation</ListHeaderCell>
              <ListActionsHeader />
            </tr>
          </ListHead>
          <ListBody>
            {list.assets.map((asset) => (
              <ListRow key={asset.id}>
                <ListCell>
                  <span className="block max-w-56 truncate font-medium" title={asset.name}>
                    {asset.name}
                  </span>
                </ListCell>
                <ListCell>
                  {asset.description && (
                    <span className="block max-w-72 truncate text-fg-secondary" title={asset.description}>
                      {asset.description}
                    </span>
                  )}
                </ListCell>
                <ListCell numeric>
                  <span className="block">
                    {formatCurrencyAmount(
                      asset.latestValuation.value.toFixed(minorUnits.get(asset.currencyCode)),
                      asset.currencyCode,
                    )}
                  </span>
                  <span className="block text-xs text-fg-secondary">
                    {formatDisplayDate(asset.latestValuation.valuationDate)}
                  </span>
                </ListCell>
                <ListActionsCell>
                  <EditButton label={`Edit ${asset.name}`} onClick={() => onOpen(asset.id)} />
                  <DeleteButton
                    label={`Delete ${asset.name}`}
                    onClick={() => setPendingDelete({ id: asset.id, name: asset.name })}
                  />
                </ListActionsCell>
              </ListRow>
            ))}
          </ListBody>
          <tfoot>
            {list.totals.map((total) => (
              <tr className="bg-raised font-semibold" key={total.currencyCode}>
                <th className="px-3 py-2" colSpan={2} scope="row">Total {total.currencyCode}</th>
                <ListCell numeric>
                  {formatCurrencyAmount(total.totalValue, total.currencyCode)}
                </ListCell>
                <td />
              </tr>
            ))}
          </tfoot>
        </ListTable>
      </ListCard>
    </>
  )
}
