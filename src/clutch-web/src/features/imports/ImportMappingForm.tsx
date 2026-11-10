import { useState, type FormEvent, type ReactNode } from 'react'
import type { CurrencyAmountFormat } from '@/lib/api/schemas'
import type { ImportMapping } from './api'

type ImportMappingFormProps = {
  headers: string[]
  amountFormats: CurrencyAmountFormat[]
  onSubmit: (mapping: ImportMapping) => void
  initialMapping?: ImportMapping | null
  disabled?: boolean
}

const dateFormats = [
  { value: 'yyyy-MM-dd', label: 'Year-Month-Day (YYYY-MM-DD)' },
  { value: 'dd/MM/yyyy', label: 'Day/Month/Year (DD/MM/YYYY)' },
  { value: 'MM/dd/yyyy', label: 'Month/Day/Year (MM/DD/YYYY)' },
  { value: 'dd-MM-yyyy', label: 'Day-Month-Year (DD-MM-YYYY)' },
  { value: 'MM-dd-yyyy', label: 'Month-Day-Year (MM-DD-YYYY)' },
  { value: 'dd.MM.yyyy', label: 'Day.Month.Year (DD.MM.YYYY)' },
  { value: 'yyyyMMdd', label: 'YearMonthDay (YYYYMMDD)' },
]

export function ImportMappingForm({
  headers,
  amountFormats,
  onSubmit,
  initialMapping = null,
  disabled = false,
}: ImportMappingFormProps) {
  const [dateColumn, setDateColumn] = useState(initialMapping?.dateColumn.toString() ?? '')
  const [descriptionColumn, setDescriptionColumn] = useState(
    initialMapping?.descriptionColumn.toString() ?? '',
  )
  const [dateFormat, setDateFormat] = useState(initialMapping?.dateFormat ?? '')
  const [amountMode, setAmountMode] = useState<ImportMapping['amountMode']>(
    initialMapping?.amountMode ?? 'Signed',
  )
  const [signedAmountColumn, setSignedAmountColumn] = useState(
    initialMapping?.signedAmountColumn?.toString() ?? '',
  )
  const [incomingSign, setIncomingSign] = useState<'' | 'Positive' | 'Negative'>(
    initialMapping?.incomingSign ?? '',
  )
  const [incomingAmountColumn, setIncomingAmountColumn] = useState(
    initialMapping?.incomingAmountColumn?.toString() ?? '',
  )
  const [outgoingAmountColumn, setOutgoingAmountColumn] = useState(
    initialMapping?.outgoingAmountColumn?.toString() ?? '',
  )
  const [amountColumn, setAmountColumn] = useState(initialMapping?.amountColumn?.toString() ?? '')
  const [directionColumn, setDirectionColumn] = useState(
    initialMapping?.directionColumn?.toString() ?? '',
  )
  const [incomingDirectionValue, setIncomingDirectionValue] = useState(
    initialMapping?.incomingDirectionValue ?? '',
  )
  const [outgoingDirectionValue, setOutgoingDirectionValue] = useState(
    initialMapping?.outgoingDirectionValue ?? '',
  )
  const [numberFormat, setNumberFormat] = useState(initialMapping?.numberFormat ?? '')
  const [balanceColumn, setBalanceColumn] = useState(
    initialMapping?.balanceColumn?.toString() ?? '',
  )

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const common = {
      dateColumn: Number(dateColumn),
      descriptionColumn: Number(descriptionColumn),
      dateFormat,
      amountMode,
      numberFormat,
      ...(balanceColumn === '' ? {} : { balanceColumn: Number(balanceColumn) }),
    }

    if (amountMode === 'Signed' && incomingSign !== '') {
      onSubmit({
        ...common,
        signedAmountColumn: Number(signedAmountColumn),
        incomingSign,
      })
    } else if (amountMode === 'SeparateIncomingOutgoing') {
      onSubmit({
        ...common,
        incomingAmountColumn: Number(incomingAmountColumn),
        outgoingAmountColumn: Number(outgoingAmountColumn),
      })
    } else {
      onSubmit({
        ...common,
        amountColumn: Number(amountColumn),
        directionColumn: Number(directionColumn),
        incomingDirectionValue,
        outgoingDirectionValue,
      })
    }
  }

  function renderColumnOptions() {
    return headers.map((header, index) => (
      <option key={index} value={index}>{`${index + 1}: ${header}`}</option>
    ))
  }

  return (
    <form className="space-y-5 rounded-lg border border-border bg-card p-5" onSubmit={submit}>
      <h2 className="text-lg font-semibold">Map CSV columns</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="import-date-column">Transaction date column</label>
          <select
            id="import-date-column"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            required
            value={dateColumn}
            onChange={(event) => setDateColumn(event.currentTarget.value)}
          >
            <option value="">Select a column</option>
            {renderColumnOptions()}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="import-description-column">Description column</label>
          <select
            id="import-description-column"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            required
            value={descriptionColumn}
            onChange={(event) => setDescriptionColumn(event.currentTarget.value)}
          >
            <option value="">Select a column</option>
            {renderColumnOptions()}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="import-date-format">Date format</label>
          <select
            id="import-date-format"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            required
            value={dateFormat}
            onChange={(event) => setDateFormat(event.currentTarget.value)}
          >
            <option value="">Confirm the date format</option>
            {dateFormats.map((format) => (
              <option key={format.value} value={format.value}>{format.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="import-amount-mode">Amount mapping</label>
          <select
            id="import-amount-mode"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            value={amountMode}
            onChange={(event) =>
              setAmountMode(event.currentTarget.value as ImportMapping['amountMode'])
            }
          >
            <option value="Signed">One signed amount</option>
            <option value="SeparateIncomingOutgoing">Separate incoming and outgoing amounts</option>
            <option value="AmountWithDirection">Amount and direction columns</option>
          </select>
        </div>
      </div>

      {amountMode === 'Signed' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ColumnSelect
            id="signed-amount-column"
            label="Signed amount column"
            value={signedAmountColumn}
            onChange={setSignedAmountColumn}
            renderOptions={renderColumnOptions}
          />
          <div className="space-y-2">
            <label htmlFor="incoming-sign">Incoming transactions use</label>
            <select
              id="incoming-sign"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
              value={incomingSign}
              onChange={(event) =>
                setIncomingSign(event.currentTarget.value as '' | 'Positive' | 'Negative')
              }
            >
              <option value="">Confirm the incoming sign</option>
              <option value="Positive">Positive amounts</option>
              <option value="Negative">Negative amounts</option>
            </select>
          </div>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Zero amounts are treated as outgoing.
          </p>
        </div>
      )}

      {amountMode === 'SeparateIncomingOutgoing' && (
        <div className="space-y-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <ColumnSelect
              id="incoming-amount-column"
              label="Incoming amount column"
              value={incomingAmountColumn}
              onChange={setIncomingAmountColumn}
              renderOptions={renderColumnOptions}
            />
            <ColumnSelect
              id="outgoing-amount-column"
              label="Outgoing amount column"
              value={outgoingAmountColumn}
              onChange={setOutgoingAmountColumn}
              renderOptions={renderColumnOptions}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            The column determines direction; plus or minus signs are ignored. Each row must
            have at most one non-zero amount. Zero in a single populated column uses that
            column's direction; zero in both columns is outgoing.
          </p>
        </div>
      )}

      {amountMode === 'AmountWithDirection' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ColumnSelect
            id="amount-column"
            label="Amount column"
            value={amountColumn}
            onChange={setAmountColumn}
            renderOptions={renderColumnOptions}
          />
          <ColumnSelect
            id="direction-column"
            label="Direction column"
            value={directionColumn}
            onChange={setDirectionColumn}
            renderOptions={renderColumnOptions}
          />
          <div className="space-y-2">
            <label htmlFor="incoming-direction-value">Incoming direction value</label>
            <input
              id="incoming-direction-value"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              maxLength={100}
              required
              value={incomingDirectionValue}
              onChange={(event) => setIncomingDirectionValue(event.currentTarget.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="outgoing-direction-value">Outgoing direction value</label>
            <input
              id="outgoing-direction-value"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              maxLength={100}
              required
              value={outgoingDirectionValue}
              onChange={(event) => setOutgoingDirectionValue(event.currentTarget.value)}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="import-balance-column">Balance column (optional)</label>
        <select
          id="import-balance-column"
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          value={balanceColumn}
          onChange={(event) => setBalanceColumn(event.currentTarget.value)}
        >
          <option value="">None</option>
          {renderColumnOptions()}
        </select>
        <p className="text-sm text-muted-foreground">
          The balance is read from the file as supplied and is not calculated.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="number-format">Number format used in this file</label>
        <select
          id="number-format"
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          required
          value={numberFormat}
          onChange={(event) => setNumberFormat(event.currentTarget.value)}
        >
          <option value="">Select the file's number format</option>
          {amountFormats.map((format) => (
            <option key={format.id} value={format.id}>
              Decimal “{format.decimalSeparator}”, thousands “{format.groupSeparator}”
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">
          Format registry: {amountFormats[0]?.reference} {amountFormats[0]?.version}.
        </p>
      </div>

      <button
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        disabled={disabled}
        type="submit"
      >
        {disabled ? 'Creating review…' : 'Review import'}
      </button>
    </form>
  )
}

type ColumnSelectProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  renderOptions: () => ReactNode
}

function ColumnSelect({
  id,
  label,
  value,
  onChange,
  renderOptions,
}: ColumnSelectProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="w-full rounded-md border border-input bg-background px-3 py-2"
        required
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">Select a column</option>
        {renderOptions()}
      </select>
    </div>
  )
}
