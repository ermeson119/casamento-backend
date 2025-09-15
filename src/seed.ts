import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Limpar dados existentes
  await prisma.gift.deleteMany()
  await prisma.guest.deleteMany()
  await prisma.user.deleteMany()

  // Criar usuário administrador
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@casamento.com',
      password: hashedPassword,
      role: 'admin'
    }
  })

  // Criar lista de presentes
  const gifts = await prisma.gift.createMany({
    data: [
      {
        name: 'Jogo de Panelas Antiaderente',
        description: 'Conjunto completo de panelas antiaderentes com 5 peças, ideal para o dia a dia na cozinha.',
        category: 'cozinha',
        priceRange: 'R$ 200 - R$ 300',
        imageUrl: 'https://images.pexels.com/photos/4226796/pexels-photo-4226796.jpeg'
      },
      {
        name: 'Máquina de Café Expresso',
        description: 'Máquina automática para café expresso com sistema de aquecimento rápido.',
        category: 'eletrônicos',
        priceRange: 'R$ 800 - R$ 1200',
        imageUrl: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg'
      },
      {
        name: 'Jogo de Cama Casal Premium',
        description: 'Jogo de cama 100% algodão com 4 peças, macio e durável.',
        category: 'casa',
        priceRange: 'R$ 150 - R$ 250',
        imageUrl: 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg'
      },
      {
        name: 'Aspirador de Pó Robô',
        description: 'Aspirador inteligente com mapeamento automático e controle por app.',
        category: 'eletrônicos',
        priceRange: 'R$ 1000 - R$ 1500',
        imageUrl: 'https://images.pexels.com/photos/4107124/pexels-photo-4107124.jpeg'
      },
      {
        name: 'Conjunto de Taças de Cristal',
        description: 'Set de 6 taças de cristal para vinho e champagne, elegantes e sofisticadas.',
        category: 'casa',
        priceRange: 'R$ 300 - R$ 500',
        imageUrl: 'https://images.pexels.com/photos/1283219/pexels-photo-1283219.jpeg'
      },
      {
        name: 'Liquidificador de Alta Potência',
        description: 'Liquidificador com motor de 1200W, ideal para vitaminas e receitas.',
        category: 'cozinha',
        priceRange: 'R$ 200 - R$ 350',
        imageUrl: 'https://images.pexels.com/photos/4226764/pexels-photo-4226764.jpeg'
      },
      {
        name: 'Quadro Decorativo Abstrato',
        description: 'Quadro moderno para decoração da sala, com moldura elegante.',
        category: 'decoração',
        priceRange: 'R$ 100 - R$ 200',
        imageUrl: 'https://images.pexels.com/photos/1579708/pexels-photo-1579708.jpeg'
      },
      {
        name: 'Air Fryer Digital',
        description: 'Fritadeira elétrica sem óleo com painel digital e 8 funções pré-programadas.',
        category: 'cozinha',
        priceRange: 'R$ 400 - R$ 600',
        imageUrl: 'https://images.pexels.com/photos/4226764/pexels-photo-4226764.jpeg'
      },
      {
        name: 'Conjunto de Toalhas de Banho',
        description: 'Kit com 4 toalhas de banho 100% algodão, super absorventes.',
        category: 'casa',
        priceRange: 'R$ 80 - R$ 150',
        imageUrl: 'https://images.pexels.com/photos/6414307/pexels-photo-6414307.jpeg'
      },
      {
        name: 'Smart TV 55 Polegadas',
        description: 'Televisão 4K com sistema smart, conectividade Wi-Fi e múltiplas opções de streaming.',
        category: 'eletrônicos',
        priceRange: 'R$ 2000 - R$ 3000',
        imageUrl: 'https://images.pexels.com/photos/1201996/pexels-photo-1201996.jpeg'
      },
      {
        name: 'Micro-ondas Digital',
        description: 'Micro-ondas com painel digital, função grill e 30 litros de capacidade.',
        category: 'cozinha',
        priceRange: 'R$ 400 - R$ 700',
        imageUrl: 'https://images.pexels.com/photos/4226796/pexels-photo-4226796.jpeg'
      },
      {
        name: 'Luminária de Mesa Moderna',
        description: 'Luminária LED ajustável para mesa de escritório ou cabeceira.',
        category: 'decoração',
        priceRange: 'R$ 120 - R$ 200',
        imageUrl: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg'
      }
    ]
  })

  console.log(`✅ Seed concluído!`)
  console.log(`🎁 ${gifts.count} presentes criados`)
  console.log(`👤 1 administrador criado`)
  console.log(`\n🔐 Credenciais do administrador:`)
  console.log(`   - Email: admin@casamento.com`)
  console.log(`   - Senha: admin123`)
  console.log(`\n💡 Agora os convidados podem se cadastrar livremente!`)
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })