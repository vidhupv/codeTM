import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get('id');

    if (repoId) {
      // Get specific repository
      const repository = await db.getRepository(repoId);
      if (!repository) {
        return NextResponse.json(
          { error: 'Repository not found' },
          { status: 404 }
        );
      }

      // Get commit summary
      const commits = await db.getCommits(repoId, 10);
      
      return NextResponse.json({
        success: true,
        repository,
        recentCommits: commits
      });
    } else {
      // List all repositories - for a simple implementation, we'll return an error
      // In a full implementation, you'd want to add a method to list repositories
      return NextResponse.json(
        { error: 'Repository listing not implemented yet' },
        { status: 501 }
      );
    }

  } catch (error) {
    console.error('Repository API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve repository information' },
      { status: 500 }
    );
  }
}