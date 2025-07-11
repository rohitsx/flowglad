'use client'
import Breadcrumb from '@/components/navigation/Breadcrumb'
import InternalPageContainer from '@/components/InternalPageContainer'
import PageTitle from '@/components/ion/PageTitle'
import { RichSubscription } from '@/subscriptions/schemas'
import TableTitle from '@/components/ion/TableTitle'
import PaymentsTable from '../../payments/PaymentsTable'
import { useAuthContext } from '@/contexts/authContext'
import SubscriptionItemsTable from './SubscriptionItemsTable'
import SubscriptionStatusBadge from '../SubscriptionStatusBadge'
import core from '@/utils/core'
import { PaymentMethod } from '@/db/schema/paymentMethods'
import { CardPaymentMethodLabel } from '@/components/PaymentMethodLabel'
import { PaymentMethodType } from '@/types'
import Label from '@/components/ion/Label'
import InvoicesTable from '@/components/InvoicesTable'

const InnerSubscriptionPage = ({
  subscription,
  defaultPaymentMethod,
}: {
  subscription: RichSubscription
  defaultPaymentMethod: PaymentMethod.ClientRecord | null
}) => {
  const { organization } = useAuthContext()
  if (!organization) {
    return <div>Loading...</div>
  }
  return (
    <InternalPageContainer>
      <div className="w-full relative flex flex-col justify-center gap-6 pb-6">
        <div className="w-full relative flex flex-col justify-center gap-8 pb-6">
          <Breadcrumb />
          <div className="flex flex-col">
            <div className="flex flex-row justify-between items-center mb-6 gap-8">
              <PageTitle className="flex flex-row items-center gap-2">
                {subscription.name ?? 'Subscription'}
              </PageTitle>
            </div>
            <SubscriptionStatusBadge status={subscription.status} />
          </div>
        </div>
        <TableTitle title="Details" noButtons />
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <Label>Dates</Label>
            <div className="flex w-full">
              {core.formatDate(subscription.startDate)}
              {subscription.canceledAt
                ? ` - ${core.formatDate(subscription.canceledAt)}`
                : ' -'}
            </div>
            <div className="flex w-full flex-col gap-2">
              <Label>Payment Method</Label>
              {defaultPaymentMethod &&
                defaultPaymentMethod.type ===
                  PaymentMethodType.Card && (
                  <CardPaymentMethodLabel
                    brand={
                      defaultPaymentMethod.paymentMethodData
                        .brand as string
                    }
                    last4={
                      defaultPaymentMethod.paymentMethodData
                        .last4 as string
                    }
                  />
                )}
            </div>
          </div>
        </div>
        <TableTitle title="Items" noButtons />
        <SubscriptionItemsTable
          subscriptionItems={subscription.subscriptionItems}
        />
        <TableTitle title="Invoices" noButtons />
        <InvoicesTable
          filters={{ subscriptionId: subscription.id }}
        />
        <TableTitle title="Payments" noButtons />
        <PaymentsTable
          filters={{ subscriptionId: subscription.id }}
        />
      </div>
    </InternalPageContainer>
  )
}

export default InnerSubscriptionPage
