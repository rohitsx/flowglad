import { useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import Table from '@/components/ion/Table'
import ColumnHeaderCell from '@/components/ion/ColumnHeaderCell'
import { Webhook } from '@/db/schema/webhooks'
import CopyableTextTableCell from '@/components/CopyableTextTableCell'
import StatusBadge from '@/components/StatusBadge'
import MoreMenuTableCell from '@/components/MoreMenuTableCell'
import { trpc } from '@/app/_trpc/client'
import WebhookSecretModal from './WebhookSecretModal'
import EditWebhookModal from '@/components/forms/EditWebhookModal'
import { PopoverMenuItem } from '@/components/PopoverMenu'
import { usePaginatedTableState } from '@/app/hooks/usePaginatedTableState'

export interface WebhooksTableFilters {
  active?: boolean
  organizationId?: string
}

const MoreMenuCell = ({
  webhook,
}: {
  webhook: Webhook.ClientRecord
}) => {
  const [isSecretModalOpen, setIsSecretModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [webhookSecret, setWebhookSecret] = useState<string>('')
  const requestSecret = trpc.webhooks.requestSigningSecret.useQuery(
    {
      webhookId: webhook.id,
    },
    {
      enabled: false,
    }
  )

  const handleShowSecret = async () => {
    const result = await requestSecret.refetch()
    setWebhookSecret(result.data?.secret || '')
    setIsSecretModalOpen(true)
  }

  const items: PopoverMenuItem[] = [
    {
      label: 'Show Signing Secret',
      handler: handleShowSecret,
    },
    {
      label: 'Edit Webhook',
      handler: () => setIsEditModalOpen(true),
    },
  ]

  return (
    <MoreMenuTableCell items={items}>
      <WebhookSecretModal
        secret={webhookSecret}
        isOpen={isSecretModalOpen}
        setIsOpen={setIsSecretModalOpen}
      />
      <EditWebhookModal
        isOpen={isEditModalOpen}
        setIsOpen={setIsEditModalOpen}
        webhook={webhook}
      />
    </MoreMenuTableCell>
  )
}

const WebhooksTable = ({
  filters = {},
}: {
  filters?: WebhooksTableFilters
}) => {
  const {
    pageIndex,
    pageSize,
    handlePaginationChange,
    data,
    isLoading,
    isFetching,
  } = usePaginatedTableState<
    { webhook: Webhook.ClientRecord },
    WebhooksTableFilters
  >({
    initialCurrentCursor: undefined,
    pageSize: 10,
    filters,
    useQuery: trpc.webhooks.getTableRows.useQuery,
  })

  const columns = useMemo(
    () =>
      [
        {
          header: ({ column }) => (
            <ColumnHeaderCell title="Name" column={column} />
          ),
          accessorKey: 'name',
          cell: ({ row: { original: cellData } }) => (
            <span className="text-sm">{cellData.name}</span>
          ),
        },
        {
          header: ({ column }) => (
            <ColumnHeaderCell title="URL" column={column} />
          ),
          accessorKey: 'url',
          cell: ({ row: { original: cellData } }) => (
            <CopyableTextTableCell copyText={cellData.url}>
              {cellData.url}
            </CopyableTextTableCell>
          ),
        },
        {
          header: ({ column }) => (
            <ColumnHeaderCell title="Status" column={column} />
          ),
          accessorKey: 'active',
          cell: ({ row: { original: cellData } }) => (
            <StatusBadge active={cellData.active} />
          ),
        },
        {
          header: ({ column }) => (
            <ColumnHeaderCell title="ID" column={column} />
          ),
          accessorKey: 'id',
          cell: ({ row: { original: cellData } }) => (
            <CopyableTextTableCell copyText={cellData.id}>
              {cellData.id}
            </CopyableTextTableCell>
          ),
        },
        {
          id: 'actions',
          cell: ({ row: { original: cellData } }) => (
            <MoreMenuCell webhook={cellData} />
          ),
        },
      ] as ColumnDef<Webhook.ClientRecord>[],
    []
  )

  const tableData = data?.items.map((item) => item.webhook) || []
  const total = data?.total || 0

  return (
    <Table
      columns={columns}
      data={tableData}
      className="bg-nav"
      bordered
      pagination={{
        pageIndex,
        pageSize,
        total,
        onPageChange: handlePaginationChange,
        isLoading,
        isFetching,
      }}
    />
  )
}

export default WebhooksTable
