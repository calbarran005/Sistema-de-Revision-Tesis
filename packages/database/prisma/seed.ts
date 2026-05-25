import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // Programa académico demo
  const program = await prisma.academicProgram.upsert({
    where: { code: 'MENG-001' },
    update: {},
    create: {
      name: 'Maestría en Ingeniería de Software',
      code: 'MENG-001',
      faculty: 'Facultad de Ingeniería',
      level: 'maestria',
      durationSemesters: 4,
      maxScore: 5.0,
      minApprovalScore: 3.5,
      description: 'Programa de maestría enfocado en desarrollo de software avanzado',
    },
  });

  await prisma.academicProgram.upsert({
    where: { code: 'MEDU-001' },
    update: {},
    create: {
      name: 'Maestría en Educación',
      code: 'MEDU-001',
      faculty: 'Facultad de Educación',
      level: 'maestria',
      durationSemesters: 4,
      maxScore: 5.0,
      minApprovalScore: 3.5,
    },
  });

  // Admin
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@universidad.edu.co' },
    update: {},
    create: {
      email: 'admin@universidad.edu.co',
      password: adminPassword,
      firstName: 'Administrador',
      lastName: 'Sistema',
      role: UserRole.ADMIN,
      isEmailVerified: true,
    },
  });

  // Coordinador
  const coordPassword = await bcrypt.hash('Coord123!', 10);
  const coordinator = await prisma.user.upsert({
    where: { email: 'coordinador@universidad.edu.co' },
    update: {},
    create: {
      email: 'coordinador@universidad.edu.co',
      password: coordPassword,
      firstName: 'María Elena',
      lastName: 'Rodríguez',
      role: UserRole.COORDINATOR,
      isEmailVerified: true,
    },
  });

  await prisma.coordinatorProgram.upsert({
    where: { userId_programId: { userId: coordinator.id, programId: program.id } },
    update: {},
    create: { userId: coordinator.id, programId: program.id },
  });

  // Asesor
  const advisorPassword = await bcrypt.hash('Asesor123!', 10);
  const advisor = await prisma.user.upsert({
    where: { email: 'asesor@universidad.edu.co' },
    update: {},
    create: {
      email: 'asesor@universidad.edu.co',
      password: advisorPassword,
      firstName: 'Carlos Alberto',
      lastName: 'Mendoza',
      role: UserRole.ADVISOR,
      isEmailVerified: true,
    },
  });

  const advisorProfile = await prisma.advisorProfile.upsert({
    where: { userId: advisor.id },
    update: {},
    create: {
      userId: advisor.id,
      employeeCode: 'DOC-001',
      department: 'Departamento de Sistemas',
      specialization: 'Ingeniería de Software, Metodologías Ágiles',
      maxStudents: 8,
    },
  });

  // Estudiante
  const studentPassword = await bcrypt.hash('Student123!', 10);
  const student = await prisma.user.upsert({
    where: { email: 'estudiante@universidad.edu.co' },
    update: {},
    create: {
      email: 'estudiante@universidad.edu.co',
      password: studentPassword,
      firstName: 'Juan Sebastián',
      lastName: 'García López',
      role: UserRole.STUDENT,
      isEmailVerified: true,
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {},
    create: {
      userId: student.id,
      studentCode: 'EST-2024-001',
      programId: program.id,
      advisorId: advisorProfile.id,
      thesisTitle: 'Desarrollo de un Sistema de Inteligencia Artificial para la Detección de Plagio en Documentos Académicos',
      enrollmentYear: 2024,
      semester: 2,
    },
  });

  // Configuración del sistema
  await prisma.systemConfig.upsert({
    where: { key: 'AI_MODEL' },
    update: {},
    create: {
      key: 'AI_MODEL',
      value: { model: 'gpt-4o-mini', provider: 'openai' },
      description: 'Modelo de IA para análisis de documentos',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'INSTITUTION_NAME' },
    update: {},
    create: {
      key: 'INSTITUTION_NAME',
      value: { name: 'Universidad Nacional', shortName: 'UNAL' },
      description: 'Nombre de la institución',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'MAX_FILE_SIZE_MB' },
    update: {},
    create: {
      key: 'MAX_FILE_SIZE_MB',
      value: { size: 50 },
      description: 'Tamaño máximo de archivo en MB',
    },
  });

  // Período académico
  await prisma.academicPeriod.upsert({
    where: { id: 'period-2024-2' },
    update: {},
    create: {
      id: 'period-2024-2',
      name: '2024-2',
      startDate: new Date('2024-07-15'),
      endDate: new Date('2024-12-15'),
      isActive: true,
      deliveryDeadlines: [
        { delivery: 1, date: '2024-09-01', description: 'Primer avance - Marco Teórico' },
        { delivery: 2, date: '2024-10-15', description: 'Segundo avance - Metodología' },
        { delivery: 3, date: '2024-11-30', description: 'Tercer avance - Resultados Parciales' },
      ],
    },
  });

  console.log('✅ Seed completado exitosamente');
  console.log('\n📋 Usuarios de prueba:');
  console.log('  👤 Admin:       admin@universidad.edu.co       / Admin123!');
  console.log('  👥 Coordinador: coordinador@universidad.edu.co / Coord123!');
  console.log('  📚 Asesor:      asesor@universidad.edu.co      / Asesor123!');
  console.log('  🎓 Estudiante:  estudiante@universidad.edu.co  / Student123!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
