import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from './auth'

const router = express.Router()
const prisma = new PrismaClient()

// Middleware para verificar se é admin
const requireAdmin = (req: any, res: express.Response, next: express.NextFunction) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' })
  }
  next()
}

// Dashboard - Estatísticas gerais
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [
      totalGuests,
      confirmedGuests,
      totalGifts,
      reservedGifts,
      recentGuests,
      recentGifts
    ] = await Promise.all([
      prisma.guest.count(),
      prisma.guest.count({ where: { confirmed: true } }),
      prisma.gift.count(),
      prisma.gift.count({ where: { isReserved: true } }),
      prisma.guest.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          confirmed: true,
          companionsCount: true,
          createdAt: true
        }
      }),
      prisma.gift.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          isReserved: true,
          reservedBy: true,
          createdAt: true
        }
      })
    ])

    const confirmationRate = totalGuests > 0 ? (confirmedGuests / totalGuests) * 100 : 0
    const reservationRate = totalGifts > 0 ? (reservedGifts / totalGifts) * 100 : 0

    res.json({
      stats: {
        totalGuests,
        confirmedGuests,
        confirmationRate: Math.round(confirmationRate * 100) / 100,
        totalGifts,
        reservedGifts,
        reservationRate: Math.round(reservationRate * 100) / 100
      },
      recentGuests,
      recentGifts
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    res.status(500).json({ error: 'Erro ao carregar dashboard' })
  }
})

// Listar todos os convidados com filtros
router.get('/guests', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { confirmed, search, page = 1, limit = 20 } = req.query
    
    const where: any = {}
    
    if (confirmed !== undefined) {
      where.confirmed = confirmed === 'true'
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { inviteCode: { contains: search as string, mode: 'insensitive' } }
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)
    
    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          reservedGifts: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.guest.count({ where })
    ])

    res.json({
      guests,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    })
  } catch (error) {
    console.error('Get guests error:', error)
    res.status(500).json({ error: 'Erro ao carregar convidados' })
  }
})

// Atualizar status de convidado
router.put('/guests/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { confirmed, companionsCount, companionNames, dietaryRestrictions } = req.body

    const guest = await prisma.guest.update({
      where: { id },
      data: {
        confirmed,
        companionsCount,
        companionNames: companionNames ? JSON.stringify(companionNames) : null,
        dietaryRestrictions
      }
    })

    res.json(guest)
  } catch (error) {
    console.error('Update guest error:', error)
    res.status(500).json({ error: 'Erro ao atualizar convidado' })
  }
})

// Deletar convidado
router.delete('/guests/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    await prisma.guest.delete({
      where: { id }
    })

    res.json({ message: 'Convidado removido com sucesso' })
  } catch (error) {
    console.error('Delete guest error:', error)
    res.status(500).json({ error: 'Erro ao remover convidado' })
  }
})

// Listar todos os presentes
router.get('/gifts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { category, isReserved, search, page = 1, limit = 20 } = req.query
    
    const where: any = {}
    
    if (category) {
      where.category = category
    }
    
    if (isReserved !== undefined) {
      where.isReserved = isReserved === 'true'
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)
    
    const [gifts, total] = await Promise.all([
      prisma.gift.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          reservedByGuest: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.gift.count({ where })
    ])

    res.json({
      gifts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    })
  } catch (error) {
    console.error('Get gifts error:', error)
    res.status(500).json({ error: 'Erro ao carregar presentes' })
  }
})

// Criar presente
router.post('/gifts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, category, imageUrl } = req.body

    if (!name || !description) {
      return res.status(400).json({ error: 'Nome e descrição são obrigatórios' })
    }

    const gift = await prisma.gift.create({
      data: {
        name,
        description,
        category: category || 'outros',
        priceRange: 'Não informado', // Valor padrão
        imageUrl
      }
    })

    res.status(201).json(gift)
  } catch (error) {
    console.error('Create gift error:', error)
    res.status(500).json({ error: 'Erro ao criar presente' })
  }
})

// Atualizar presente
router.put('/gifts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, category, imageUrl, isReserved } = req.body

    const gift = await prisma.gift.update({
      where: { id },
      data: {
        name,
        description,
        category,
        priceRange: 'Não informado', // Valor padrão
        imageUrl,
        isReserved
      }
    })

    res.json(gift)
  } catch (error) {
    console.error('Update gift error:', error)
    res.status(500).json({ error: 'Erro ao atualizar presente' })
  }
})

// Deletar presente
router.delete('/gifts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    await prisma.gift.delete({
      where: { id }
    })

    res.json({ message: 'Presente removido com sucesso' })
  } catch (error) {
    console.error('Delete gift error:', error)
    res.status(500).json({ error: 'Erro ao remover presente' })
  }
})

// Remover reserva de presente (admin)
router.post('/gifts/:id/unreserve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const updatedGift = await prisma.gift.update({
      where: { id },
      data: {
        isReserved: false,
        reservedBy: null,
        reservedAt: null,
        tempReservedBy: null,
        tempReservedAt: null,
        updatedAt: new Date()
      }
    })

    res.json({ message: 'Reserva removida com sucesso', gift: updatedGift })
  } catch (error) {
    console.error('Unreserve gift error:', error)
    res.status(500).json({ error: 'Erro ao remover reserva do presente' })
  }
})

// Inativar/Ativar presente
router.patch('/gifts/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const gift = await prisma.gift.findUnique({
      where: { id }
    })

    if (!gift) {
      return res.status(404).json({ error: 'Presente não encontrado' })
    }

    const updatedGift = await prisma.gift.update({
      where: { id },
      data: {
        isReserved: !gift.isReserved,
        reservedBy: !gift.isReserved ? null : gift.reservedBy,
        reservedAt: !gift.isReserved ? null : gift.reservedAt
      }
    })

    res.json(updatedGift)
  } catch (error) {
    console.error('Toggle gift error:', error)
    res.status(500).json({ error: 'Erro ao alterar status do presente' })
  }
})

export default router

