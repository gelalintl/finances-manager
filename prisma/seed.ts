import {
  AccountType,
  CategoryType,
  Frequency,
  PaymentMethod,
  PrismaClient,
  TransactionType,
  UserRole,
} from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEMO_EMAIL = 'lelouch@personalfinance.app'
const DEMO_PASSWORD = 'Admin2026!'

/** PRNG déterministe : le seed doit être reproductible d'une exécution à l'autre. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(20260102)

function pick<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)]
}

function between(min: number, max: number, step = 500) {
  const span = Math.floor((max - min) / step) + 1
  return min + Math.floor(random() * span) * step
}

function dayOf(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay), 12, 0, 0, 0)
}

type AccountSeed = {
  name: string
  type: AccountType
  balance: number
  institution?: string
}

const ACCOUNTS: AccountSeed[] = [
  { name: 'Compte Courant', type: AccountType.CHECKING, balance: 250_000, institution: 'BOA' },
  { name: 'Espèces', type: AccountType.CASH, balance: 35_000 },
  { name: 'Mobile Money', type: AccountType.MOBILE_MONEY, balance: 60_000, institution: 'Orange Money' },
  { name: 'Épargne', type: AccountType.SAVINGS, balance: 900_000, institution: 'BOA' },
]

type CategorySeed = {
  name: string
  type: CategoryType
  icon: string
  color: string
  budgetLimit: number | null
}

const CATEGORIES: CategorySeed[] = [
  { name: 'Alimentation', type: CategoryType.EXPENSE, icon: 'UtensilsCrossed', color: '#f97316', budgetLimit: 150_000 },
  { name: 'Transport', type: CategoryType.EXPENSE, icon: 'Car', color: '#0ea5e9', budgetLimit: 60_000 },
  { name: 'Logement', type: CategoryType.EXPENSE, icon: 'House', color: '#8b5cf6', budgetLimit: 250_000 },
  { name: 'Santé', type: CategoryType.EXPENSE, icon: 'HeartPulse', color: '#ef4444', budgetLimit: 50_000 },
  { name: 'Loisirs', type: CategoryType.EXPENSE, icon: 'Gamepad2', color: '#ec4899', budgetLimit: 75_000 },
  { name: 'Énergie & Eau', type: CategoryType.EXPENSE, icon: 'Zap', color: '#eab308', budgetLimit: 45_000 },
  { name: 'Téléphone & Internet', type: CategoryType.EXPENSE, icon: 'Smartphone', color: '#14b8a6', budgetLimit: 30_000 },
  { name: 'Éducation', type: CategoryType.EXPENSE, icon: 'GraduationCap', color: '#6366f1', budgetLimit: 80_000 },
  { name: 'Vêtements', type: CategoryType.EXPENSE, icon: 'Shirt', color: '#a855f7', budgetLimit: 40_000 },
  { name: 'Abonnements', type: CategoryType.EXPENSE, icon: 'Repeat', color: '#64748b', budgetLimit: 25_000 },
  { name: 'Salaire', type: CategoryType.INCOME, icon: 'Briefcase', color: '#10b981', budgetLimit: null },
  { name: 'Freelance', type: CategoryType.INCOME, icon: 'Laptop', color: '#22c55e', budgetLimit: null },
  { name: 'Primes', type: CategoryType.INCOME, icon: 'Gift', color: '#84cc16', budgetLimit: null },
]

/**
 * Dépenses du mois courant calibrées pour illustrer les trois zones de jauge :
 * vert (< 70 %), jaune (70-90 %) et rouge (> 90 %).
 */
const CURRENT_MONTH_TARGETS: Record<string, number> = {
  Alimentation: 141_000, // 94 % → rouge
  'Énergie & Eau': 38_000, // 84 % → jaune
  Transport: 45_000, // 75 % → jaune
  Logement: 200_000, // 80 % → jaune
  Loisirs: 29_000, // 39 % → vert
  Santé: 11_000, // 22 % → vert
  'Téléphone & Internet': 15_000, // 50 % → vert
  Vêtements: 12_000, // 30 % → vert
}

const EXPENSE_NOTES: Record<string, string[]> = {
  Alimentation: ['Courses hebdomadaires', 'Marché de quartier', 'Supérette', 'Boulangerie', 'Restaurant midi'],
  Transport: ['Carburant', 'Taxi', 'Entretien véhicule', 'Transport en commun'],
  Logement: ['Loyer mensuel', "Charges d'immeuble", 'Petites réparations'],
  Santé: ['Pharmacie', 'Consultation médecin', 'Analyses laboratoire'],
  Loisirs: ['Cinéma', 'Sortie restaurant', 'Abonnement sport', 'Livres'],
  'Énergie & Eau': ['Facture électricité', 'Facture eau'],
  'Téléphone & Internet': ['Forfait mobile', 'Abonnement fibre'],
  Éducation: ['Frais de scolarité', 'Fournitures'],
  Vêtements: ['Vêtements', 'Chaussures'],
  Abonnements: ['Streaming vidéo', 'Streaming musique', 'Cloud storage'],
}

async function reset() {
  // Ordre de suppression imposé par les dépendances (Restrict sur les comptes).
  await prisma.transaction.deleteMany({})
  await prisma.recurringTransaction.deleteMany({})
  await prisma.budgetGoal.deleteMany({})
  await prisma.category.deleteMany({})
  await prisma.account.deleteMany({})
  await prisma.user.deleteMany({})
}

async function main() {
  console.log('→ Nettoyage des données existantes...')
  await reset()

  console.log('→ Création de l\'utilisateur de démonstration...')
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      pseudo: 'Lelouch',
      name: 'Lelouch',
      password: await bcrypt.hash(DEMO_PASSWORD, 10),
      role: UserRole.SUPER_ADMIN,
      currency: 'FCFA',
    },
  })

  console.log('→ Création des comptes...')
  const accounts = await Promise.all(
    ACCOUNTS.map((account) =>
      prisma.account.create({
        data: {
          userId: user.id,
          name: account.name,
          type: account.type,
          balance: account.balance,
          institution: account.institution ?? null,
        },
      }),
    ),
  )

  const accountByName = new Map(accounts.map((account) => [account.name, account]))
  const checking = accountByName.get('Compte Courant')!
  const cash = accountByName.get('Espèces')!
  const mobile = accountByName.get('Mobile Money')!
  const savings = accountByName.get('Épargne')!

  console.log('→ Création des catégories...')
  const categories = await Promise.all(
    CATEGORIES.map((category) =>
      prisma.category.create({
        data: {
          userId: user.id,
          name: category.name,
          type: category.type,
          icon: category.icon,
          color: category.color,
          budgetLimit: category.budgetLimit,
        },
      }),
    ),
  )

  const categoryByName = new Map(categories.map((category) => [category.name, category]))

  console.log('→ Création des objectifs de budget...')
  const goalSpecs: Array<{ name: string; monthlyLimit: number; alertThreshold: number }> = [
    { name: 'Alimentation', monthlyLimit: 150_000, alertThreshold: 80 },
    { name: 'Transport', monthlyLimit: 60_000, alertThreshold: 75 },
    { name: 'Loisirs', monthlyLimit: 75_000, alertThreshold: 70 },
    { name: 'Logement', monthlyLimit: 250_000, alertThreshold: 90 },
  ]

  for (const spec of goalSpecs) {
    const category = categoryByName.get(spec.name)
    if (!category) continue
    await prisma.budgetGoal.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        monthlyLimit: spec.monthlyLimit,
        alertThreshold: spec.alertThreshold,
        period: 'MONTH',
      },
    })
  }

  console.log('→ Création des transactions récurrentes...')
  const recurringSpecs = [
    { label: 'Loyer appartement', category: 'Logement', amount: 200_000, dayOfMonth: 3, account: checking },
    { label: 'Abonnement fibre', category: 'Téléphone & Internet', amount: 15_000, dayOfMonth: 8, account: checking },
    { label: 'Streaming vidéo', category: 'Abonnements', amount: 5_000, dayOfMonth: 12, account: checking },
    { label: 'Salaire mensuel', category: 'Salaire', amount: 650_000, dayOfMonth: 28, account: checking, type: TransactionType.INCOME },
  ]

  const recurringByLabel = new Map<string, { id: number }>()
  for (const spec of recurringSpecs) {
    const category = categoryByName.get(spec.category)
    const recurring = await prisma.recurringTransaction.create({
      data: {
        userId: user.id,
        label: spec.label,
        type: spec.type ?? TransactionType.EXPENSE,
        amount: spec.amount,
        categoryId: category?.id ?? null,
        accountId: spec.account.id,
        frequency: Frequency.MONTHLY,
        dayOfMonth: spec.dayOfMonth,
        active: true,
      },
    })
    recurringByLabel.set(spec.label, recurring)
  }

  console.log('→ Génération de 6 mois de transactions...')
  const now = new Date()
  type TxInput = {
    userId: number
    type: TransactionType
    amount: number
    date: Date
    description: string
    categoryId: number | null
    accountId: number
    toAccountId: number | null
    paymentMethod: PaymentMethod
    isRecurring: boolean
    recurringTransactionId: number | null
  }

  const rows: TxInput[] = []

  for (let offset = 5; offset >= 0; offset -= 1) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const isCurrentMonth = offset === 0

    // --- Revenus ---
    rows.push({
      userId: user.id,
      type: TransactionType.INCOME,
      amount: 650_000,
      date: dayOf(year, month, 28),
      description: 'Salaire mensuel',
      categoryId: categoryByName.get('Salaire')!.id,
      accountId: checking.id,
      toAccountId: null,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      isRecurring: true,
      recurringTransactionId: recurringByLabel.get('Salaire mensuel')?.id ?? null,
    })

    // Mission freelance un mois sur deux.
    if (offset % 2 === 0) {
      rows.push({
        userId: user.id,
        type: TransactionType.INCOME,
        amount: between(80_000, 180_000, 5_000),
        date: dayOf(year, month, 15),
        description: 'Mission freelance',
        categoryId: categoryByName.get('Freelance')!.id,
        accountId: mobile.id,
        toAccountId: null,
        paymentMethod: PaymentMethod.MOBILE_MONEY,
        isRecurring: false,
        recurringTransactionId: null,
      })
    }

    // Prime en fin d'année civile.
    if (month === 11) {
      rows.push({
        userId: user.id,
        type: TransactionType.INCOME,
        amount: 150_000,
        date: dayOf(year, month, 20),
        description: 'Prime de fin d\'année',
        categoryId: categoryByName.get('Primes')!.id,
        accountId: checking.id,
        toAccountId: null,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        isRecurring: false,
        recurringTransactionId: null,
      })
    }

    // --- Charges fixes ---
    const fixedSpecs = [
      { label: 'Loyer appartement', category: 'Logement', amount: 200_000, day: 3, method: PaymentMethod.BANK_TRANSFER },
      { label: 'Abonnement fibre', category: 'Téléphone & Internet', amount: 15_000, day: 8, method: PaymentMethod.DIRECT_DEBIT },
      { label: 'Streaming vidéo', category: 'Abonnements', amount: 5_000, day: 12, method: PaymentMethod.CARD },
    ]

    for (const spec of fixedSpecs) {
      rows.push({
        userId: user.id,
        type: TransactionType.EXPENSE,
        amount: spec.amount,
        date: dayOf(year, month, spec.day),
        description: spec.label,
        categoryId: categoryByName.get(spec.category)!.id,
        accountId: checking.id,
        toAccountId: null,
        paymentMethod: spec.method,
        isRecurring: true,
        recurringTransactionId: recurringByLabel.get(spec.label)?.id ?? null,
      })
    }

    // Électricité : charge fixe au montant variable.
    const energyAmount = isCurrentMonth ? 38_000 : between(28_000, 44_000, 1_000)
    rows.push({
      userId: user.id,
      type: TransactionType.EXPENSE,
      amount: energyAmount,
      date: dayOf(year, month, 10),
      description: 'Facture électricité',
      categoryId: categoryByName.get('Énergie & Eau')!.id,
      accountId: checking.id,
      toAccountId: null,
      paymentMethod: PaymentMethod.DIRECT_DEBIT,
      isRecurring: true,
      recurringTransactionId: null,
    })

    // --- Dépenses variables ---
    const variableCategories = ['Alimentation', 'Transport', 'Loisirs', 'Santé', 'Vêtements']

    for (const categoryName of variableCategories) {
      const category = categoryByName.get(categoryName)!
      const target = isCurrentMonth
        ? CURRENT_MONTH_TARGETS[categoryName]
        : between(
            Math.round((category.budgetLimit ? Number(category.budgetLimit) : 50_000) * 0.45),
            Math.round((category.budgetLimit ? Number(category.budgetLimit) : 50_000) * 1.05),
            1_000,
          )

      if (!target || target <= 0) continue

      // On répartit la cible du mois sur plusieurs écritures crédibles.
      const splits = categoryName === 'Alimentation' ? 6 : categoryName === 'Transport' ? 4 : 2
      let remaining = target
      for (let index = 0; index < splits; index += 1) {
        const isLast = index === splits - 1
        const slice = isLast
          ? remaining
          : Math.max(500, Math.round((remaining / (splits - index)) * (0.75 + random() * 0.5) / 500) * 500)
        remaining -= slice
        if (slice <= 0) continue

        rows.push({
          userId: user.id,
          type: TransactionType.EXPENSE,
          amount: slice,
          date: dayOf(year, month, 2 + Math.floor((26 / splits) * index) + Math.floor(random() * 3)),
          description: pick(EXPENSE_NOTES[categoryName] ?? ['Dépense']),
          categoryId: category.id,
          accountId: pick([checking, cash, mobile]).id,
          toAccountId: null,
          paymentMethod: pick([
            PaymentMethod.CASH,
            PaymentMethod.CARD,
            PaymentMethod.MOBILE_MONEY,
          ]),
          isRecurring: false,
          recurringTransactionId: null,
        })
        if (remaining <= 0) break
      }
    }

    // Frais de scolarité en septembre et janvier.
    if (month === 8 || month === 0) {
      rows.push({
        userId: user.id,
        type: TransactionType.EXPENSE,
        amount: 75_000,
        date: dayOf(year, month, 5),
        description: 'Frais de scolarité',
        categoryId: categoryByName.get('Éducation')!.id,
        accountId: checking.id,
        toAccountId: null,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        isRecurring: false,
        recurringTransactionId: null,
      })
    }

    // --- Virement d'épargne mensuel ---
    rows.push({
      userId: user.id,
      type: TransactionType.TRANSFER,
      amount: isCurrentMonth ? 100_000 : between(75_000, 150_000, 5_000),
      date: dayOf(year, month, 29),
      description: 'Virement vers épargne',
      categoryId: null,
      accountId: checking.id,
      toAccountId: savings.id,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      isRecurring: false,
      recurringTransactionId: null,
    })
  }

  await prisma.transaction.createMany({ data: rows })

  console.log('')
  console.log('✔ Seed terminé.')
  console.log(`  ${rows.length} transactions · ${categories.length} catégories · ${accounts.length} comptes`)
  console.log('')
  console.log('  Connexion de démonstration :')
  console.log(`    Email        : ${DEMO_EMAIL}`)
  console.log(`    Mot de passe : ${DEMO_PASSWORD}`)
  console.log('')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
