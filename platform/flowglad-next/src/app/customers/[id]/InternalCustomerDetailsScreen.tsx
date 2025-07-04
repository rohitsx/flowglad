// Generated with Ion on 10/10/2024, 7:03:48 PM
// Figma Link: https://www.figma.com/design/3fYHKpBnD7eYSAmfSvPhvr?node-id=727:33232
'use client'
import { useState } from 'react'
import { Customer } from '@/db/schema/customers'
import { Purchase } from '@/db/schema/purchases'
import { Payment } from '@/db/schema/payments'
import { InvoiceWithLineItems } from '@/db/schema/invoiceLineItems'
import { CustomerBillingSubPage } from './CustomerDetailsBillingTab'
import { Price } from '@/db/schema/prices'
import InternalPageContainer from '@/components/InternalPageContainer'
import Breadcrumb from '@/components/navigation/Breadcrumb'
import PageTitle from '@/components/ion/PageTitle'
import Button from '@/components/ion/Button'
import { Pencil, Ellipsis } from 'lucide-react'
import PopoverMenu, {
  PopoverMenuItem,
} from '@/components/PopoverMenu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ion/Popover'
import EditCustomerModal from '@/components/forms/EditCustomerModal'
import { Tab, Tabs, TabsList } from '@/components/ion/Tab'

function InternalCustomerDetailsScreen({
  customer,
  purchases,
  invoices,
  payments,
}: {
  customer: Customer.ClientRecord
  purchases: Purchase.ClientRecord[]
  invoices: InvoiceWithLineItems[]
  payments: Payment.ClientRecord[]
  prices: Price.ClientRecord[]
}) {
  const [isEditOpen, setIsEditOpen] = useState(false)

  const moreMenuItems: PopoverMenuItem[] = [
    {
      label: 'Email customer',
      handler: () => {
        if (customer.email) {
          window.open(`mailto:${customer.email}`)
        }
      },
    },
  ]

  return (
    <InternalPageContainer>
      <div className="w-full flex flex-col gap-6">
        <div className="w-full relative flex flex-col justify-center gap-8 pb-6">
          <Breadcrumb />
          <div className="flex flex-row items-center justify-between">
            <div className="min-w-0 overflow-hidden mr-4">
              <PageTitle className="truncate whitespace-nowrap overflow-hidden text-ellipsis">
                {customer.name ?? ''}
              </PageTitle>
            </div>
            <div className="flex flex-row gap-4 justify-end flex-shrink-0">
              <Button
                iconLeading={<Pencil size={16} />}
                onClick={() => setIsEditOpen(true)}
              >
                Edit
              </Button>
              <Popover>
                <PopoverTrigger className="flex">
                  <Button
                    className="flex justify-center items-center border-primary"
                    variant="outline"
                  >
                    <Ellipsis className="rotate-90 w-4 h-6" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-fit" align="end">
                  <PopoverMenu items={moreMenuItems} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <Tabs className="w-full flex border-b border-stroke-subtle text-sm font-semibold">
          <TabsList className="gap-8">
            <Tab
              state={'selected'}
              className="h-full first:pl-0 last:pr-0 first:ml-0 last:mr-0 text-lg"
              title={'Billing'}
              value={'billing'}
              key={'billing'}
            />
          </TabsList>
        </Tabs>
        <div className="pt-6">
          <CustomerBillingSubPage
            customer={customer}
            purchases={purchases}
            invoices={invoices}
            payments={payments}
          />
        </div>
      </div>
      <EditCustomerModal
        isOpen={isEditOpen}
        setIsOpen={setIsEditOpen}
        customer={customer}
      />
    </InternalPageContainer>
  )
}

export default InternalCustomerDetailsScreen
