'use client'

import FormModal from '@/components/forms/FormModal'
import {
  CreateFeatureInput,
  createFeatureSchema,
} from '@/db/schema/features'
import FeatureFormFields from './FeatureFormFields' // Adjusted import
import { trpc } from '@/app/_trpc/client'
import { FeatureType } from '@/types'
import { useAuthenticatedContext } from '@/contexts/authContext'

interface CreateFeatureModalProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  defaultCatalogId: string
}

const CreateFeatureModal: React.FC<CreateFeatureModalProps> = ({
  isOpen,
  setIsOpen,
  defaultCatalogId,
}) => {
  const createFeatureMutation = trpc.features.create.useMutation() // Adjusted endpoint
  const { livemode } = useAuthenticatedContext()
  return (
    <FormModal<CreateFeatureInput>
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title="Create Feature"
      formSchema={createFeatureSchema}
      defaultValues={{
        feature: {
          type: FeatureType.Toggle, // Default to Toggle
          name: '',
          slug: '',
          description: '',
          catalogId: defaultCatalogId,
          amount: null,
          usageMeterId: null,
          renewalFrequency: null,
          active: true,
          livemode,
        },
      }}
      onSubmit={async (data) => {
        await createFeatureMutation.mutateAsync(data)
      }}
    >
      <FeatureFormFields />
    </FormModal>
  )
}

export default CreateFeatureModal
