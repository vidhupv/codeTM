import { NextRequest, NextResponse } from 'next/server';
import { LLMAnalyzer } from '@/lib/llm-analyzer';
import { z } from 'zod';

const patternsSchema = z.object({
  repoId: z.string().min(1),
  filePath: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = patternsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { repoId, filePath } = validation.data;

    // Initialize LLM analyzer
    const analyzer = new LLMAnalyzer();
    
    // Analyze patterns
    const patterns = await analyzer.analyzePatterns(repoId, filePath);

    return NextResponse.json({
      success: true,
      patterns
    });

  } catch (error) {
    console.error('Pattern analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze code patterns' },
      { status: 500 }
    );
  }
}