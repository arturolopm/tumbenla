import 'server-only'

import { z } from 'zod'

import { env } from '@/config/env'
import { db } from '@/database'
import { getBaseUrl } from '@/lib/utils/urls'
import {
  EpaycoCollectionGateway,
  FakeCollectionGateway,
  type GatewayBinding,
  RegistryGatewaySelectionStrategy,
} from './gateways'
import { notifyApprovedOrder } from './order-notifications'
import { CommercePaymentService } from './payment-service'

const historicalConfigSchema = z.object({
  configVersion: z.string().min(1),
  accountId: z.string().min(1),
  environment: z.enum(['test', 'live']),
  publicKey: z.string().min(1),
  privateKey: z.string().min(1),
  pKey: z.string().min(1),
  merchantName: z.string().min(1),
})

type EpaycoConfig = z.infer<typeof historicalConfigSchema>

const required = (value: string | undefined, name: string): string => {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`${name} is required when ePayco commerce checkout is enabled`)
  return normalized
}

const historicalConfigs = (): readonly EpaycoConfig[] => {
  const raw = env.EPAYCO_PREVIOUS_CONFIGS_JSON?.trim()
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('EPAYCO_PREVIOUS_CONFIGS_JSON must be valid JSON')
  }
  return z.array(historicalConfigSchema).max(7).parse(parsed)
}

const currentEpaycoConfig = (): EpaycoConfig => ({
  configVersion: required(env.COMMERCE_PAYMENT_CONFIG_VERSION, 'COMMERCE_PAYMENT_CONFIG_VERSION'),
  accountId: required(env.EPAYCO_CUSTOMER_ID, 'EPAYCO_CUSTOMER_ID'),
  environment:
    env.COMMERCE_PAYMENT_ENVIRONMENT ??
    (() => {
      throw new Error('COMMERCE_PAYMENT_ENVIRONMENT is required when ePayco is enabled')
    })(),
  publicKey: required(env.EPAYCO_PUBLIC_KEY, 'EPAYCO_PUBLIC_KEY'),
  privateKey: required(env.EPAYCO_PRIVATE_KEY, 'EPAYCO_PRIVATE_KEY'),
  pKey: required(env.EPAYCO_P_KEY, 'EPAYCO_P_KEY'),
  merchantName: required(env.EPAYCO_MERCHANT_NAME, 'EPAYCO_MERCHANT_NAME'),
})

const epaycoBinding = (config: EpaycoConfig): GatewayBinding => ({
  provider: 'epayco',
  configVersion: config.configVersion,
  accountId: config.accountId,
  environment: config.environment,
})

export const resolveCommerceNewOperationsEnabled = (input: {
  configured?: string
  nodeEnvironment?: string
  vercelEnvironment?: string
}): boolean => {
  const configured = input.configured?.trim().toLowerCase()
  if (configured) return configured === 'true' || configured === '1'
  return input.nodeEnvironment !== 'production' && !input.vercelEnvironment
}

export const commerceNewOperationsEnabled = (): boolean =>
  resolveCommerceNewOperationsEnabled({
    configured: env.COMMERCE_NEW_OPERATIONS_ENABLED,
    nodeEnvironment: process.env.NODE_ENV,
    vercelEnvironment: process.env.VERCEL_ENV,
  })

export const createConfiguredGatewaySelection = (): RegistryGatewaySelectionStrategy => {
  const provider =
    env.COMMERCE_PAYMENT_PROVIDER ??
    (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV ? 'epayco' : 'fake')

  if (provider === 'fake') {
    const binding: GatewayBinding = {
      provider: 'fake',
      configVersion: env.COMMERCE_PAYMENT_CONFIG_VERSION?.trim() || 'local-v1',
      accountId: 'local-test-account',
      environment: 'test',
    }
    const gateway = new FakeCollectionGateway({ binding })
    return new RegistryGatewaySelectionStrategy(binding, [gateway])
  }

  const applicationOrigin = getBaseUrl()
  const activeConfig = currentEpaycoConfig()
  const expectedFunding = activeConfig.environment === 'live' ? 'real' : 'sandbox'
  if (env.COMMERCE_FUNDING_CLASSIFICATION !== expectedFunding) {
    throw new Error(
      `COMMERCE_FUNDING_CLASSIFICATION must be ${expectedFunding} for the active ePayco environment`
    )
  }
  const configs = [activeConfig, ...historicalConfigs()]
  const gateways = configs.map(
    (config) =>
      new EpaycoCollectionGateway({
        binding: epaycoBinding(config),
        publicKey: config.publicKey,
        privateKey: config.privateKey,
        pKey: config.pKey,
        merchantName: config.merchantName,
        applicationOrigin,
      })
  )
  return new RegistryGatewaySelectionStrategy(epaycoBinding(activeConfig), gateways)
}

export const createCommercePaymentService = (): CommercePaymentService =>
  new CommercePaymentService({
    database: db,
    gateways: createConfiguredGatewaySelection(),
    notifyApproval: notifyApprovedOrder,
  })
