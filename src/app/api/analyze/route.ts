import { NextRequest, NextResponse } from 'next/server';
import { LLMAnalyzer } from '@/lib/llm-analyzer';
import { z } from 'zod';

const analyzeSchema = z.object({
  question: z.string().min(1),
  repoId: z.string().min(1),
  filePath: z.string().optional(),
  timeRange: z.object({
    from: z.string(),
    to: z.string()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = analyzeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { question, repoId, filePath, timeRange } = validation.data;

    // Initialize LLM analyzer
    const analyzer = new LLMAnalyzer();
    
    // Analyze evolution based on the question
    const result = await analyzer.analyzeEvolution({
      question,
      repoId,
      filePath,
      timeRange
    });

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze codebase evolution' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get('repoId');
    const analysisType = searchParams.get('type');

    if (!repoId) {
      return NextResponse.json(
        { error: 'Repository ID is required' },
        { status: 400 }
      );
    }

    // Import database here to avoid initialization issues
    const { db } = await import('@/lib/database');
    
    // Get existing analysis results
    const analyses = await db.getAnalysis(repoId, analysisType || undefined);

    return NextResponse.json({
      success: true,
      analyses: analyses.map(analysis => ({
        id: analysis.id,
        analysisType: analysis.analysis_type,
        result: JSON.parse(analysis.result),
        createdAt: analysis.created_at
      }))
    });

  } catch (error) {
    console.error('Error retrieving analyses:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve analysis results' },
      { status: 500 }
    );
  }
}