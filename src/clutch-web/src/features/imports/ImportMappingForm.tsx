import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { CardTitle } from '@/components/ui/card'
import { FloatingField } from '@/components/ui/floating-field'
import type { CurrencyAmountFormat } from '@/lib/api/schemas'
import type { ImportMapping } from './api'

type ImportMappingFormProps = {
  headers: string[] | null
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
    if (!headers || disabled) {
      return
    }
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
    if (!headers) {
      const savedColumns = [
        initialMapping?.dateColumn,
        initialMapping?.descriptionColumn,
        initialMapping?.signedAmountColumn,
        initialMapping?.incomingAmountColumn,
        initialMapping?.outgoingAmountColumn,
        initialMapping?.amountColumn,
        initialMapping?.directionColumn,
      ].filter((column): column is number => typeof column === 'number')
      return [...new Set(savedColumns)].sort((a, b) => a - b).map((column) => (
        <option key={column} value={column}>{`Column ${column + 1}`}</option>
      ))
    }
    return headers.map((header, index) => (
      <option key={index} value={index}>{`${index + 1}: ${header}`}</option>
    ))
  }

  return (
    <form id="import-mapping" className="space-y-5" onSubmit={submit}>
      <CardTitle as="h2">Map CSV columns</CardTitle>
      {!headers && (
        <p>Choose a CSV file to see its column names and review the import.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <ColumnSelect
          id="import-date-column"
          label="Transaction date column"
          value={dateColumn}
          onChange={setDateColumn}
          renderOptions={renderColumnOptions}
        />
        <ColumnSelect
          id="import-description-column"
          label="Description column"
          value={descriptionColumn}
          onChange={setDescriptionColumn}
          renderOptions={renderColumnOptions}
        />
        <FloatingField
          as="select"
          id="import-date-format"
          label="Date format"
          required
          value={dateFormat}
          onChange={(event) => setDateFormat(event.currentTarget.value)}
        >
          <option value="">Confirm the date format</option>
          {dateFormats.map((format) => (
            <option key={format.value} value={format.value}>{format.label}</option>
          ))}
        </FloatingField>
        <FloatingField
          as="select"
          id="import-amount-mode"
          label="Amount mapping"
          value={amountMode}
          onChange={(event) =>
            setAmountMode(event.currentTarget.value as ImportMapping['amountMode'])
          }
        >
          <option value="Signed">One signed amount</option>
          <option value="SeparateIncomingOutgoing">Separate incoming and outgoing amounts</option>
          <option value="AmountWithDirection">Amount and direction columns</option>
        </FloatingField>
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
          <FloatingField
            as="select"
            id="incoming-sign"
            label="Incoming transactions use"
            required
            value={incomingSign}
            onChange={(event) =>
              setIncomingSign(event.currentTarget.value as '' | 'Positive' | 'Negative')
            }
          >
            <option value="">Confirm the incoming sign</option>
            <option value="Positive">Positive amounts</option>
            <option value="Negative">Negative amounts</option>
          </FloatingField>
          <p className="text-sm text-fg-secondary sm:col-span-2">
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
          <p className="text-sm text-fg-secondary">
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
          <FloatingField
            id="incoming-direction-value"
            label="Incoming direction value"
            maxLength={100}
            required
            value={incomingDirectionValue}
            onChange={(event) => setIncomingDirectionValue(event.currentTarget.value)}
          />
          <FloatingField
            id="outgoing-direction-value"
            label="Outgoing direction value"
            maxLength={100}
            required
            value={outgoingDirectionValue}
            onChange={(event) => setOutgoingDirectionValue(event.currentTarget.value)}
          />
        </div>
      )}

      <FloatingField
        as="select"
        description={{
          id: 'import-balance-column-help',
          text: 'The balance is read from the file as supplied and is not calculated.',
        }}
        id="import-balance-column"
        label="Balance column (optional)"
        value={balanceColumn}
        onChange={(event) => setBalanceColumn(event.currentTarget.value)}
      >
        <option value="">None</option>
        {renderColumnOptions()}
      </FloatingField>

      <FloatingField
        as="select"
        description={{
          id: 'number-format-help',
          text: `Format registry: ${amountFormats[0]?.reference} ${amountFormats[0]?.version}.`,
        }}
        id="number-format"
        label="Number format used in this file"
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
      </FloatingField>

      <Button disabled={disabled || !headers} type="submit">
        {disabled ? 'Creating review…' : 'Review import'}
      </Button>
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
    <FloatingField
      as="select"
      id={id}
      label={label}
      required
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      <option value="">Select a column</option>
      {renderOptions()}
    </FloatingField>
  )
}
