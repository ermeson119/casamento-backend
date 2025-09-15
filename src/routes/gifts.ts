import express from 'express'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

// Listar todos os presentes
router.get('/', async (req, res) => {
  try {
    const gifts = await prisma.gift.findMany({
      orderBy: { createdAt: 'asc' }
    })

    res.json(gifts)
  } catch (error) {
    console.error('Get gifts error:', error)
    res.status(500).json({ error: 'Erro ao carregar presentes' })
  }
})

// Reservar presente
router.post('/:id/reserve', async (req, res) => {
  try {
    const { id } = req.params
    const { guestEmail } = req.body

    if (!guestEmail) {
      return res.status(400).json({ error: 'Email do convidado é obrigatório' })
    }

    // Verificar se o presente existe e não está reservado
    const gift = await prisma.gift.findUnique({
      where: { id }
    })

    if (!gift) {
      return res.status(404).json({ error: 'Presente não encontrado' })
    }

    if (gift.isReserved && gift.reservedBy !== guestEmail) {
      return res.status(409).json({ error: 'Presente já foi reservado por outro convidado' })
    }

    // Se já está reservado pelo mesmo convidado, cancelar reserva
    if (gift.reservedBy === guestEmail) {
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

      return res.json({ ...updatedGift, action: 'cancelled' })
    }

    // Fazer a reserva
    const updatedGift = await prisma.gift.update({
      where: { 
        id,
        isReserved: false // Condição para evitar race conditions
      },
      data: {
        isReserved: true,
        reservedBy: guestEmail,
        reservedAt: new Date(),
        tempReservedBy: null,
        tempReservedAt: null,
        updatedAt: new Date()
      }
    })

    res.json({ ...updatedGift, action: 'reserved' })
  } catch (error: any) {
    console.error('Reserve gift error:', error)
    
    // Se houve erro de concorrência (presente foi reservado por outro usuário)
    if (error.code === 'P2025') {
      return res.status(409).json({ error: 'Presente acabou de ser reservado por outro convidado' })
    }
    
    res.status(500).json({ error: 'Erro ao reservar presente primeiro reserve a sua presença' })
  }
})

// Marcar presente como temporariamente reservado (para visualização)
router.post('/:id/temp-reserve', async (req, res) => {
  try {
    const { id } = req.params
    const { guestEmail } = req.body

    if (!guestEmail) {
      return res.status(400).json({ error: 'Email do convidado é obrigatório' })
    }

    // Só marcar como temp se não estiver reservado permanentemente
    const updatedGift = await prisma.gift.updateMany({
      where: { 
        id,
        isReserved: false,
        OR: [
          { tempReservedBy: null },
          { tempReservedBy: guestEmail }
        ]
      },
      data: {
        tempReservedBy: guestEmail,
        tempReservedAt: new Date(),
        updatedAt: new Date()
      }
    })

    if (updatedGift.count === 0) {
      return res.status(409).json({ error: 'Presente não disponível para visualização' })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Temp reserve error:', error)
    res.status(500).json({ error: 'Erro ao marcar visualização' })
  }
})

// Limpar reserva temporária
router.delete('/:id/temp-reserve', async (req, res) => {
  try {
    const { id } = req.params
    const { guestEmail } = req.body

    await prisma.gift.updateMany({
      where: { 
        id,
        tempReservedBy: guestEmail
      },
      data: {
        tempReservedBy: null,
        tempReservedAt: null,
        updatedAt: new Date()
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Clear temp reserve error:', error)
    res.status(500).json({ error: 'Erro ao limpar visualização' })
  }
})

// Limpar reservas temporárias expiradas (chamado periodicamente)
router.post('/cleanup-temp', async (req, res) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)

    const result = await prisma.gift.updateMany({
      where: {
        tempReservedAt: {
          lt: fifteenMinutesAgo
        }
      },
      data: {
        tempReservedBy: null,
        tempReservedAt: null,
        updatedAt: new Date()
      }
    })

    res.json({ cleaned: result.count })
  } catch (error) {
    console.error('Cleanup temp reserves error:', error)
    res.status(500).json({ error: 'Erro ao limpar reservas temporárias' })
  }
})

export default router