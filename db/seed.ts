import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import { staffUsers, plans, gymSettings, exercises, routines, routineExercises } from "./schema";

const { Pool } = pg;

async function seed() {
  console.log("🌱 Starting database seed...\n");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    // ============================================
    // Create default admin user
    // ============================================
    console.log("👤 Creating default admin user...");

    const adminEmail = "admin@gym.com";
    const adminPassword = "admin123"; // Change in production!
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await db
      .insert(staffUsers)
      .values({
        email: adminEmail,
        passwordHash,
        name: "Administrador",
        role: "admin",
        active: true,
      })
      .onConflictDoNothing({ target: staffUsers.email });

    console.log(`   ✓ Admin user created: ${adminEmail}`);
    console.log(`   ✓ Default password: ${adminPassword}`);
    console.log("   ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!\n");

    // ============================================
    // Create default reception user
    // ============================================
    console.log("👤 Creating default reception user...");

    const receptionEmail = "recepcion@gym.com";
    const receptionPassword = "recepcion123";
    const receptionHash = await bcrypt.hash(receptionPassword, 12);

    await db
      .insert(staffUsers)
      .values({
        email: receptionEmail,
        passwordHash: receptionHash,
        name: "Recepción",
        role: "reception",
        active: true,
      })
      .onConflictDoNothing({ target: staffUsers.email });

    console.log(`   ✓ Reception user created: ${receptionEmail}`);
    console.log(`   ✓ Default password: ${receptionPassword}\n`);

    // ============================================
    // Create default membership plans
    // ============================================
    console.log("📋 Creating default membership plans...");

    const defaultPlans = [
      {
        name: "Mensual",
        description: "Acceso completo al gimnasio por 1 mes",
        durationDays: 30,
        price: "500.00",
      },
      {
        name: "Trimestral",
        description: "Acceso completo al gimnasio por 3 meses",
        durationDays: 90,
        price: "1350.00",
      },
      {
        name: "Semestral",
        description: "Acceso completo al gimnasio por 6 meses",
        durationDays: 180,
        price: "2400.00",
      },
      {
        name: "Anual",
        description: "Acceso completo al gimnasio por 1 año",
        durationDays: 365,
        price: "4200.00",
      },
      {
        name: "Pase Diario",
        description: "Acceso por un día",
        durationDays: 1,
        price: "80.00",
      },
    ];

    for (const plan of defaultPlans) {
      await db.insert(plans).values(plan).onConflictDoNothing();
      console.log(`   ✓ Plan created: ${plan.name} ($${plan.price})`);
    }
    console.log("");

    // ============================================
    // Create default gym settings
    // ============================================
    console.log("⚙️  Creating default gym settings...");

    const defaultSettings = [
      { key: "gym_name", value: "Mi Gimnasio" },
      { key: "morosity_tolerance_days", value: "5" },
      { key: "qr_duration_seconds", value: "30" },
      { key: "timezone", value: "America/Mexico_City" },
      { key: "currency", value: "MXN" },
      { key: "address", value: "" },
      { key: "phone", value: "" },
      { key: "email", value: "" },
    ];

    for (const setting of defaultSettings) {
      await db
        .insert(gymSettings)
        .values(setting)
        .onConflictDoNothing({ target: gymSettings.key });
      console.log(`   ✓ Setting: ${setting.key} = "${setting.value}"`);
    }
    console.log("");

    // ============================================
    // Create default exercises
    // ============================================
    console.log("💪 Creating default exercises...");

    const defaultExercises = [
      // Pecho
      { name: "Press de Banca", muscleGroup: "chest" as const, description: "Ejercicio basico para pecho con barra", equipment: "Barra, Banco" },
      { name: "Press Inclinado", muscleGroup: "chest" as const, description: "Press en banco inclinado para pecho superior", equipment: "Barra, Banco inclinado" },
      { name: "Aperturas con Mancuernas", muscleGroup: "chest" as const, description: "Aislamiento para pecho", equipment: "Mancuernas, Banco" },
      { name: "Fondos en Paralelas", muscleGroup: "chest" as const, description: "Ejercicio con peso corporal para pecho y triceps", equipment: "Barras paralelas" },
      { name: "Press con Mancuernas", muscleGroup: "chest" as const, description: "Press de pecho con mancuernas", equipment: "Mancuernas, Banco" },

      // Espalda
      { name: "Dominadas", muscleGroup: "back" as const, description: "Ejercicio basico para espalda", equipment: "Barra de dominadas" },
      { name: "Remo con Barra", muscleGroup: "back" as const, description: "Remo horizontal para espalda", equipment: "Barra" },
      { name: "Remo con Mancuerna", muscleGroup: "back" as const, description: "Remo unilateral", equipment: "Mancuerna, Banco" },
      { name: "Jalon al Pecho", muscleGroup: "back" as const, description: "Jalon en polea alta", equipment: "Polea alta" },
      { name: "Peso Muerto", muscleGroup: "back" as const, description: "Ejercicio compuesto para espalda baja y piernas", equipment: "Barra" },

      // Hombros
      { name: "Press Militar", muscleGroup: "shoulders" as const, description: "Press de hombros con barra", equipment: "Barra" },
      { name: "Elevaciones Laterales", muscleGroup: "shoulders" as const, description: "Aislamiento para deltoides lateral", equipment: "Mancuernas" },
      { name: "Elevaciones Frontales", muscleGroup: "shoulders" as const, description: "Aislamiento para deltoides frontal", equipment: "Mancuernas" },
      { name: "Pajaros", muscleGroup: "shoulders" as const, description: "Aislamiento para deltoides posterior", equipment: "Mancuernas" },
      { name: "Press Arnold", muscleGroup: "shoulders" as const, description: "Press rotacional para hombros completos", equipment: "Mancuernas" },

      // Biceps
      { name: "Curl con Barra", muscleGroup: "biceps" as const, description: "Curl basico para biceps", equipment: "Barra" },
      { name: "Curl con Mancuernas", muscleGroup: "biceps" as const, description: "Curl alternado con mancuernas", equipment: "Mancuernas" },
      { name: "Curl Martillo", muscleGroup: "biceps" as const, description: "Curl con agarre neutro", equipment: "Mancuernas" },
      { name: "Curl en Banco Scott", muscleGroup: "biceps" as const, description: "Curl concentrado en banco predicador", equipment: "Barra, Banco Scott" },

      // Triceps
      { name: "Press Frances", muscleGroup: "triceps" as const, description: "Extension de triceps acostado", equipment: "Barra, Banco" },
      { name: "Extensiones en Polea", muscleGroup: "triceps" as const, description: "Extension de triceps en polea alta", equipment: "Polea" },
      { name: "Fondos en Banco", muscleGroup: "triceps" as const, description: "Fondos apoyado en banco", equipment: "Banco" },
      { name: "Patada de Triceps", muscleGroup: "triceps" as const, description: "Extension trasera con mancuerna", equipment: "Mancuerna" },

      // Piernas
      { name: "Sentadilla", muscleGroup: "legs" as const, description: "Ejercicio basico para piernas", equipment: "Barra, Rack" },
      { name: "Prensa de Piernas", muscleGroup: "legs" as const, description: "Prensa en maquina", equipment: "Prensa" },
      { name: "Extension de Cuadriceps", muscleGroup: "legs" as const, description: "Aislamiento para cuadriceps", equipment: "Maquina de extensiones" },
      { name: "Curl de Femoral", muscleGroup: "legs" as const, description: "Aislamiento para isquiotibiales", equipment: "Maquina de curl" },
      { name: "Zancadas", muscleGroup: "legs" as const, description: "Ejercicio unilateral para piernas", equipment: "Mancuernas" },
      { name: "Sentadilla Bulgara", muscleGroup: "legs" as const, description: "Sentadilla unilateral con pie elevado", equipment: "Banco, Mancuernas" },

      // Gluteos
      { name: "Hip Thrust", muscleGroup: "glutes" as const, description: "Empuje de cadera para gluteos", equipment: "Barra, Banco" },
      { name: "Patada de Gluteo", muscleGroup: "glutes" as const, description: "Extension de cadera en cuadrupedia", equipment: "Ninguno" },
      { name: "Puente de Gluteo", muscleGroup: "glutes" as const, description: "Elevacion de cadera acostado", equipment: "Ninguno" },

      // Pantorrillas
      { name: "Elevacion de Talones de Pie", muscleGroup: "calves" as const, description: "Trabajo de gemelos de pie", equipment: "Maquina o escalon" },
      { name: "Elevacion de Talones Sentado", muscleGroup: "calves" as const, description: "Trabajo de soleo sentado", equipment: "Maquina" },

      // Abdominales
      { name: "Crunch", muscleGroup: "abs" as const, description: "Abdominal basico", equipment: "Ninguno" },
      { name: "Plancha", muscleGroup: "abs" as const, description: "Estabilizacion de core", equipment: "Ninguno" },
      { name: "Elevacion de Piernas", muscleGroup: "abs" as const, description: "Trabajo de abdomen inferior", equipment: "Banco o barra" },
      { name: "Russian Twist", muscleGroup: "abs" as const, description: "Trabajo de oblicuos con rotacion", equipment: "Peso o ninguno" },
      { name: "Ab Wheel", muscleGroup: "abs" as const, description: "Rodillo abdominal", equipment: "Rueda abdominal" },

      // Cardio
      { name: "Correr en Cinta", muscleGroup: "cardio" as const, description: "Cardio en caminadora", equipment: "Caminadora" },
      { name: "Bicicleta Estatica", muscleGroup: "cardio" as const, description: "Cardio en bicicleta", equipment: "Bicicleta estatica" },
      { name: "Eliptica", muscleGroup: "cardio" as const, description: "Cardio de bajo impacto", equipment: "Eliptica" },
      { name: "Remo", muscleGroup: "cardio" as const, description: "Cardio con remo", equipment: "Maquina de remo" },
      { name: "Saltar la Cuerda", muscleGroup: "cardio" as const, description: "Cardio con cuerda", equipment: "Cuerda" },

      // Cuerpo Completo
      { name: "Burpees", muscleGroup: "full_body" as const, description: "Ejercicio de cuerpo completo de alta intensidad", equipment: "Ninguno" },
      { name: "Clean and Press", muscleGroup: "full_body" as const, description: "Levantamiento olimpico", equipment: "Barra" },
      { name: "Thrusters", muscleGroup: "full_body" as const, description: "Sentadilla con press de hombros", equipment: "Barra o mancuernas" },
    ];

    const insertedExercises: { id: string; name: string }[] = [];
    for (const ex of defaultExercises) {
      const [inserted] = await db
        .insert(exercises)
        .values(ex)
        .onConflictDoNothing()
        .returning({ id: exercises.id, name: exercises.name });
      if (inserted) {
        insertedExercises.push(inserted);
      }
    }
    console.log(`   ✓ Created ${insertedExercises.length} exercises`);
    console.log("");

    // ============================================
    // Create default routines (system routines)
    // ============================================
    console.log("📋 Creating default routines...");

    // Helper to find exercise by name
    const findExercise = (name: string) => insertedExercises.find(e => e.name === name);

    // Routine 1: Push (Empuje)
    const [pushRoutine] = await db
      .insert(routines)
      .values({
        name: "Push - Empuje",
        description: "Rutina de empuje: pecho, hombros y triceps",
        difficulty: "intermediate",
        objective: "Fuerza e hipertrofia de musculos de empuje",
        estimatedMinutes: 60,
        isPublic: true,
        isSystem: true,
      })
      .onConflictDoNothing()
      .returning();

    if (pushRoutine) {
      const pushExercises = [
        { name: "Press de Banca", sets: 4, reps: "8-10", rest: 90 },
        { name: "Press Inclinado", sets: 3, reps: "10-12", rest: 90 },
        { name: "Press Militar", sets: 4, reps: "8-10", rest: 90 },
        { name: "Elevaciones Laterales", sets: 3, reps: "12-15", rest: 60 },
        { name: "Extensiones en Polea", sets: 3, reps: "12-15", rest: 60 },
        { name: "Fondos en Banco", sets: 3, reps: "12-15", rest: 60 },
      ];
      for (let i = 0; i < pushExercises.length; i++) {
        const ex = pushExercises[i];
        const exerciseData = findExercise(ex.name);
        if (exerciseData) {
          await db.insert(routineExercises).values({
            routineId: pushRoutine.id,
            exerciseId: exerciseData.id,
            orderIndex: i,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.rest,
          }).onConflictDoNothing();
        }
      }
      console.log("   ✓ Routine: Push - Empuje");
    }

    // Routine 2: Pull (Jalon)
    const [pullRoutine] = await db
      .insert(routines)
      .values({
        name: "Pull - Jalon",
        description: "Rutina de jalon: espalda y biceps",
        difficulty: "intermediate",
        objective: "Fuerza e hipertrofia de musculos de jalon",
        estimatedMinutes: 60,
        isPublic: true,
        isSystem: true,
      })
      .onConflictDoNothing()
      .returning();

    if (pullRoutine) {
      const pullExercises = [
        { name: "Dominadas", sets: 4, reps: "6-10", rest: 120 },
        { name: "Remo con Barra", sets: 4, reps: "8-10", rest: 90 },
        { name: "Jalon al Pecho", sets: 3, reps: "10-12", rest: 90 },
        { name: "Remo con Mancuerna", sets: 3, reps: "10-12", rest: 60 },
        { name: "Curl con Barra", sets: 3, reps: "10-12", rest: 60 },
        { name: "Curl Martillo", sets: 3, reps: "12-15", rest: 60 },
      ];
      for (let i = 0; i < pullExercises.length; i++) {
        const ex = pullExercises[i];
        const exerciseData = findExercise(ex.name);
        if (exerciseData) {
          await db.insert(routineExercises).values({
            routineId: pullRoutine.id,
            exerciseId: exerciseData.id,
            orderIndex: i,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.rest,
          }).onConflictDoNothing();
        }
      }
      console.log("   ✓ Routine: Pull - Jalon");
    }

    // Routine 3: Legs (Piernas)
    const [legsRoutine] = await db
      .insert(routines)
      .values({
        name: "Piernas Completo",
        description: "Rutina completa de piernas: cuadriceps, femorales, gluteos y pantorrillas",
        difficulty: "intermediate",
        objective: "Fuerza e hipertrofia de tren inferior",
        estimatedMinutes: 70,
        isPublic: true,
        isSystem: true,
      })
      .onConflictDoNothing()
      .returning();

    if (legsRoutine) {
      const legsExercises = [
        { name: "Sentadilla", sets: 4, reps: "6-8", rest: 120 },
        { name: "Prensa de Piernas", sets: 4, reps: "10-12", rest: 90 },
        { name: "Zancadas", sets: 3, reps: "12 c/pierna", rest: 60 },
        { name: "Curl de Femoral", sets: 3, reps: "12-15", rest: 60 },
        { name: "Hip Thrust", sets: 4, reps: "10-12", rest: 90 },
        { name: "Elevacion de Talones de Pie", sets: 4, reps: "15-20", rest: 45 },
      ];
      for (let i = 0; i < legsExercises.length; i++) {
        const ex = legsExercises[i];
        const exerciseData = findExercise(ex.name);
        if (exerciseData) {
          await db.insert(routineExercises).values({
            routineId: legsRoutine.id,
            exerciseId: exerciseData.id,
            orderIndex: i,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.rest,
          }).onConflictDoNothing();
        }
      }
      console.log("   ✓ Routine: Piernas Completo");
    }

    // Routine 4: Upper Body (Tren Superior)
    const [upperRoutine] = await db
      .insert(routines)
      .values({
        name: "Tren Superior",
        description: "Rutina de torso completo para principiantes",
        difficulty: "beginner",
        objective: "Desarrollo general del tren superior",
        estimatedMinutes: 50,
        isPublic: true,
        isSystem: true,
      })
      .onConflictDoNothing()
      .returning();

    if (upperRoutine) {
      const upperExercises = [
        { name: "Press de Banca", sets: 3, reps: "10-12", rest: 90 },
        { name: "Jalon al Pecho", sets: 3, reps: "10-12", rest: 90 },
        { name: "Press Militar", sets: 3, reps: "10-12", rest: 60 },
        { name: "Remo con Mancuerna", sets: 3, reps: "10-12", rest: 60 },
        { name: "Curl con Mancuernas", sets: 2, reps: "12-15", rest: 45 },
        { name: "Extensiones en Polea", sets: 2, reps: "12-15", rest: 45 },
      ];
      for (let i = 0; i < upperExercises.length; i++) {
        const ex = upperExercises[i];
        const exerciseData = findExercise(ex.name);
        if (exerciseData) {
          await db.insert(routineExercises).values({
            routineId: upperRoutine.id,
            exerciseId: exerciseData.id,
            orderIndex: i,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.rest,
          }).onConflictDoNothing();
        }
      }
      console.log("   ✓ Routine: Tren Superior");
    }

    // Routine 5: Full Body (Cuerpo Completo)
    const [fullBodyRoutine] = await db
      .insert(routines)
      .values({
        name: "Cuerpo Completo",
        description: "Rutina full body para principiantes - ideal para 2-3 dias por semana",
        difficulty: "beginner",
        objective: "Desarrollo muscular general y acondicionamiento",
        estimatedMinutes: 60,
        isPublic: true,
        isSystem: true,
      })
      .onConflictDoNothing()
      .returning();

    if (fullBodyRoutine) {
      const fullBodyExercises = [
        { name: "Sentadilla", sets: 3, reps: "8-10", rest: 120 },
        { name: "Press de Banca", sets: 3, reps: "8-10", rest: 90 },
        { name: "Remo con Barra", sets: 3, reps: "8-10", rest: 90 },
        { name: "Press Militar", sets: 3, reps: "10-12", rest: 60 },
        { name: "Curl con Barra", sets: 2, reps: "12-15", rest: 45 },
        { name: "Plancha", sets: 3, reps: "30-60 seg", rest: 45 },
      ];
      for (let i = 0; i < fullBodyExercises.length; i++) {
        const ex = fullBodyExercises[i];
        const exerciseData = findExercise(ex.name);
        if (exerciseData) {
          await db.insert(routineExercises).values({
            routineId: fullBodyRoutine.id,
            exerciseId: exerciseData.id,
            orderIndex: i,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.rest,
          }).onConflictDoNothing();
        }
      }
      console.log("   ✓ Routine: Cuerpo Completo");
    }

    // Routine 6: Core & Abs
    const [coreRoutine] = await db
      .insert(routines)
      .values({
        name: "Core y Abdominales",
        description: "Rutina enfocada en el core y zona media",
        difficulty: "beginner",
        objective: "Fortalecimiento del core y definicion abdominal",
        estimatedMinutes: 30,
        isPublic: true,
        isSystem: true,
      })
      .onConflictDoNothing()
      .returning();

    if (coreRoutine) {
      const coreExercises = [
        { name: "Plancha", sets: 3, reps: "45-60 seg", rest: 45 },
        { name: "Crunch", sets: 3, reps: "15-20", rest: 30 },
        { name: "Elevacion de Piernas", sets: 3, reps: "12-15", rest: 45 },
        { name: "Russian Twist", sets: 3, reps: "20 total", rest: 30 },
        { name: "Ab Wheel", sets: 3, reps: "10-12", rest: 60 },
      ];
      for (let i = 0; i < coreExercises.length; i++) {
        const ex = coreExercises[i];
        const exerciseData = findExercise(ex.name);
        if (exerciseData) {
          await db.insert(routineExercises).values({
            routineId: coreRoutine.id,
            exerciseId: exerciseData.id,
            orderIndex: i,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.rest,
          }).onConflictDoNothing();
        }
      }
      console.log("   ✓ Routine: Core y Abdominales");
    }

    console.log("\n✅ Database seed completed successfully!");
    console.log("\n📝 Summary:");
    console.log("   - 2 staff users (admin + reception)");
    console.log("   - 5 membership plans");
    console.log("   - 8 gym settings");
    console.log(`   - ${insertedExercises.length} exercises`);
    console.log("   - 6 system routines");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
