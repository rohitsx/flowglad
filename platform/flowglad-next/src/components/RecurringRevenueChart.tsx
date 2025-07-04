'use client'
import { differenceInHours } from 'date-fns'
import React from 'react'
import { TooltipCallbackProps } from '@/components/charts/AreaChart'
import { RevenueTooltip } from '@/components/RevenueTooltip'
import { stripeCurrencyAmountToHumanReadableCurrencyAmount } from '@/utils/stripe'
import core from '@/utils/core'
import { RevenueChartIntervalUnit } from '@/types'
import { trpc } from '@/app/_trpc/client'
import { FallbackSkeleton, Skeleton } from './ion/Skeleton'
import { useAuthenticatedContext } from '@/contexts/authContext'
import { LineChart } from './charts/LineChart'

/**
 * Two dots make a graph principle: this is the minimum range duration required
 * in hours, required to display a multi-point graph
 */
const minimumUnitInHours: Record<RevenueChartIntervalUnit, number> = {
  [RevenueChartIntervalUnit.Year]: 24 * 365 * 2,
  [RevenueChartIntervalUnit.Month]: 24 * 30 * 2,
  [RevenueChartIntervalUnit.Week]: 24 * 7 * 2,
  [RevenueChartIntervalUnit.Day]: 24 * 2,
  [RevenueChartIntervalUnit.Hour]: 1 * 2,
} as const

/**
 * Component for displaying Monthly Recurring Revenue (MRR) data in a chart
 */
export const RecurringRevenueChart = ({
  fromDate,
  toDate,
  productId,
}: {
  fromDate: Date
  toDate: Date
  productId?: string
}) => {
  const { organization } = useAuthenticatedContext()
  const [interval, setInterval] =
    React.useState<RevenueChartIntervalUnit>(
      RevenueChartIntervalUnit.Month
    )

  const { data: mrrData, isLoading } =
    trpc.organizations.getMRR.useQuery({
      startDate: fromDate,
      endDate: toDate,
      granularity: interval,
    })
  const [tooltipData, setTooltipData] =
    React.useState<TooltipCallbackProps | null>(null)
  const defaultCurrency = organization?.defaultCurrency
  const chartData = React.useMemo(() => {
    if (!mrrData) return []
    if (!defaultCurrency) return []
    return mrrData.map((item) => {
      const formattedRevenue =
        stripeCurrencyAmountToHumanReadableCurrencyAmount(
          defaultCurrency,
          item.amount
        )
      return {
        date: item.month.toLocaleDateString(),
        formattedRevenue,
        revenue: Number(item.amount).toFixed(2),
      }
    })
  }, [mrrData, defaultCurrency])

  // Calculate max value for better visualization,
  // fitting the y axis to the max value in the data
  const maxValue = React.useMemo(() => {
    if (!mrrData?.length) return 0
    const max = Math.max(...mrrData.map((item) => item.amount))
    return max
  }, [mrrData])
  const firstPayloadValue = tooltipData?.payload?.[0]?.value
  const formattedMRRValue = React.useMemo(() => {
    if (!mrrData?.length || !defaultCurrency) {
      return '0.00'
    }
    /**
     * If the tooltip is active, we use the value from the tooltip
     */
    if (firstPayloadValue) {
      return stripeCurrencyAmountToHumanReadableCurrencyAmount(
        defaultCurrency,
        firstPayloadValue
      )
    }
    /**
     * If the tooltip is not active, we use the last value in the chart
     */
    const amount = mrrData[mrrData.length - 1].amount
    return stripeCurrencyAmountToHumanReadableCurrencyAmount(
      defaultCurrency,
      amount
    )
  }, [mrrData, defaultCurrency, firstPayloadValue])

  const timespanInHours = differenceInHours(toDate, fromDate)
  const tooltipLabel = tooltipData?.label
  let isTooltipLabelDate: boolean = false
  if (tooltipLabel) {
    try {
      new Date(tooltipLabel as string).toISOString()
      isTooltipLabelDate = true
    } catch {
      isTooltipLabelDate = false
    }
  }
  return (
    <div className="w-full h-full">
      <div className="flex flex-row gap-2 justify-between">
        <div className="text-sm text-gray-700 dark:text-gray-300 w-fit flex items-center flex-row">
          <p className="whitespace-nowrap">MRR</p>
        </div>
      </div>

      <div className="mt-2">
        <FallbackSkeleton
          showSkeleton={isLoading}
          className="w-36 h-12"
        >
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            {formattedMRRValue}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {isTooltipLabelDate
              ? core.formatDate(new Date(tooltipLabel as string))
              : core.formatDateRange({ fromDate, toDate })}
          </p>
        </FallbackSkeleton>
      </div>
      {isLoading ? (
        <div className="-mb-2 mt-8 flex items-center">
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <LineChart
          data={chartData}
          index="date"
          categories={['revenue']}
          className="-mb-2 mt-8"
          colors={['amber']}
          customTooltip={RevenueTooltip}
          maxValue={maxValue}
          autoMinValue={false}
          minValue={0}
          startEndOnly={true}
          startEndOnlyYAxis={true}
          valueFormatter={(value: number) =>
            stripeCurrencyAmountToHumanReadableCurrencyAmount(
              organization?.defaultCurrency!,
              value
            )
          }
          yAxisValueFormatter={(value: number) =>
            stripeCurrencyAmountToHumanReadableCurrencyAmount(
              organization?.defaultCurrency!,
              value
            )
          }
          tooltipCallback={(props: any) => {
            if (props.active) {
              setTooltipData((prev) => {
                if (prev?.label === props.label) return prev
                return props
              })
            } else {
              setTooltipData(null)
            }
          }}
        />
      )}
    </div>
  )
}
