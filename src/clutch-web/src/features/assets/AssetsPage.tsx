import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
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
    content = (
      <div aria-busy="true" className="flex items-center gap-3 text-fg-secondary" role="status">
        <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin motion-reduce:animate-none" />
        <p>Loading assets…</p>
      </div>
    )
  } else if (assets.isError || currencies.isError) {
    content = (
      <div className="space-y-3">
        <ErrorMessage>{LOAD_FAILED_MESSAGE}</ErrorMessage>
        <Button
          onClick={() => {
            void assets.refetch()
            void currencies.refetch()
          }}
          type="button"
          variant="secondary"
        >
          Retry
        </Button>
      </div>
    )
  } else if (assets.data.assets.length === 0) {
    content = (
      <Card>
        <p className="text-fg-secondary">{EMPTY_MESSAGE}</p>
      </Card>
    )
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
    <Card className="min-w-0">
      {pendingDelete && (
        <DeleteAssetDialog asset={pendingDelete} onClose={() => setPendingDelete(null)} />
      )}
      <div
        aria-label="Assets"
        // Positioned, so screen-reader-only text far along a wide table scrolls with it.
        className="relative overflow-x-auto rounded-control focus-visible:focus-ring"
        role="region"
        tabIndex={0}
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Your assets with their latest valuations and totals by currency</caption>
          <thead className="bg-raised">
            <tr>
              <th className="px-3 py-2" scope="col">Name</th>
              <th className="px-3 py-2" scope="col">Description</th>
              <th className="px-3 py-2 text-right" scope="col">Valuation</th>
              <th className="px-3 py-2 text-right" scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {list.assets.map((asset) => (
              // The name button is the keyboard route; its click reaches the row like any other.
              <tr
                className="hairline-b cursor-pointer transition-colors hover:bg-hover"
                key={asset.id}
                onClick={() => onOpen(asset.id)}
              >
                <td className="px-3 py-2">
                  <button
                    className="block min-h-10 max-w-56 cursor-pointer truncate rounded-control text-left font-medium text-primary focus-visible:focus-ring"
                    title={asset.name}
                    type="button"
                  >
                    {asset.name}
                  </button>
                </td>
                <td className="px-3 py-2">
                  {asset.description && (
                    <span className="block max-w-72 truncate text-fg-secondary" title={asset.description}>
                      {asset.description}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  <span className="block">
                    {formatCurrencyAmount(
                      asset.latestValuation.value.toFixed(minorUnits.get(asset.currencyCode)),
                      asset.currencyCode,
                    )}
                  </span>
                  <span className="block text-xs text-fg-secondary">
                    {formatDisplayDate(asset.latestValuation.valuationDate)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    aria-label={`Delete ${asset.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setPendingDelete({ id: asset.id, name: asset.name })
                    }}
                    size="icon"
                    type="button"
                    variant="tertiary"
                  >
                    <Trash2 aria-hidden="true" className="size-4 text-danger" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {list.totals.map((total) => (
              <tr className="bg-raised font-semibold" key={total.currencyCode}>
                <th className="px-3 py-2" colSpan={2} scope="row">Total {total.currencyCode}</th>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {formatCurrencyAmount(total.totalValue, total.currencyCode)}
                </td>
                <td />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
