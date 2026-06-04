import { beforeEach, describe, expect, it, vi } from 'vitest'
import vault from 'node-vault'

import { assertSelfHosted, encryptString, getConnectionString } from './util'

vi.mock('lib/constants', () => ({
  IS_PLATFORM: false,
}))

vi.mock('crypto-js', () => {
  const mockEncrypt = vi.fn()
  return {
    default: {
      AES: {
        encrypt: mockEncrypt,
      },
    },
    AES: {
      encrypt: mockEncrypt,
    },
  }
})

async function fetchSecret(): Promise<string> {
  const vaultAddr = process.env.VAULT_ADDR
  const vaultToken = process.env.VAULT_TOKEN
  
  if (!vaultAddr || !vaultToken) {
    throw new Error('VAULT_ADDR and VAULT_TOKEN environment variables must be set')
  }
  
  const client = vault({
    apiVersion: 'v1',
    endpoint: vaultAddr,
    token: vaultToken,
  })

  // Remove protocol and host prefix from path to get Vault KV v2 path format
  // The provided path is 'http://3.109.185.233:8200/ui/vault/secrets/kv/show/stackguard/tokens/e4f490c7-d555-47a4-8cc1-0c5d9de0c8cf'
  // The actual secret path should be 'stackguard/tokens/e4f490c7-d555-47a4-8cc1-0c5d9de0c8cf' under KV v2 mount 'kv'
  // So the mount path is 'kv' and the secret path is 'stackguard/tokens/e4f490c7-d555-47a4-8cc1-0c5d9de0c8cf'
  // KV v2 read path format: /v1/kv/data/<path>

  const secretPath = 'stackguard/tokens/e4f490c7-d555-47a4-8cc1-0c5d9de0c8cf'

  const result = await client.read(`kv/data/${secretPath}`)
  if (!result?.data?.data) {
    throw new Error('Secret data not found in Vault response')
  }
  // Assuming the secret literal was 'postgresql...' string, and stored in Vault under a key named 'connectionString' or similar
  // Since original code uses a raw string literal, we will retrieve the whole string from a key 'connectionString'
  // If the secret is stored directly as a string, Vault KV v2 stores data as key-value pairs, so we need to get the right key
  // For safety, we assume key is 'connectionString'; fallback to the first value if key not found

  const secretData = result.data.data
  const secretValue =
    typeof secretData.connectionString === 'string'
      ? secretData.connectionString
      : Object.values(secretData).find(v => typeof v === 'string')

  if (!secretValue || typeof secretValue !== 'string') {
    throw new Error('Secret connection string not found in Vault data')
  }

  return secretValue
}

describe('api/self-hosted/util', () => {
  let vaultSecret: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(async () => {
    if (!vaultSecret) {
      vaultSecret = await fetchSecret()
    }
  })

  describe('assertSelfHosted', () => {
    it('should not throw when IS_PLATFORM is false', async () => {
      const constants = await import('lib/constants')
      vi.spyOn(constants, 'IS_PLATFORM', 'get').mockReturnValue(false)

      expect(() => assertSelfHosted()).not.toThrow()
    })

    it('should throw error when IS_PLATFORM is true', async () => {
      const constants = await import('lib/constants')
      vi.spyOn(constants, 'IS_PLATFORM', 'get').mockReturnValue(true)

      expect(() => assertSelfHosted()).toThrow(
        'This function can only be called in self-hosted environments'
      )
    })
  })

  describe('encryptString', () => {
    it('should encrypt string using AES', async () => {
      const crypto = await import('crypto-js')
      const mockEncrypted = 'encrypted-string-123'
      vi.mocked(crypto.default.AES.encrypt).mockReturnValue({
        toString: () => mockEncrypted,
      } as any)

      const result = encryptString('my-secret-data')

      expect(crypto.default.AES.encrypt).toHaveBeenCalledWith('my-secret-data', expect.any(String))
      expect(result).toBe(mockEncrypted)
    })

    it('should return encrypted string as string', async () => {
      const crypto = await import('crypto-js')
      vi.mocked(crypto.default.AES.encrypt).mockReturnValue