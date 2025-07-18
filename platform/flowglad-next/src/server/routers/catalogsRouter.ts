import { protectedProcedure, router } from '@/server/trpc'
import {
  catalogsClientSelectSchema,
  catalogsPaginatedListSchema,
  catalogsPaginatedSelectSchema,
  catalogIdSchema,
  createCatalogSchema,
  editCatalogSchema,
  cloneCatalogInputSchema,
} from '@/db/schema/catalogs'
import {
  authenticatedProcedureComprehensiveTransaction,
  authenticatedProcedureTransaction,
  authenticatedTransaction,
} from '@/db/authenticatedTransaction'
import {
  insertCatalog,
  selectCatalogsPaginated,
  selectCatalogsWithProductsAndUsageMetersByCatalogWhere,
  selectCatalogsTableRows,
  safelyUpdateCatalog,
} from '@/db/tableMethods/catalogMethods'
import { generateOpenApiMetas, RouteConfig } from '@/utils/openapi'
import { z } from 'zod'
import { cloneCatalogTransaction } from '@/utils/catalog'
import { setupCatalogTransaction } from '@/utils/catalogs/setupTransaction'
import { catalogWithProductsAndUsageMetersSchema } from '@/db/schema/prices'
import {
  createPaginatedTableRowInputSchema,
  createPaginatedTableRowOutputSchema,
} from '@/db/tableUtils'
import { setupCatalogSchema } from '@/utils/catalogs/setupSchemas'

const { openApiMetas, routeConfigs } = generateOpenApiMetas({
  resource: 'catalog',
  tags: ['Catalogs'],
})

export const catalogsRouteConfigs = routeConfigs
export const getDefaultCatalogRouteConfig: Record<
  string,
  RouteConfig
> = {
  'GET /catalogs/default': {
    procedure: 'catalogs.getDefault',
    pattern: new RegExp(`^catalogs\/default$`),
    mapParams: (matches) => ({
      externalId: matches[0],
    }),
  },
}

const listCatalogsProcedure = protectedProcedure
  .meta(openApiMetas.LIST)
  .input(catalogsPaginatedSelectSchema)
  .output(catalogsPaginatedListSchema)
  .query(async ({ ctx, input }) => {
    return authenticatedTransaction(
      async ({ transaction }) => {
        return selectCatalogsPaginated(input, transaction)
      },
      {
        apiKey: ctx.apiKey,
      }
    )
  })

const getCatalogProcedure = protectedProcedure
  .meta(openApiMetas.GET)
  .input(catalogIdSchema)
  .output(
    z.object({ catalog: catalogWithProductsAndUsageMetersSchema })
  )
  .query(async ({ ctx, input }) => {
    return authenticatedTransaction(
      async ({ transaction }) => {
        const [catalog] =
          await selectCatalogsWithProductsAndUsageMetersByCatalogWhere(
            { id: input.id },
            transaction
          )
        if (!catalog) {
          throw new Error(`Catalog ${input.id} not found`)
        }
        return { catalog }
      },
      {
        apiKey: ctx.apiKey,
      }
    )
  })

const createCatalogProcedure = protectedProcedure
  .meta(openApiMetas.POST)
  .input(createCatalogSchema)
  .output(
    z.object({
      catalog: catalogsClientSelectSchema,
    })
  )
  .mutation(async ({ input, ctx }) => {
    const catalog = await authenticatedTransaction(
      async ({ transaction }) => {
        return insertCatalog(
          {
            ...input.catalog,
            livemode: ctx.livemode,
            organizationId: ctx.organizationId!,
          },
          transaction
        )
      },
      {
        apiKey: ctx.apiKey,
      }
    )
    return { catalog }
  })

const editCatalogProcedure = protectedProcedure
  .meta(openApiMetas.PUT)
  .input(editCatalogSchema)
  .output(
    z.object({
      catalog: catalogsClientSelectSchema,
    })
  )
  .mutation(
    authenticatedProcedureComprehensiveTransaction(
      async ({ input, transaction }) => {
        const catalog = await safelyUpdateCatalog(
          {
            ...input.catalog,
            id: input.id,
          },
          transaction
        )
        return { result: { catalog } }
      }
    )
  )

const getDefaultCatalogProcedure = protectedProcedure
  .meta({
    openapi: {
      method: 'GET',
      path: '/api/v1/catalogs/default',
      summary: 'Get Default Catalog for Organization',
      tags: ['Catalogs'],
      protect: true,
    },
  })
  .input(z.object({}))
  .output(
    z.object({ catalog: catalogWithProductsAndUsageMetersSchema })
  )
  .query(async ({ ctx }) => {
    const catalog = await authenticatedTransaction(
      async ({ transaction }) => {
        const [defaultCatalog] =
          await selectCatalogsWithProductsAndUsageMetersByCatalogWhere(
            {
              organizationId: ctx.organizationId!,
              livemode: ctx.livemode,
            },
            transaction
          )
        if (!defaultCatalog) {
          throw new Error('Default catalog not found')
        }
        return defaultCatalog
      },
      {
        apiKey: ctx.apiKey,
      }
    )
    return { catalog }
  })

const cloneCatalogProcedure = protectedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/api/v1/catalogs/{id}/clone',
      summary: 'Clone a Catalog',
      tags: ['Catalogs'],
      protect: true,
    },
  })
  .input(cloneCatalogInputSchema)
  .output(
    z.object({ catalog: catalogWithProductsAndUsageMetersSchema })
  )
  .mutation(async ({ input, ctx }) => {
    return authenticatedTransaction(
      async ({ transaction }) => {
        const catalog = await cloneCatalogTransaction(
          input,
          transaction
        )
        return { catalog }
      },
      {
        apiKey: ctx.apiKey,
      }
    )
  })

const getTableRowsProcedure = protectedProcedure
  .input(createPaginatedTableRowInputSchema(z.object({})))
  .output(
    createPaginatedTableRowOutputSchema(
      z.object({
        catalog: catalogsClientSelectSchema,
        productsCount: z.number(),
      })
    )
  )
  .query(authenticatedProcedureTransaction(selectCatalogsTableRows))

const setupCatalogProcedure = protectedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/api/v1/catalogs/setup',
      summary: 'Setup a Catalog',
      tags: ['Catalogs'],
      protect: true,
    },
  })
  .input(setupCatalogSchema)
  .output(
    z.object({ catalog: catalogWithProductsAndUsageMetersSchema })
  )
  .mutation(
    authenticatedProcedureComprehensiveTransaction(
      async ({ input, transaction, ctx }) => {
        const result = await setupCatalogTransaction(
          {
            input,
            organizationId: ctx.organizationId!,
            livemode: ctx.livemode,
          },
          transaction
        )
        const [catalogWithProductsAndUsageMeters] =
          await selectCatalogsWithProductsAndUsageMetersByCatalogWhere(
            { id: result.catalog.id },
            transaction
          )
        return {
          result: { catalog: catalogWithProductsAndUsageMeters },
        }
      }
    )
  )

export const catalogsRouter = router({
  list: listCatalogsProcedure,
  setup: setupCatalogProcedure,
  get: getCatalogProcedure,
  getDefault: getDefaultCatalogProcedure,
  create: createCatalogProcedure,
  update: editCatalogProcedure,
  clone: cloneCatalogProcedure,
  getTableRows: getTableRowsProcedure,
})
