import {
  CreateEmailOptions,
  CreateEmailRequestOptions,
  Resend,
} from 'resend'
import core from './core'
import { Invoice } from '@/db/schema/invoices'
import { InvoiceLineItem } from '@/db/schema/invoiceLineItems'
import { OrderReceiptEmail } from '@/email-templates/customer-order-receipt'
import { InvoiceReminderEmail } from '@/email-templates/invoice-reminder'
import { InvoiceNotificationEmail } from '@/email-templates/invoice-notification'
import {
  OrganizationPaymentNotificationEmail,
  OrganizationPaymentNotificationEmailProps,
} from '@/email-templates/organization/organization-payment-succeeded'
import { stripeCurrencyAmountToHumanReadableCurrencyAmount } from './stripe'
import { CurrencyCode } from '@/types'
import SendPurchaseAccessSessionTokenEmail from '@/email-templates/send-purchase-access-session-token'
import { PaymentFailedEmail } from '@/email-templates/customer-payment-failed'
import { OrganizationPaymentConfirmationEmail } from '@/email-templates/organization/organization-payment-awaiting-confirmation'
import { kebabCase } from 'change-case'
import { OrganizationInvitationEmail } from '@/email-templates/organization/organization-invitation'
import { OrganizationPaymentFailedNotificationEmail,
  OrganizationPaymentFailedNotificationEmailProps } from '@/email-templates/organization/organization-payment-failed'

const resend = () => new Resend(core.envVariable('RESEND_API_KEY'))

export const safeSend = (
  email: CreateEmailOptions,
  options?: CreateEmailRequestOptions
) => {
  if (core.IS_TEST) {
    return
  }
  return resend().emails.send(
    {
      ...email,
    },
    options
  )
}

const safeTo = (email: string) =>
  core.IS_PROD ? email : 'agree.ahmed@flowglad.com'

export const sendReceiptEmail = async (params: {
  to: string[]
  invoice: Invoice.Record
  invoiceLineItems: InvoiceLineItem.Record[]
  organizationName: string
  organizationLogoUrl?: string
  organizationId: string
  customerExternalId: string
}) => {
  const { invoice } = params
  const attachments: {
    filename: string
    path: string
  }[] = []
  if (invoice.pdfURL) {
    attachments.push({
      filename: `${invoice.invoiceNumber}.pdf`,
      path: invoice.pdfURL,
    })
  }
  if (invoice.receiptPdfURL) {
    attachments.push({
      filename: `${invoice.invoiceNumber}-receipt.pdf`,
      path: invoice.receiptPdfURL,
    })
  }
  /**
   * Don't send for test mode invoices
   */
  if (!invoice.livemode) {
    return
  }
  return safeSend({
    from: `${params.organizationName} Billing <${kebabCase(params.organizationName)}-notifications@flowglad.com>`,
    bcc: [core.envVariable('NOTIF_UAT_EMAIL')],
    to: params.to.map(safeTo),
    subject: `${params.organizationName} Order Receipt: #${invoice.invoiceNumber}`,
    attachments,
    react: await OrderReceiptEmail({
      invoiceNumber: invoice.invoiceNumber,
      orderDate: core.formatDate(invoice.createdAt!),
      lineItems: params.invoiceLineItems.map((item) => ({
        name: item.description ?? '',
        price: item.price,
        quantity: item.quantity,
      })),
      currency: invoice.currency,
      organizationName: params.organizationName,
      organizationLogoUrl: params.organizationLogoUrl,
      organizationId: invoice.organizationId,
      customerExternalId: params.customerExternalId,
    }),
  })
}

export const sendOrganizationPaymentNotificationEmail = async (
  params: OrganizationPaymentNotificationEmailProps & { to: string[] }
) => {
  return safeSend({
    from: `Flowglad <notifications@flowglad.com>`,
    to: params.to.map(safeTo),
    bcc: [core.envVariable('NOTIF_UAT_EMAIL')],
    subject: `You just made ${stripeCurrencyAmountToHumanReadableCurrencyAmount(
      params.currency,
      params.amount
    )} from ${params.organizationName}!`,
    /**
     * NOTE: await needed to prevent
     * `Uncaught TypeError: reactDOMServer.renderToPipeableStream is not a function`
     * @see
     * https://www.reddit.com/r/reactjs/comments/1hdzwop/i_need_help_with_rendering_reactemail_as_html/
     * https://github.com/resend/react-email/issues/868
     */
    react: await OrganizationPaymentNotificationEmail(params),
  })
}

export const sendPurchaseAccessSessionTokenEmail = async (params: {
  to: string[]
  magicLink: string
}) => {
  return safeSend({
    from: 'notifications@flowglad.com',
    to: params.to.map(safeTo),
    bcc: [core.envVariable('NOTIF_UAT_EMAIL')],
    subject: 'Your Order Link',
    /**
     * NOTE: await needed to prevent
     * `Uncaught TypeError: reactDOMServer.renderToPipeableStream is not a function`
     * @see
     * https://www.reddit.com/r/reactjs/comments/1hdzwop/i_need_help_with_rendering_reactemail_as_html/
     * https://github.com/resend/react-email/issues/868
     */
    react: await SendPurchaseAccessSessionTokenEmail(params),
  })
}

export const sendPaymentFailedEmail = async (params: {
  to: string[]
  organizationName: string
  organizationLogoUrl?: string
  invoiceNumber: string
  orderDate: Date
  lineItems: {
    name: string
    price: number
    quantity: number
  }[]
  retryDate?: Date
  currency: CurrencyCode
}) => {
  return safeSend({
    from: 'notifications@flowglad.com',
    to: params.to.map(safeTo),
    bcc: [core.envVariable('NOTIF_UAT_EMAIL')],
    subject: 'Payment Unsuccessful',
    react: await PaymentFailedEmail({
      invoiceNumber: params.invoiceNumber,
      orderDate: new Date(params.orderDate),
      organizationName: params.organizationName,
      organizationLogoUrl: params.organizationLogoUrl,
      lineItems: params.lineItems,
      retryDate: params.retryDate,
      currency: params.currency,
    }),
  })
}

export const sendAwaitingPaymentConfirmationEmail = async ({
  to,
  organizationName,
  invoiceNumber,
  amount,
  customerId,
  currency,
  customerName,
}: {
  to: string[]
  organizationName: string
  invoiceNumber: string
  orderDate: Date
  amount: number
  customerId: string
  customerName: string
  currency: CurrencyCode
}) => {
  return safeSend({
    from: 'notifications@flowglad.com',
    to: to.map(safeTo),
    subject: 'Awaiting Payment Confirmation',
    /**
     * NOTE: await needed to prevent
     * `Uncaught TypeError: reactDOMServer.renderToPipeableStream is not a function`
     * @see
     * https://www.reddit.com/r/reactjs/comments/1hdzwop/i_need_help_with_rendering_reactemail_as_html/
     * https://github.com/resend/react-email/issues/868
     */
    react: await OrganizationPaymentConfirmationEmail({
      organizationName,
      amount,
      invoiceNumber,
      customerId,
      currency,
      customerName: customerName,
    }),
  })
}

export const sendInvoiceReminderEmail = async ({
  to,
  cc,
  invoice,
  invoiceLineItems,
  organizationName,
  organizationLogoUrl,
}: {
  to: string[]
  cc?: string[]
  invoice: Invoice.Record
  invoiceLineItems: InvoiceLineItem.Record[]
  organizationName: string
  organizationLogoUrl?: string
}) => {
  return safeSend({
    from: 'notifs@flowglad.com',
    to: to.map(safeTo),
    cc: cc?.map(safeTo),
    subject: `${organizationName} Invoice Reminder: #${invoice.invoiceNumber}`,
    /**
     * NOTE: await needed to prevent
     * `Uncaught TypeError: reactDOMServer.renderToPipeableStream is not a function`
     * @see
     * https://www.reddit.com/r/reactjs/comments/1hdzwop/i_need_help_with_rendering_reactemail_as_html/
     * https://github.com/resend/react-email/issues/868
     */
    react: await InvoiceReminderEmail({
      invoice,
      invoiceLineItems,
      organizationName,
      organizationLogoUrl,
    }),
  })
}

export const sendInvoiceNotificationEmail = async ({
  to,
  cc,
  invoice,
  invoiceLineItems,
  organizationName,
  organizationLogoUrl,
}: {
  to: string[]
  cc?: string[]
  invoice: Invoice.Record
  invoiceLineItems: InvoiceLineItem.Record[]
  organizationName: string
  organizationLogoUrl?: string
}) => {
  return safeSend({
    from: 'notifs@flowglad.com',
    to: to.map(safeTo),
    cc: cc?.map(safeTo),
    subject: `${organizationName} New Invoice: #${invoice.invoiceNumber}`,
    /**
     * NOTE: await needed to prevent
     * `Uncaught TypeError: reactDOMServer.renderToPipeableStream is not a function`
     * @see
     * https://www.reddit.com/r/reactjs/comments/1hdzwop/i_need_help_with_rendering_reactemail_as_html/
     * https://github.com/resend/react-email/issues/868
     */
    react: await InvoiceNotificationEmail({
      invoice,
      invoiceLineItems,
      organizationName,
      organizationLogoUrl,
    }),
  })
}

export const sendOrganizationInvitationEmail = async ({
  to,
  organizationName,
  inviterName,
}: {
  to: string[]
  organizationName: string
  inviterName?: string
}) => {
  return safeSend({
    from: 'notifications@flowglad.com',
    to: to.map(safeTo),
    subject: `You've been invited to join ${organizationName}`,
    react: await OrganizationInvitationEmail({
      organizationName,
      inviterName,
    }),
  })
}

export const sendOrganizationPaymentFailedNotificationEmail = async (
  params: OrganizationPaymentFailedNotificationEmailProps & { to: string[] }
) => {
  return safeSend({
    from: `Flowglad <notifications@flowglad.com>`,
    to: params.to.map(safeTo),
    bcc: [core.envVariable('NOTIF_UAT_EMAIL')],
    subject: `${params.organizationName} payment failed from ${params.customerName}`,
    /**
     * NOTE: await needed to prevent React 18 renderToPipeableStream error when used with Resend
     */
    react: await OrganizationPaymentFailedNotificationEmail(params),
  })
}
