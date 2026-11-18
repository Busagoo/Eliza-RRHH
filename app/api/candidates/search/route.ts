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
  folders?: { id: string; name: string; color: string }[];
  tags?: { id: string; tagName: string; tagColor: string }[];
  notesCount?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body.query || "").trim();
    const filters = body.filters || {};
    const minExperience = filters.minExperience ? Number(filters.minExperience) : null;
    const seniority = filters.seniority && filters.seniority !== "ALL" ? filters.seniority : null;
    const includeHistorical = filters.includeHistorical !== false; // defaults to true (2024+)
    const folderId = filters.folderId && filters.folderId !== "ALL" ? filters.folderId : null;

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    // 1. Generate query embedding (1536 dims)
    const queryVector = await generateEmbedding(query);
    const vectorString = formatVectorForPg(queryVector);

    let candidatesForRerank: any[] = [];

    // If folderId is provided, get eligible candidate IDs first
    let allowedCandidateIds: string[] | null = null;
    if (folderId) {
      const folderAssignments = await prisma.candidateFolder.findMany({
        where: { folderId },
        select: { candidateId: true },
      });
      allowedCandidateIds = folderAssignments.map((a) => a.candidateId);
      if (allowedCandidateIds.length === 0) {
        return NextResponse.json({
          candidates: [],
          totalEvaluated: 0,
          searchQuery: query,
        });
      }
    }

    // 2. Attempt pgvector cosine similarity search
    try {
      const minExpFilter = minExperience ?? 0;
      const seniorityFilter = seniority ?? "%";

      let rawQuery = `SELECT
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
          AND ($4::boolean = true OR "receivedAt" >= NOW() - INTERVAL '6 months')`;

      if (allowedCandidateIds && allowedCandidateIds.length > 0) {
        const idList = allowedCandidateIds.map((id) => `'${id}'`).join(",");
        rawQuery += ` AND id IN (${idList})`;
      }

      rawQuery += ` ORDER BY embedding <=> $1::vector ASC LIMIT 30;`;

      const vectorResults: any[] = await prisma.$queryRawUnsafe(
        rawQuery,
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

      if (allowedCandidateIds && allowedCandidateIds.length > 0) {
        where.id = { in: allowedCandidateIds };
      }

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
      if (candidatesForRerank.length === 0 && !folderId) {
        candidatesForRerank = await prisma.candidate.findMany({
          take: 30,
          orderBy: { receivedAt: "desc" },
        });
      }
    }

    // Fetch related folders, tags, and notes count for all matched candidates
    const matchedIds = candidatesForRerank.map((c) => c.id);
    const [candidateFolders, candidateTags, candidateNotes] = await Promise.all([
      prisma.candidateFolder.findMany({
        where: { candidateId: { in: matchedIds } },
        include: { folder: true },
      }),
      prisma.candidateTagAssignment.findMany({
        where: { candidateId: { in: matchedIds } },
      }),
      prisma.candidateNote.groupBy({
        by: ["candidateId"],
        where: { candidateId: { in: matchedIds } },
        _count: { id: true },
      }),
    ]);

    const folderMap = new Map<string, { id: string; name: string; color: string }[]>();
    for (const cf of candidateFolders) {
      const list = folderMap.get(cf.candidateId) || [];
      list.push({ id: cf.folder.id, name: cf.folder.name, color: cf.folder.color || "#6366f1" });
      folderMap.set(cf.candidateId, list);
    }

    const tagMap = new Map<string, { id: string; tagName: string; tagColor: string }[]>();
    for (const ct of candidateTags) {
      const list = tagMap.get(ct.candidateId) || [];
      list.push({ id: ct.id, tagName: ct.tagName, tagColor: ct.tagColor || "#10b981" });
      tagMap.set(ct.candidateId, list);
    }

    const noteCountMap = new Map<string, number>();
    for (const cn of candidateNotes) {
      noteCountMap.set(cn.candidateId, cn._count.id);
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
        matchScore: evaluation?.matchScore ?? 10,
        justification: evaluation?.justification ?? "Sin evaluación específica.",
        keyStrengths: evaluation?.keyStrengths ?? [],
        missingRequirements: evaluation?.missingRequirements ?? [],
        similarityScore: c.similarity ? Math.round(Number(c.similarity) * 100) : undefined,
        folders: folderMap.get(c.id) || [],
        tags: tagMap.get(c.id) || [],
        notesCount: noteCountMap.get(c.id) || 0,
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
