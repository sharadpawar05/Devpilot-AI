import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      plan: 'FREE',
      status: 'ACTIVE',
    },
  });

  console.log(`Created organization: ${org.name} (${org.id})`);

  const user = await prisma.user.create({
    data: {
      supabaseUserId: '00000000-0000-0000-0000-000000000001',
      email: 'admin@acme-corp.com',
      fullName: 'Admin User',
      role: 'ADMIN',
      organizationId: org.id,
    },
  });

  console.log(`Created user: ${user.fullName} (${user.id})`);

  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'DevPilot Platform',
      description: 'AI-powered engineering management tool',
      status: 'ACTIVE',
    },
  });

  console.log(`Created project: ${project.name} (${project.id})`);

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
