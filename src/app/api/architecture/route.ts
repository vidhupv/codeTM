import { NextRequest, NextResponse } from 'next/server';
import { LLMAnalyzer } from '@/lib/llm-analyzer';
import { z } from 'zod';

const architectureSchema = z.object({
  repoId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = architectureSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { repoId } = validation.data;

    // Initialize LLM analyzer
    const analyzer = new LLMAnalyzer();
    
    // Analyze architectural decisions
    const decisions = await analyzer.analyzeArchitecturalDecisions(repoId);

    return NextResponse.json({
      success: true,
      decisions
    });

  } catch (error) {
    console.error('Architecture analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze architectural decisions' },
      { status: 500 }
    );
  }
}