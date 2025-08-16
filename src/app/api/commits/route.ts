import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get('repoId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!repoId) {
      return NextResponse.json(
        { error: 'Repository ID is required' },
        { status: 400 }
      );
    }

    // Get commits for the repository
    const commits = await db.getCommits(repoId, limit, offset);
    
    // Get file changes for each commit (limit to recent commits to avoid performance issues)
    const commitsWithChanges = await Promise.all(
      commits.slice(0, 10).map(async (commit) => {
        const fileChanges = await db.getFileChanges(commit.id);
        return {
          ...commit,
          fileChanges
        };
      })
    );

    return NextResponse.json({
      success: true,
      commits: commitsWithChanges,
      pagination: {
        limit,
        offset,
        hasMore: commits.length === limit
      }
    });

  } catch (error) {
    console.error('Commits API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve commits' },
      { status: 500 }
    );
  }
}