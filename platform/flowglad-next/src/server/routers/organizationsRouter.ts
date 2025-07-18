import { router } from '@/server/trpc'
import { protectedProcedure } from '@/server/trpc'
import { adminTransaction } from '@/db/adminTransaction'
import {
  authenticatedProcedureTransaction,
  authenticatedTransaction,
} from '@/db/authenticatedTransaction'
import {
  selectMembershipsAndUsersByMembershipWhere,
  selectFocusedMembershipAndOrganization,
  selectMembershipsTableRowData,
} from '@/db/tableMethods/membershipMethods'
import {
  membershipsClientSelectSchema,
  membershipsTableRowDataSchema,
} from '@/db/schema/memberships'
import { updateOrganization } from '@/db/tableMethods/organizationMethods'
import { selectRevenueDataForOrganization } from '@/db/tableMethods/paymentMethods'
import {
  createOrganizationSchema,
  organizationsClientSelectSchema,
  editOrganizationSchema,
} from '@/db/schema/organizations'
import { getRevenueDataInputSchema } from '@/db/schema/payments'
import { z } from 'zod'
import { createOrganizationTransaction } from '@/utils/organizationHelpers'
import { stackServerApp } from '@/stack'
import { requestStripeConnectOnboardingLink } from '@/server/mutations/requestStripeConnectOnboardingLink'
import { inviteUserToOrganization } from '../mutations/inviteUserToOrganization'
import {
  calculateMRRByMonth,
  calculateMRRBreakdown,
  calculateARR,
} from '@/utils/billing-dashboard/revenueCalculationHelpers'
import {
  calculateActiveSubscribersByMonth,
  calculateSubscriberBreakdown,
  getCurrentActiveSubscribers,
} from '@/utils/billing-dashboard/subscriberCalculationHelpers'
import { RevenueChartIntervalUnit } from '@/types'
import {
  selectMembershipsAndOrganizationsByMembershipWhere,
  updateMembership,
} from '@/db/tableMethods/membershipMethods'
import { TRPCError } from '@trpc/server'
import { createPaginatedTableRowInputSchema } from '@/db/tableUtils'
import { createPaginatedTableRowOutputSchema } from '@/db/tableUtils'

const generateSubdomainSlug = (name: string) => {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphen
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .slice(0, 50) // Enforce max length - 63 is the max for subdomains, but we'll be using 50 to make room for distinguishing suffix
      .replace(/^[^a-z0-9]+/, '') // Ensure starts with alphanumeric
      .replace(/[^a-z0-9]+$/, '') || // Ensure ends with alphanumeric
    'invalid-subdomain'
  ) // Fallback if result is empty
}

const getMembers = protectedProcedure
  .input(z.object({}))
  .query(async ({ ctx, input }) => {
    if (!ctx.organizationId) {
      throw new Error('organizationId is required')
    }

    const members = await adminTransaction(
      async ({ transaction }) => {
        return selectMembershipsAndUsersByMembershipWhere(
          { organizationId: ctx.organizationId },
          transaction
        )
      }
    )

    // Sort members by date of creation, newest first
    const sortedMembers = members.sort((a, b) => {
      return (
        new Date(b.membership.createdAt).getTime() -
        new Date(a.membership.createdAt).getTime()
      )
    })
    const total = sortedMembers.length

    return {
      data: sortedMembers,
      total,
    }
  })

const getFocusedMembership = protectedProcedure
  .output(
    z.object({
      membership: membershipsClientSelectSchema,
      organization: organizationsClientSelectSchema,
    })
  )
  .query(
    authenticatedProcedureTransaction(
      async ({ userId, transaction }) => {
        const focusedMembership =
          await selectFocusedMembershipAndOrganization(
            userId,
            transaction
          )
        return focusedMembership
      }
    )
  )

const getRevenueData = protectedProcedure
  .input(getRevenueDataInputSchema)
  .output(
    z.array(
      z.object({
        date: z.date(),
        revenue: z.number(),
      })
    )
  )
  .query(
    authenticatedProcedureTransaction(
      async ({ input, ctx, transaction }) => {
        return selectRevenueDataForOrganization(input, transaction)
      }
    )
  )

const getMRRCalculationInputSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  granularity: z.nativeEnum(RevenueChartIntervalUnit),
})

const getMRR = protectedProcedure
  .input(getMRRCalculationInputSchema)
  .output(
    z.array(
      z.object({
        month: z.date(),
        amount: z.number(),
      })
    )
  )
  .query(
    authenticatedProcedureTransaction(
      async ({ input, ctx, transaction }) => {
        if (!ctx.organizationId) {
          throw new Error('organizationId is required')
        }

        return calculateMRRByMonth(
          ctx.organizationId!,
          input,
          transaction
        )
      }
    )
  )

const getARR = protectedProcedure.query(
  authenticatedProcedureTransaction(async ({ ctx, transaction }) => {
    if (!ctx.organizationId) {
      throw new Error('organizationId is required')
    }

    return calculateARR(ctx.organizationId!, transaction)
  })
)

const getMRRBreakdownInputSchema = z.object({
  currentMonth: z.date(),
  previousMonth: z.date(),
})

const getMRRBreakdown = protectedProcedure
  .input(getMRRBreakdownInputSchema)
  .query(
    authenticatedProcedureTransaction(
      async ({ input, ctx, transaction }) => {
        if (!ctx.organizationId) {
          throw new Error('organizationId is required')
        }

        return calculateMRRBreakdown(
          ctx.organizationId!,
          input.currentMonth,
          input.previousMonth,
          transaction
        )
      }
    )
  )

const getActiveSubscribersInputSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  granularity: z.nativeEnum(RevenueChartIntervalUnit),
})

const getActiveSubscribers = protectedProcedure
  .input(getActiveSubscribersInputSchema)
  .output(
    z.array(
      z.object({
        month: z.date(),
        count: z.number(),
      })
    )
  )
  .query(
    authenticatedProcedureTransaction(
      async ({ input, ctx, transaction }) => {
        if (!ctx.organizationId) {
          throw new Error('organizationId is required')
        }

        return calculateActiveSubscribersByMonth(
          ctx.organizationId!,
          input,
          transaction
        )
      }
    )
  )

const getSubscriberBreakdownInputSchema = z.object({
  currentMonth: z.date(),
  previousMonth: z.date(),
})

const getSubscriberBreakdown = protectedProcedure
  .input(getSubscriberBreakdownInputSchema)
  .query(
    authenticatedProcedureTransaction(
      async ({ input, ctx, transaction }) => {
        if (!ctx.organizationId) {
          throw new Error('organizationId is required')
        }

        return calculateSubscriberBreakdown(
          ctx.organizationId!,
          input.currentMonth,
          input.previousMonth,
          transaction
        )
      }
    )
  )

const getCurrentSubscribers = protectedProcedure.query(
  authenticatedProcedureTransaction(async ({ ctx, transaction }) => {
    if (!ctx.organizationId) {
      throw new Error('organizationId is required')
    }

    return getCurrentActiveSubscribers(
      { organizationId: ctx.organizationId! },
      transaction
    )
  })
)

const getOrganizations = protectedProcedure.query(async ({ ctx }) => {
  return authenticatedTransaction(
    async ({ transaction, userId }) => {
      // Get all memberships and organizations for the user
      const membershipsAndOrganizations =
        await selectMembershipsAndOrganizationsByMembershipWhere(
          { userId },
          transaction
        )

      // Extract just the organizations
      const organizations = membershipsAndOrganizations.map(
        ({ organization }) => organization
      )

      return organizations
    },
    {
      apiKey: ctx.apiKey,
    }
  )
})

const createOrganization = protectedProcedure
  .input(createOrganizationSchema)
  .output(
    z.object({
      organization: organizationsClientSelectSchema,
    })
  )
  .mutation(async ({ input }) => {
    const user = await stackServerApp.getUser()

    if (!user) {
      throw new Error('User not found')
    }
    const email = user.primaryEmail
    const userId = user.id
    if (!email) {
      throw new Error('User email not found')
    }

    const result = await adminTransaction(async ({ transaction }) => {
      return createOrganizationTransaction(
        input,
        {
          id: userId,
          email,
          fullName: user.displayName ?? undefined,
        },
        transaction
      )
    })

    return {
      organization: result.organization,
    }
  })

const editOrganization = protectedProcedure
  .input(editOrganizationSchema)
  .mutation(
    authenticatedProcedureTransaction(
      async ({ input, transaction, userId }) => {
        const { organization } = input
        await updateOrganization(organization, transaction)
        return {
          data: organization,
        }
      }
    )
  )

const updateFocusedMembershipSchema = z.object({
  organizationId: z.string(),
})

const updateFocusedMembership = protectedProcedure
  .input(updateFocusedMembershipSchema)
  .mutation(
    authenticatedProcedureTransaction(
      async ({ input, transaction, userId }) => {
        // First, get all memberships for this user
        const userMemberships =
          await selectMembershipsAndOrganizationsByMembershipWhere(
            { userId },
            transaction
          )

        // Set all memberships to not focused
        for (const membership of userMemberships) {
          await updateMembership(
            {
              id: membership.membership.id,
              focused: false,
            },
            transaction
          )
        }

        // Find the membership to focus
        const membershipToFocus = userMemberships.find(
          (m) => m.membership.organizationId === input.organizationId
        )

        if (!membershipToFocus) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Membership not found',
          })
        }

        // Set the selected membership to focused
        return updateMembership(
          {
            id: membershipToFocus.membership.id,
            focused: true,
          },
          transaction
        )
      }
    )
  )

const getMembersTableRowData = protectedProcedure
  .input(createPaginatedTableRowInputSchema(z.object({})))
  .output(
    createPaginatedTableRowOutputSchema(membershipsTableRowDataSchema)
  )
  .query(async (args) => {
    const focusedMembership = await authenticatedTransaction(
      async ({ transaction, userId }) => {
        return selectFocusedMembershipAndOrganization(
          userId,
          transaction
        )
      }
    )
    /**
     * Force overwrite the organizationId because we need to do an admin transaction
     * to give the user visbility into their teammates. Due to limitations of RLS,
     * we can't do this in the authenticated transaction as memberships
     * is the "root" basis of most of our RLS policies.
     */
    return adminTransaction(async ({ transaction }) => {
      return selectMembershipsTableRowData({
        input: {
          ...args.input,
          filters: {
            ...args.input.filters,
            organizationId: focusedMembership.organization.id,
          },
        },
        transaction,
      })
    })
  })

export const organizationsRouter = router({
  create: createOrganization,
  update: editOrganization,
  requestStripeConnect: requestStripeConnectOnboardingLink,
  getMembers: getMembers,
  getMembersTableRowData: getMembersTableRowData,
  getFocusedMembership: getFocusedMembership,
  updateFocusedMembership: updateFocusedMembership,
  getOrganizations: getOrganizations,
  inviteUser: inviteUserToOrganization,
  // Revenue is a sub-resource of organizations
  getRevenue: getRevenueData,
  // MRR-related endpoints for the billing dashboard
  getMRR: getMRR,
  getARR: getARR,
  getMRRBreakdown: getMRRBreakdown,
  // Subscriber-related endpoints for the billing dashboard
  getActiveSubscribers: getActiveSubscribers,
  getSubscriberBreakdown: getSubscriberBreakdown,
  getCurrentSubscribers: getCurrentSubscribers,
})
