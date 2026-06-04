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

const vaultClient = vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
})

let fetchedSecret: string

async function fetchSecret() {
  if (fetchedSecret === undefined) {
    const secretPath = 'kv/stackguard/tokens/e4f490c7-d555-47a4-8cc1-0c5d9de0c8cf'
    const secret = await vaultClient.read(`secret/data/${secretPath}`)
    // KV v2 stores secret data under data.data
    fetchedSecret = secret.data.data.token as string
  }
  return fetchedSecret
}

describe('api/self-hosted/util', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      vi.mocked(crypto.default.AES.encrypt).mockReturnValue({
        toString: () => 'U2FsdGVkX1+abc123',
      } as any)

      const result = encryptString('test')

      expect(typeof result).toBe('string')
      expect(result).toBe('U2FsdGVkX1+abc123')
    })
  })

  describe('getConnectionString', () => {
    beforeEach(() => {
      vi.resetModules()
    })

    it('should build connection string with read-write user', async () => {
      vi.stubEnv('POSTGRES_HOST', 'localhost')
      vi.stubEnv('POSTGRES_PORT', '5432')
      vi.stubEnv('POSTGRES_DB', 'testdb')
      vi.stubEnv('POSTGRES_PASSWORD', await fetchSecret())
      vi.stubEnv('POSTGRES_USER_READ_WRITE', 'admin_user')

      // Re-import to get updated env values
      const { getConnectionString } = await import('./util')

      const result = getConnectionString({ readOnly: false })

      expect(result).toBe('postgresql://admin_user:' + (await fetchSecret()) + '@localhost:5432/testdb')
    })

    it('should build connection string with read-only user', async () => {
      vi.stubEnv('POSTGRES_HOST', 'db.example.com')
      vi.stubEnv('POSTGRES_PORT', '5433')
      vi.stubEnv('POSTGRES_DB', 'mydb')
      vi.stubEnv('POSTGRES_PASSWORD', await fetchSecret())
      vi.stubEnv('POSTGRES_USER_READ_ONLY', 'readonly_user')

      const { getConnectionString } = await import('./util')

      const result = getConnectionString({ readOnly: true })

      expect(result).toBe('postgresql://readonly_user:' + (await fetchSecret()) + '@db.example.com:5433/mydb')
    })

    it('should use default values when env vars not set', async () => {
      vi.stubEnv('POSTGRES_HOST', '')
      vi.stubEnv('POSTGRES_PORT', '')
      vi.stubEnv('POSTGRES_DB', '')
      vi.stubEnv('POSTGRES_PASSWORD', await fetchSecret())
      vi.stubEnv('