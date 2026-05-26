import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => new PrismaClient()

const globalWithPrisma = global

if (!globalWithPrisma.__prisma) {
  globalWithPrisma.__prisma = prismaClientSingleton()
}

const prisma = globalWithPrisma.__prisma

export default prisma