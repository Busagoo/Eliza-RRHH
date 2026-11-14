import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EmailStatus, SyncStatus } from "@prisma/client";
import { generateEmbedding, formatVectorForPg } from "@/lib/ai/embeddings";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // 1. Create or update Demo Account
    const account = await prisma.account.upsert({
      where: { email: "rrhh.talento@empresa.com" },
      create: {
        email: "rrhh.talento@empresa.com",
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      },
      update: {},
    });

    // 2. Create SyncState with realistic backfill metrics (e.g. 1,420 scanned, 310 CVs)
    await prisma.syncState.upsert({
      where: { id: "demo-sync-state" },
      create: {
        id: "demo-sync-state",
        accountId: account.id,
        status: SyncStatus.COMPLETED,
        totalScanned: 1420,
        totalResumesFound: 310,
        totalDiscarded: 1102,
        totalErrors: 8,
        queryFilter: "has:attachment (cv OR resume OR postulación) after:2024/01/01",
        startedAt: new Date(Date.now() - 3600000 * 24 * 7),
        completedAt: new Date(Date.now() - 3600000 * 2),
      },
      update: {
        totalScanned: 1420,
        totalResumesFound: 310,
        totalDiscarded: 1102,
      },
    });

    // 3. Demo Candidates spanning from 2024 to present
    const demoProfiles = [
      {
        fullName: "Martín Alejandro Rossi",
        email: "martin.rossi@devmail.com",
        phone: "+54 9 11 4522-8901",
        location: "Buenos Aires, Argentina (Remoto)",
        seniority: "Senior",
        experienceYears: 6,
        skills: ["React", "Next.js", "TypeScript", "Node.js", "PostgreSQL", "Tailwind CSS", "AWS", "Docker"],
        languages: [{ language: "Inglés", level: "Avanzado / C1" }, { language: "Español", level: "Nativo" }],
        summary: "Ingeniero de Software Senior con 6 años de experiencia en aplicaciones web de alto tráfico con React, TypeScript y Node.js. Lideró migraciones a arquitecturas serverless en AWS.",
        workHistory: [
          { company: "FinTech Latam", role: "Senior Fullstack Engineer", duration: "2022 - Presente", highlights: ["Desarrollo del core transaccional en Node y Next.js", "Reducción del tiempo de respuesta en 40%"] },
          { company: "SaaS Global", role: "Fullstack Developer", duration: "2019 - 2022", highlights: ["Microservicios con PostgreSQL y Docker"] }
        ],
        receivedAt: new Date("2024-03-15T14:22:00Z"), // March 2024 historical
        subject: "Postulación - Senior Fullstack Developer (Martín Rossi)",
        snippet: "Buenas tardes equipo de selección, adjunto mi CV actualizado para la posición de Desarrollador Senior...",
      },
      {
        fullName: "Lucía Florencia Mendez",
        email: "lucia.mendez@cloudtech.io",
        phone: "+54 9 351 678-9012",
        location: "Córdoba, Argentina (Híbrido/Remoto)",
        seniority: "Senior",
        experienceYears: 7,
        skills: ["Python", "Django", "FastAPI", "React", "PostgreSQL", "Kubernetes", "GCP", "Redis"],
        languages: [{ language: "Inglés", level: "Bilingüe / C2" }, { language: "Español", level: "Nativo" }],
        summary: "Arquitecta de backend y especialista en Python y APIs escalables con FastAPI y microservicios. Amplia experiencia integrando frontends modernos en React y pipelines CI/CD.",
        workHistory: [
          { company: "CloudScale Inc", role: "Backend Architect", duration: "2021 - Presente", highlights: ["Diseño de arquitectura de microservicios sobre Kubernetes y PostgreSQL"] },
          { company: "DataCorp", role: "Python Developer", duration: "2018 - 2021", highlights: ["APIs RESTful con FastAPI y Django"] }
        ],
        receivedAt: new Date("2024-06-20T10:15:00Z"), // June 2024 historical
        subject: "CV Lucía Mendez - Backend / Fullstack Senior",
        snippet: "Estimados, les comparto mi currículum para futuras búsquedas o vacantes abiertas en ingeniería...",
      },
      {
        fullName: "Joaquín Ignacio Benítez",
        email: "joaquin.benitez.dev@gmail.com",
        phone: "+54 9 11 3144-5566",
        location: "Rosario, Santa Fe (Remoto)",
        seniority: "Semi-Senior",
        experienceYears: 3,
        skills: ["React", "JavaScript", "TypeScript", "Tailwind CSS", "Redux Toolkit", "Next.js", "Git"],
        languages: [{ language: "Inglés", level: "Intermedio / B2" }, { language: "Español", level: "Nativo" }],
        summary: "Desarrollador Frontend SSR especializado en el ecosistema React, Next.js y Tailwind. Apasionado por la accesibilidad, diseño responsivo y optimización de rendimiento Core Web Vitals.",
        workHistory: [
          { company: "Digital Agency Web", role: "Frontend Developer", duration: "2022 - Presente", highlights: ["Interfaces reactivas con Next.js y TypeScript", "Optimización de Lighthouse a +95"] }
        ],
        receivedAt: new Date("2024-10-05T18:40:00Z"), // October 2024 historical
        subject: "Postulación Frontend React - Joaquín Benítez",
        snippet: "Hola! Me interesa mucho la vacante de Frontend Developer. Les dejo mi CV y portfolio...",
      },
      {
        fullName: "Valeria Sofía Albarracín",
        email: "valeria.albarracin@biotech.org",
        phone: "+54 9 11 8899-1234",
        location: "Buenos Aires (Remoto)",
        seniority: "Lead",
        experienceYears: 9,
        skills: ["Node.js", "Go", "React", "PostgreSQL", "Kafka", "AWS", "System Design", "Microservices"],
        languages: [{ language: "Inglés", level: "Avanzado / C1" }, { language: "Portugués", level: "Intermedio" }],
        summary: "Tech Lead y Arquitecta de Software con más de 9 años liderando equipos multidisciplinarios. Fuerte dominio en sistemas distribuidos, Kafka, PostgreSQL y arquitecturas resilientes.",
        workHistory: [
          { company: "Enterprise Systems", role: "Staff Tech Lead", duration: "2020 - Presente", highlights: ["Liderazgo técnico de 12 ingenieros", "Arquitectura orientada a eventos con Kafka"] }
        ],
        receivedAt: new Date(Date.now() - 3600000 * 48), // Recent: 2 days ago
        subject: "Candidatura Tech Lead / Principal Engineer - Valeria Albarracín",
        snippet: "Adjunto mi currículum vitae para la búsqueda de Liderazgo Técnico. Quedo a disposición para una reunión...",
      },
      {
        fullName: "Facundo Agustín Gómez",
        email: "facundo.gomez98@outlook.com",
        phone: "+54 9 261 455-7788",
        location: "Mendoza, Argentina (Remoto)",
        seniority: "Junior",
        experienceYears: 1,
        skills: ["HTML", "CSS", "JavaScript", "React", "Git", "Figma"],
        languages: [{ language: "Inglés", level: "Básico / A2" }, { language: "Español", level: "Nativo" }],
        summary: "Desarrollador Junior con sólida formación en React, JavaScript y desarrollo web frontend. Proactivo, enfocado en buenas prácticas y aprendizaje continuo.",
        workHistory: [
          { company: "Freelance", role: "Junior Web Developer", duration: "2023 - 2024", highlights: ["Sitios web responsive con React y Tailwind"] }
        ],
        receivedAt: new Date(Date.now() - 3600000 * 12), // Recent: 12 hours ago
        subject: "CV Postulación Trainee/Junior - Facundo Gómez",
        snippet: "Hola, les escribo para postularme a la posición Junior. Adjunto CV en PDF...",
      },
    ];

    for (const demo of demoProfiles) {
      const msgId = `demo_msg_${demo.email.replace(/[^a-zA-Z0-9]/g, "_")}`;

      const email = await prisma.email.upsert({
        where: { gmailMessageId: msgId },
        create: {
          gmailMessageId: msgId,
          sender: `${demo.fullName} <${demo.email}>`,
          senderEmail: demo.email,
          senderName: demo.fullName,
          subject: demo.subject,
          snippet: demo.snippet,
          receivedAt: demo.receivedAt,
          status: EmailStatus.PROCESSED,
          hasAttachment: true,
          attachmentFilename: `CV_${demo.fullName.replace(/\s+/g, "_")}.pdf`,
          attachmentMimeType: "application/pdf",
          attachmentSize: 142000,
        },
        update: {
          receivedAt: demo.receivedAt,
          status: EmailStatus.PROCESSED,
        },
      });

      const candidate = await prisma.candidate.upsert({
        where: { emailId: email.id },
        create: {
          emailId: email.id,
          fullName: demo.fullName,
          contactEmail: demo.email,
          phone: demo.phone,
          location: demo.location,
          seniority: demo.seniority,
          experienceYears: demo.experienceYears,
          skills: demo.skills,
          languages: demo.languages as any,
          parsedData: {
            fullName: demo.fullName,
            contactEmail: demo.email,
            phone: demo.phone,
            location: demo.location,
            seniority: demo.seniority,
            yearsOfExperience: demo.experienceYears,
            languages: demo.languages,
            skills: demo.skills,
            workHistory: demo.workHistory,
            education: [{ institution: "Universidad Tecnológica Nacional", degree: "Licenciatura en Sistemas" }],
            summary: demo.summary,
          },
          resumeFileUrl: `/uploads/resumes/demo_${demo.email.split("@")[0]}.pdf`,
          receivedAt: demo.receivedAt,
        },
        update: {
          receivedAt: demo.receivedAt,
          skills: demo.skills,
          experienceYears: demo.experienceYears,
          seniority: demo.seniority,
        },
      });

      // Generate embedding vector
      try {
        const textToEmbed = `${demo.fullName} ${demo.seniority} ${demo.skills.join(" ")} ${demo.summary}`;
        const vector = await generateEmbedding(textToEmbed);
        if (vector && vector.length === 1536) {
          const vectorSql = formatVectorForPg(vector);
          await prisma.$executeRawUnsafe(
            `UPDATE candidates SET embedding = $1::vector WHERE id = $2`,
            vectorSql,
            candidate.id
          );
        }
      } catch (err) {
        // vector table column might be pending migration
      }
    }

    // Also add some DISCARDED transactional emails to verify Panel 1 triage display
    const discardedDemos = [
      {
        gmailMessageId: "demo_discarded_1",
        sender: "Google Security <no-reply@accounts.google.com>",
        subject: "Alerta de seguridad para tu cuenta vinculada",
        snippet: "Se ha detectado un nuevo inicio de sesión en un dispositivo Windows...",
        receivedAt: new Date(Date.now() - 3600000 * 5),
        status: EmailStatus.DISCARDED,
        discardReason: "Automated transactional or security email (no resume attachment)",
      },
      {
        gmailMessageId: "demo_discarded_2",
        sender: "Newsletter Tech <news@dailydev.io>",
        subject: "Top 10 tendencias en Inteligencia Artificial de la semana",
        snippet: "Descubre los nuevos modelos de lenguaje y arquitecturas de agentes...",
        receivedAt: new Date(Date.now() - 3600000 * 20),
        status: EmailStatus.DISCARDED,
        discardReason: "Boletín informativo / newsletter (sin postulación laboral)",
      },
    ];

    for (const d of discardedDemos) {
      await prisma.email.upsert({
        where: { gmailMessageId: d.gmailMessageId },
        create: {
          gmailMessageId: d.gmailMessageId,
          sender: d.sender,
          subject: d.subject,
          snippet: d.snippet,
          receivedAt: d.receivedAt,
          status: d.status,
          discardReason: d.discardReason,
          hasAttachment: false,
        },
        update: {},
      });
    }

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully with demo historical & recent candidates and emails!",
      count: demoProfiles.length,
    });
  } catch (err: any) {
    console.error("[Seed] Error seeding demo data:", err);
    return NextResponse.json({ error: "Seed failed", message: err.message }, { status: 500 });
  }
}
