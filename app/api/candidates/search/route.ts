import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateEmbedding, formatVectorForPg } from "@/lib/ai/embeddings";
import { rerankCandidatesWithLLM, CandidateForReranking } from "@/lib/ai/reranker";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export interface CandidateSearchResponseItem {
  id: string;
  fullName: string;
  contactEmail?: string | null;
  phone?: string | null;
  location?: string | null;
  seniority?: string | null;
  experienceYears: number;
  skills: string[];
  languages: any;
  summary?: string | null;
  workHistory?: any[];
  education?: any[];
  resumeFileUrl?: string | null;
  receivedAt: Date | string;
  matchScore: number;
  justification: string;
  keyStrengths: string[];
  missingRequirements: string[];
  similarityScore?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body.query || "").trim();
    const filters = body.filters || {};
    const minExperience = filters.minExperience ? Number(filters.minExperience) : null;
    const seniority = filters.seniority && filters.seniority !== "ALL" ? filters.seniority : null;
    const includeHistorical = filters.includeHistorical !== false; // defaults to true (2024+)

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    // 1. Generate query embedding (1536 dims)
    const queryVector = await generateEmbedding(query);
    const vectorString = formatVectorForPg(queryVector);

    let candidatesForRerank: any[] = [];

    // 2. Attempt pgvector cosine similarity search
    try {
      const minExpFilter = minExperience ?? 0;
      const seniorityFilter = seniority ?? "%";

      const vectorResults: any[] = await prisma.$queryRawUnsafe(
        `SELECT
          id,
          "fullName",
          "contactEmail",
          phone,
          location,
          seniority,
          "experienceYears",
          skills,
          languages,
          "parsedData",
          "resumeFileUrl",
          "resumeText",
          "receivedAt",
          (1 - (embedding <=> $1::vector)) AS similarity
        FROM candidates
        WHERE "experienceYears" >= $2
          AND ($3 = '%' OR seniority = $3)
          AND ($4::boolean = true OR "receivedAt" >= NOW() - INTERVAL '6 months')
        ORDER BY embedding <=> $1::vector ASC
        LIMIT 30;`,
        vectorString,
        minExpFilter,
        seniorityFilter,
        includeHistorical
      );

      if (vectorResults && vectorResults.length > 0) {
        candidatesForRerank = vectorResults;
      }
    } catch (pgvectorErr: any) {
      console.warn(
        "[CandidateSearch] pgvector query fallback to relational search:",
        pgvectorErr.message
      );
    }

    // 3. Fallback relational query if pgvector is not initialized or yielded zero results
    if (candidatesForRerank.length === 0) {
      const where: Prisma.CandidateWhereInput = {};

      if (minExperience) {
        where.experienceYears = { gte: minExperience };
      }
      if (seniority) {
        where.seniority = seniority;
      }
      if (!includeHistorical) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        where.receivedAt = { gte: sixMonthsAgo };
      }

      // Extract search keywords for full-text / array matching
      const keywords = query
        .toLowerCase()
        .split(/[\s,.;:/+]+/)
        .filter((w: string) => w.length > 2 && !["con", "para", "los", "las", "del", "que", "una"].includes(w));

      if (keywords.length > 0) {
        where.OR = [
          { skills: { hasSome: keywords } },
          { fullName: { contains: keywords[0], mode: "insensitive" } },
        ];
      }

      candidatesForRerank = await prisma.candidate.findMany({
        where,
        take: 30,
        orderBy: { receivedAt: "desc" },
      });

      // If still empty due to strict filters, fetch top recent candidates to rank against
      if (candidatesForRerank.length === 0) {
        candidatesForRerank = await prisma.candidate.findMany({
          take: 30,
          orderBy: { receivedAt: "desc" },
        });
      }
    }

    // 4. Map candidates to CandidateForReranking interface
    const candidatesPrepared: CandidateForReranking[] = candidatesForRerank.map((c: any) => {
      const parsed = typeof c.parsedData === "object" && c.parsedData ? c.parsedData : {};
      return {
        id: c.id,
        fullName: c.fullName,
        seniority: c.seniority,
        experienceYears: c.experienceYears,
        skills: Array.isArray(c.skills) ? c.skills : [],
        languages: c.languages,
        location: c.location,
        summary: parsed.summary || c.resumeText?.slice(0, 300) || "",
        workHistory: parsed.workHistory || [],
        receivedAt: c.receivedAt,
      };
    });

    // 5. Run LLM Re-Ranking on top 30 candidates
    const rankingResults = await rerankCandidatesWithLLM(query, candidatesPrepared);
    const rankingMap = new Map(rankingResults.map((r) => [r.candidateId, r]));

    // 6. Merge, calculate final score, and sort descending
    const finalizedCandidates: CandidateSearchResponseItem[] = candidatesForRerank.map((c: any) => {
      const evaluation = rankingMap.get(c.id);
      const parsed = typeof c.parsedData === "object" && c.parsedData ? c.parsedData : {};

      return {
        id: c.id,
        fullName: c.fullName,
        contactEmail: c.contactEmail,
        phone: c.phone,
        location: c.location,
        seniority: c.seniority,
        experienceYears: c.experienceYears,
        skills: Array.isArray(c.skills) ? c.skills : [],
        languages: c.languages,
        summary: parsed.summary || "",
        workHistory: parsed.workHistory || [],
        education: parsed.education || [],
        resumeFileUrl: c.resumeFileUrl,
        receivedAt: c.receivedAt,
        matchScore: evaluation?.matchScore ?? 60,
        justification: evaluation?.justification ?? "Coincidencia evaluada según perfil y experiencia técnica.",
        keyStrengths: evaluation?.keyStrengths ?? [],
        missingRequirements: evaluation?.missingRequirements ?? [],
        similarityScore: c.similarity ? Math.round(Number(c.similarity) * 100) : undefined,
      };
    });

    finalizedCandidates.sort((a, b) => b.matchScore - a.matchScore);

    // 7. Persist SearchQuery in history
    try {
      await prisma.searchQuery.create({
        data: {
          queryText: query,
          filters: filters as any,
          resultsCount: finalizedCandidates.length,
          topCandidateIds: finalizedCandidates.slice(0, 5).map((c) => c.id),
        },
      });
    } catch (saveErr) {
      console.warn("[CandidateSearch] Failed to record search history:", saveErr);
    }

    return NextResponse.json({
      query,
      totalFound: finalizedCandidates.length,
      candidates: finalizedCandidates,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[CandidateSearch] Search failed:", error);
    return NextResponse.json(
      { error: "Semantic candidate search failed", message: error.message },
      { status: 500 }
    );
  }
}
