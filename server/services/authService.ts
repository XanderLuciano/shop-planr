import { generateKeyPair, SignJWT, jwtVerify, importPKCS8, importSPKI, exportPKCS8, exportSPKI } from 'jose'
import { hashSync, compareSync } from 'bcryptjs'
import type { CryptoKey as JoseCryptoKey, KeyObject } from 'jose'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { CryptoKeyRepository } from '../repositories/interfaces/cryptoKeyRepository'
import type { ShopUser } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { AuthenticationError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'

const ALGORITHM = 'ES256'
const JWT_EXPIRY_SECONDS = 86400 // 24 hours
const BCRYPT_ROUNDS = 10
const PIN_REGEX = /^\d{4}$/

export interface JwtPayload {
  sub: string
  username: string
  displayName: string
  isAdmin: boolean
  department?: string
  active: boolean
  createdAt: string
  iat: number
  exp: number
}

export function createAuthService(repos: {
  users: UserRepository
  cryptoKeys: CryptoKeyRepository
}) {
  type SigningKey = JoseCryptoKey | KeyObject
  let cachedPublicKey: SigningKey | null = null
  let cachedPrivateKey: SigningKey | null = null

  async function ensureKeyPair(): Promise<void> {
    const existing = repos.cryptoKeys.getByAlgorithm(ALGORITHM)
    if (existing) {
      cachedPublicKey = await importSPKI(existing.publicKey, ALGORITHM)
      cachedPrivateKey = await importPKCS8(existing.privateKey, ALGORITHM)
      return
    }

    const { publicKey, privateKey } = await generateKeyPair(ALGORITHM, { extractable: true })
    const publicPem = await exportSPKI(publicKey)
    const privatePem = await exportPKCS8(privateKey)

    repos.cryptoKeys.create({
      id: generateId('key'),
      algorithm: ALGORITHM,
      publicKey: publicPem,
      privateKey: privatePem,
      createdAt: new Date().toISOString(),
    })

    cachedPublicKey = publicKey
    cachedPrivateKey = privateKey
  }

  async function getPublicKey(): Promise<SigningKey> {
    if (cachedPublicKey) return cachedPublicKey
    const row = repos.cryptoKeys.getByAlgorithm(ALGORITHM)
    if (!row) throw new Error('No ES256 key pair found. Call ensureKeyPair() first.')
    cachedPublicKey = await importSPKI(row.publicKey, ALGORITHM)
    return cachedPublicKey
  }

  async function getPrivateKey(): Promise<SigningKey> {
    if (cachedPrivateKey) return cachedPrivateKey
    const row = repos.cryptoKeys.getByAlgorithm(ALGORITHM)
    if (!row) throw new Error('No ES256 key pair found. Call ensureKeyPair() first.')
    cachedPrivateKey = await importPKCS8(row.privateKey, ALGORITHM)
    return cachedPrivateKey
  }

  function validatePin(pin: string): void {
    if (!PIN_REGEX.test(pin)) {
      throw new ValidationError('PIN must be exactly 4 digits')
    }
  }

  async function signToken(user: ShopUser): Promise<string> {
    const privateKey = await getPrivateKey()
    const now = Math.floor(Date.now() / 1000)

    const builder = new SignJWT({
      sub: user.id,
      username: user.username,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
      ...(user.department !== undefined && { department: user.department }),
      active: user.active,
      createdAt: user.createdAt,
    })
      .setProtectedHeader({ alg: ALGORITHM })
      .setIssuedAt(now)
      .setExpirationTime(now + JWT_EXPIRY_SECONDS)

    return builder.sign(privateKey)
  }

  async function verifyToken(token: string): Promise<JwtPayload> {
    const publicKey = await getPublicKey()
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: [ALGORITHM],
    })
    return payload as unknown as JwtPayload
  }

  async function setupPin(userId: string, pin: string): Promise<string> {
    validatePin(pin)

    const user = repos.users.getById(userId)
    if (!user) throw new NotFoundError('User', userId)

    if (user.pinHash) {
      throw new ForbiddenError('PIN is already set. Use admin reset to change it.')
    }

    const pinHash = hashSync(pin, BCRYPT_ROUNDS)
    const updated = repos.users.update(userId, { pinHash })

    return signToken(updated)
  }

  async function login(username: string, pin: string): Promise<string> {
    const user = repos.users.getByUsername(username)
    if (!user) {
      throw new AuthenticationError('Invalid credentials')
    }

    if (!user.pinHash) {
      throw new AuthenticationError('Invalid credentials')
    }

    if (!compareSync(pin, user.pinHash)) {
      throw new AuthenticationError('Invalid credentials')
    }

    return signToken(user)
  }

  function resetPin(adminUserId: string, targetUserId: string): void {
    const admin = repos.users.getById(adminUserId)
    if (!admin) throw new NotFoundError('User', adminUserId)
    if (!admin.isAdmin) {
      throw new ForbiddenError('Only administrators can reset PINs')
    }

    const target = repos.users.getById(targetUserId)
    if (!target) throw new NotFoundError('User', targetUserId)

    repos.users.update(targetUserId, { pinHash: null })
  }

  async function refreshToken(token: string): Promise<string> {
    const payload = await verifyToken(token)

    // Re-fetch user to get latest data
    const user = repos.users.getById(payload.sub)
    if (!user) throw new AuthenticationError('User no longer exists')

    return signToken(user)
  }

  function ensureDefaultAdmin(): void {
    const allUsers = repos.users.list()
    if (allUsers.length > 0) return

    repos.users.create({
      id: generateId('user'),
      username: 'admin',
      displayName: 'Administrator',
      isAdmin: true,
      active: true,
      pinHash: null,
      createdAt: new Date().toISOString(),
    })
  }

  return {
    ensureKeyPair,
    getPublicKey,
    getPrivateKey,
    setupPin,
    login,
    resetPin,
    signToken,
    verifyToken,
    refreshToken,
    ensureDefaultAdmin,
  }
}

export type AuthService = ReturnType<typeof createAuthService>
