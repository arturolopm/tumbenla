import type {
  CollectionGateway,
  CollectionProvider,
  GatewayBinding,
  GatewaySelection,
  GatewaySelectionContext,
  GatewaySelectionStrategy,
} from './contract'
import { gatewayBindingKey } from './contract'

const sameBinding = (left: GatewayBinding, right: GatewayBinding): boolean =>
  gatewayBindingKey(left) === gatewayBindingKey(right)

/**
 * Registry-backed selection keeps current-provider choice separate from historical resolution.
 * Rotating credentials creates a new configVersion; it never mutates an existing binding.
 */
export class RegistryGatewaySelectionStrategy implements GatewaySelectionStrategy {
  readonly #activeBinding: GatewayBinding
  readonly #gateways: ReadonlyMap<string, CollectionGateway>

  constructor(activeBinding: GatewayBinding, gateways: readonly CollectionGateway[]) {
    const byBinding = new Map<string, CollectionGateway>()

    for (const gateway of gateways) {
      const key = gatewayBindingKey(gateway.binding)
      if (byBinding.has(key)) {
        throw new Error(`Duplicate collection gateway binding: ${key}`)
      }
      byBinding.set(key, gateway)
    }

    if (!byBinding.has(gatewayBindingKey(activeBinding))) {
      throw new Error('The active collection gateway binding is not registered')
    }

    this.#activeBinding = Object.freeze({ ...activeBinding })
    this.#gateways = byBinding
  }

  selectForNewAttempt(_context: GatewaySelectionContext): GatewaySelection {
    const gateway = this.resolvePersisted(this.#activeBinding)
    return { binding: this.#activeBinding, gateway }
  }

  resolvePersisted(binding: GatewayBinding): CollectionGateway {
    const gateway = this.#gateways.get(gatewayBindingKey(binding))
    if (!gateway || !sameBinding(gateway.binding, binding)) {
      throw new Error('No collection gateway is registered for the persisted binding')
    }
    return gateway
  }

  resolveCandidates(provider: CollectionProvider): readonly CollectionGateway[] {
    return [...this.#gateways.values()].filter((gateway) => gateway.binding.provider === provider)
  }
}
