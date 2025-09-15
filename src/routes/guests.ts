import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      guest?: {
        id: string
        email: string
        type: string
      }
    }
  }
}

const router = express.Router()
const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'wedding-secret-key-2024'

// Criar convidado (sem autenticação)
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      confirmed, 
      companionsCount, 
      companionNames, 
      dietaryRestrictions 
    } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' })
    }

    // Gerar email único baseado no nome
    let baseEmail = email || `${name.toLowerCase().replace(/\s+/g, '')}@casamento.com`
    let finalEmail = baseEmail
    let counter = 1

    // Verificar se email já existe e gerar um único
    while (true) {
      const existingGuest = await prisma.guest.findUnique({
        where: { email: finalEmail }
      })

      if (!existingGuest) {
        break
      }

      finalEmail = `${baseEmail.split('@')[0]}${counter}@casamento.com`
      counter++
    }

    // Criar convidado
    const guest = await prisma.guest.create({
      data: {
        name,
        email: finalEmail,
        phone: phone || null,
        password: 'no-password', // Senha padrão para convidados sem login
        confirmed: confirmed || false,
        companionsCount: companionsCount || 0,
        companionNames: companionNames ? JSON.stringify(companionNames) : null,
        dietaryRestrictions: dietaryRestrictions || null,
        maxCompanions: 5 // Máximo padrão
      }
    })

    // Retornar convidado sem senha
    const { password, ...guestWithoutPassword } = guest
    res.status(201).json({
      ...guestWithoutPassword,
      companionNames: guest.companionNames ? JSON.parse(guest.companionNames) : []
    })
  } catch (error) {
    console.error('Create guest error:', error)
    res.status(500).json({ error: 'Erro ao criar convidado' })
  }
})

// Registro de convidado
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, maxCompanions = 2 } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' })
    }

    // Verificar se convidado já existe
    const existingGuest = await prisma.guest.findUnique({
      where: { email }
    })

    if (existingGuest) {
      return res.status(409).json({ error: 'Já existe um convidado com este email' })
    }

    // Hash da senha
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Criar convidado
    const guest = await prisma.guest.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        maxCompanions
      }
    })

    // Gerar token JWT
    const token = jwt.sign(
      { 
        id: guest.id, 
        email: guest.email, 
        type: 'guest'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Remover senha da resposta
    const { password: _, ...guestWithoutPassword } = guest

    res.status(201).json({
      token,
      guest: guestWithoutPassword
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Login de convidado
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' })
    }

    // Buscar convidado
    const guest = await prisma.guest.findUnique({
      where: { email }
    })

    if (!guest) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, guest.password)
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    // Gerar token JWT
    const token = jwt.sign(
      { 
        id: guest.id, 
        email: guest.email, 
        type: 'guest'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Parse companion names from JSON string
    const companionNames = guest.companionNames ? JSON.parse(guest.companionNames) : []

    // Remover senha da resposta
    const { password: _, ...guestWithoutPassword } = guest

    res.json({
      token,
      guest: {
        ...guestWithoutPassword,
        companionNames
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Middleware para verificar token de convidado
export const authenticateGuest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso necessário' })
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err || user.type !== 'guest') {
      return res.status(403).json({ error: 'Token inválido' })
    }
    req.guest = user
    next()
  })
}

// Verificar token
router.get('/verify', authenticateGuest, async (req: express.Request, res) => {
  try {
    if (!req.guest) {
      return res.status(401).json({ error: 'Token inválido' })
    }
    
    const guest = await prisma.guest.findUnique({
      where: { id: req.guest.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        maxCompanions: true,
        confirmed: true,
        companionsCount: true,
        companionNames: true,
        dietaryRestrictions: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!guest) {
      return res.status(404).json({ error: 'Convidado não encontrado' })
    }

    // Parse companion names
    const companionNames = guest.companionNames ? JSON.parse(guest.companionNames) : []

    res.json({
      valid: true,
      guest: {
        ...guest,
        companionNames
      }
    })
  } catch (error) {
    console.error('Verify error:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Atualizar confirmação de presença
router.put('/rsvp', authenticateGuest, async (req: express.Request, res) => {
  try {
    if (!req.guest) {
      return res.status(401).json({ error: 'Token inválido' })
    }
    
    const { confirmed, companionsCount, companionNames, dietaryRestrictions } = req.body

    const updatedGuest = await prisma.guest.update({
      where: { id: req.guest.id },
      data: {
        confirmed,
        companionsCount: companionsCount || 0,
        companionNames: companionNames ? JSON.stringify(companionNames) : null,
        dietaryRestrictions: dietaryRestrictions || null,
        updatedAt: new Date()
      }
    })

    // Parse companion names for response
    const parsedCompanionNames = updatedGuest.companionNames ? JSON.parse(updatedGuest.companionNames) : []

    // Remover senha da resposta
    const { password: _, ...guestWithoutPassword } = updatedGuest

    res.json({
      ...guestWithoutPassword,
      companionNames: parsedCompanionNames
    })
  } catch (error) {
    console.error('RSVP update error:', error)
    res.status(500).json({ error: 'Erro ao atualizar confirmação' })
  }
})

// Atualizar perfil do convidado
router.put('/profile', authenticateGuest, async (req: express.Request, res) => {
  try {
    if (!req.guest) {
      return res.status(401).json({ error: 'Token inválido' })
    }
    
    const { name, phone, maxCompanions } = req.body

    const updatedGuest = await prisma.guest.update({
      where: { id: req.guest.id },
      data: {
        name,
        phone,
        maxCompanions,
        updatedAt: new Date()
      }
    })

    // Remover senha da resposta
    const { password: _, ...guestWithoutPassword } = updatedGuest

    res.json(guestWithoutPassword)
  } catch (error) {
    console.error('Profile update error:', error)
    res.status(500).json({ error: 'Erro ao atualizar perfil' })
  }
})

export default router