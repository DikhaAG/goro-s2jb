import { PrismaClient, Role, ValidationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as crypto from 'crypto';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://a69@localhost:5432/goro_s2jb?schema=public',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Helper simple hash for seeding (in real auth we use bcrypt/argon2)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_goro_salt_2026').digest('hex');
}

async function main() {
  console.log('🌱 Memulai proses seeding data master GORO S2JB...');

  // 1. Bersihkan data lama jika ada (idempotent)
  await prisma.ratingReview.deleteMany();
  await prisma.targetMaster.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.uLP.deleteMany();
  await prisma.uP3.deleteMany();
  await prisma.appVersion.deleteMany();

  // 2. Seed UP3 & ULP (Unit Pelaksana Pelayanan Pelanggan)
  const up3Data = [
    {
      code: 'UP3_PLG',
      name: 'UP3 PALEMBANG',
      ulps: [
        { code: 'ULP_RIV', name: 'ULP RIVAI' },
        { code: 'ULP_KTN', name: 'ULP KENTEN' },
        { code: 'ULP_SKR', name: 'ULP SUKARAME' },
        { code: 'ULP_AMP', name: 'ULP AMPERA' },
        { code: 'ULP_SKY', name: 'ULP SEKAYU' },
        { code: 'ULP_PKB', name: 'ULP PANGKALAN BALAI' },
        { code: 'ULP_MRN', name: 'ULP MARIANA' },
      ],
    },
    {
      code: 'UP3_OI',
      name: 'UP3 OGAN ILIR',
      ulps: [
        { code: 'ULP_IND', name: 'ULP INDRALAYA' },
        { code: 'ULP_TGM', name: 'ULP TUGU MULYO' },
        { code: 'ULP_KYA', name: 'ULP KAYU AGUNG' },
        { code: 'ULP_PBM', name: 'ULP PRABUMULIH' },
        { code: 'ULP_MRE', name: 'ULP MUARA ENIM' },
      ],
    },
    {
      code: 'UP3_BKL',
      name: 'UP3 BENGKULU',
      ulps: [
        { code: 'ULP_CRP', name: 'ULP CURUP' },
        { code: 'ULP_NSI', name: 'ULP NUSA INDAH' },
        { code: 'ULP_AGM', name: 'ULP ARGA MAKMUR' },
        { code: 'ULP_MNN', name: 'ULP MANNA' },
        { code: 'ULP_MKM', name: 'ULP MUKOMUKO' },
      ],
    },
    {
      code: 'UP3_JMB',
      name: 'UP3 JAMBI',
      ulps: [
        { code: 'ULP_MTB', name: 'ULP MUARA TEBO' },
        { code: 'ULP_KTB', name: 'ULP KOTA BARU' },
        { code: 'ULP_TLP', name: 'ULP TELANAIPURA' },
        { code: 'ULP_BNG', name: 'ULP BANGKO' },
        { code: 'ULP_SRL', name: 'ULP SAROLANGUN' },
      ],
    },
  ];

  const createdUlps: Record<string, string> = {};
  const createdUp3s: Record<string, string> = {};

  for (const up3 of up3Data) {
    const createdUp3 = await prisma.uP3.create({
      data: {
        code: up3.code,
        name: up3.name,
      },
    });
    createdUp3s[up3.code] = createdUp3.id;

    for (const ulp of up3.ulps) {
      const createdUlp = await prisma.uLP.create({
        data: {
          code: ulp.code,
          name: ulp.name,
          up3Id: createdUp3.id,
        },
      });
      createdUlps[ulp.code] = createdUlp.id;
    }
  }
  console.log(`✅ Berhasil membuat 4 UP3 dan 24 ULP.`);

  // 3. Seed App Versions (Versi PLN Mobile)
  const versions = ['V5.2.79', 'V5.2.75', 'V5.2.71', 'V5.2.70', 'V5.2.68', 'V5.2.66'];
  const createdVersions: Record<string, string> = {};
  for (const v of versions) {
    const createdVer = await prisma.appVersion.create({
      data: {
        version: v,
        isActive: true,
      },
    });
    createdVersions[v] = createdVer.id;
  }
  console.log(`✅ Berhasil membuat ${versions.length} versi aplikasi PLN Mobile.`);

  // 4. Seed Target Master Awal
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const ulpCode of Object.keys(createdUlps)) {
    await prisma.targetMaster.create({
      data: {
        ulpId: createdUlps[ulpCode],
        targetDate: today,
        dailyTarget: 50.0,
        cumulativeTarget: 1100.0,
      },
    });
  }
  console.log(`✅ Berhasil menginisialisasi Target Master harian & kumulatif.`);

  // 5. Seed Users untuk 3 Role RBAC + Super Admin
  const defaultPassword = hashPassword('password123');

  const usersToSeed = [
    {
      username: 'petugas_rivai',
      name: 'Ahmad Surveyor Lapangan',
      email: 'petugas_rivai@goro.pln.co.id',
      displayUsername: 'petugas_rivai',
      passwordHash: defaultPassword,
      role: Role.PETUGAS_LAPANGAN,
      up3Id: createdUp3s['UP3_PLG'],
      ulpId: createdUlps['ULP_RIV'],
    },
    {
      username: 'pegawai_operator',
      name: 'Budi Operator Triase',
      email: 'pegawai_operator@goro.pln.co.id',
      displayUsername: 'pegawai_operator',
      passwordHash: defaultPassword,
      role: Role.PEGAWAI,
      up3Id: createdUp3s['UP3_PLG'],
    },
    {
      username: 'manager_s2jb',
      name: 'Ir. Hendra Manager UID S2JB',
      email: 'manager_s2jb@goro.pln.co.id',
      displayUsername: 'manager_s2jb',
      passwordHash: defaultPassword,
      role: Role.MANAGER,
    },
    {
      username: 'superadmin',
      name: 'Super Administrator GORO',
      email: 'superadmin@goro.pln.co.id',
      displayUsername: 'superadmin',
      passwordHash: defaultPassword,
      role: Role.SUPER_ADMIN,
    },
  ];

  for (const u of usersToSeed) {
    const createdUser = await prisma.user.create({ data: u });
    await prisma.account.create({
      data: {
        id: `acc_${createdUser.id}`,
        userId: createdUser.id,
        accountId: createdUser.id,
        providerId: 'credential',
        password: defaultPassword,
      },
    });
  }

  console.log(`✅ Berhasil membuat 4 akun pengguna (Petugas Lapangan, Pegawai, Manager, Super Admin) dengan Better Auth credentials.`);
  console.log('🎉 Seeding selesai dengan sukses!');
}

main()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
