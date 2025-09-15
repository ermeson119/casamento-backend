import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'wedding-secret-key-2024'

// Middleware para verificar token JWT
export const authenticateToken = (req: any, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso necessário' })
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' })
    }
    req.user = user
    next()
  })
}

// Login de administrador
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' })
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    // Gerar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Registro de administrador (apenas para desenvolvimento)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'admin' } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' })
    }

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return res.status(409).json({ error: 'Usuário já existe' })
    }

    // Hash da senha
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role
      }
    })

    // Gerar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Verificar token
router.get('/verify', authenticateToken, (req: any, res) => {
  res.json({ 
    valid: true, 
    user: req.user 
  })
})

export default router

