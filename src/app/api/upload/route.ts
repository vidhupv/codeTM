import { NextRequest, NextResponse } from 'next/server';
import { GitAnalyzer } from '@/lib/git-analyzer';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { spawn } from 'child_process';
import { Octokit } from 'octokit';

const uploadSchema = z.object({
  repoName: z.string().min(1),
  repoUrl: z.string().url().optional(),
});

// Helper function to check if we're in a serverless environment
function isServerlessEnvironment(): boolean {
  return process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
}

// Helper function to parse GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/|\.git|$)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace('.git', '') };
}

// Helper function to fetch repository using GitHub API (serverless-friendly)
async function fetchRepositoryViaAPI(repoUrl: string, extractDir: string): Promise<void> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error('Invalid GitHub URL format');
  }

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined, // Optional token for higher rate limits
  });

  // Create directory structure
  await fs.mkdir(extractDir, { recursive: true });

  try {
    // Get repository information and default branch
    const { data: repoInfo } = await octokit.rest.repos.get({
      owner: parsed.owner,
      repo: parsed.repo,
    });

    // Get the repository tree (all files)
    const { data: tree } = await octokit.rest.git.getTree({
      owner: parsed.owner,
      repo: parsed.repo,
      tree_sha: repoInfo.default_branch,
      recursive: 'true',
    });

    // Download each file
    for (const item of tree.tree) {
      if (item.type === 'blob' && item.path && item.sha) {
        try {
          const { data: blob } = await octokit.rest.git.getBlob({
            owner: parsed.owner,
            repo: parsed.repo,
            file_sha: item.sha,
          });

          const filePath = path.join(extractDir, item.path);
          const fileDir = path.dirname(filePath);
          
          // Create directory if needed
          await fs.mkdir(fileDir, { recursive: true });
          
          // Write file content
          const content = blob.encoding === 'base64' 
            ? Buffer.from(blob.content, 'base64')
            : blob.content;
          
          await fs.writeFile(filePath, content);
        } catch (fileError) {
          console.log(`Skipping file ${item.path}: ${fileError}`);
          // Continue with other files
        }
      }
    }

    // Create a minimal git repository structure for the analyzer
    const gitDir = path.join(extractDir, '.git');
    await fs.mkdir(gitDir, { recursive: true });
    
    // Create basic git config to make it look like a git repo
    await fs.writeFile(path.join(gitDir, 'config'), `[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
[remote "origin"]
	url = ${repoUrl}
	fetch = +refs/heads/*:refs/remotes/origin/*
`);
    
  } catch (error) {
    throw new Error(`Failed to fetch repository via GitHub API: ${error}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Handle JSON requests (GitHub URL cloning)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { repoName, repoUrl, cloneFromGitHub } = body;

      // Validate input
      const validation = uploadSchema.safeParse({
        repoName,
        repoUrl: repoUrl || undefined
      });

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid input data', details: validation.error.issues },
          { status: 400 }
        );
      }

      if (cloneFromGitHub && repoUrl) {
        // Clone repository using appropriate method
        const timestamp = Date.now();
        const uploadsDir = path.join(process.cwd(), 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        const extractDir = path.join(uploadsDir, `${repoName}_${timestamp}`);

        try {
          if (isServerlessEnvironment()) {
            // Use GitHub API for serverless environments
            console.log('Using GitHub API for serverless environment');
            await fetchRepositoryViaAPI(repoUrl, extractDir);
          } else {
            // Use git clone for local development
            console.log('Using git clone for local development');
            await new Promise((resolve, reject) => {
              const gitClone = spawn('git', ['clone', repoUrl, extractDir], {
                stdio: 'inherit'
              });
              
              gitClone.on('close', (code) => {
                if (code === 0) {
                  resolve(true);
                } else {
                  reject(new Error(`Git clone failed with code ${code}`));
                }
              });
              
              gitClone.on('error', (error) => {
                reject(error);
              });
            });
          }

          // Initialize git analyzer with the cloned repository
          const analyzer = new GitAnalyzer(extractDir);
          
          // Analyze the repository
          const analysis = await analyzer.analyzeRepository(repoName, repoUrl);
          
          // Start background analysis of commit history
          analyzer.analyzeCommitHistory(analysis.repository.id).catch(error => {
            console.error('Background commit analysis failed:', error);
          });

          return NextResponse.json({
            success: true,
            repository: analysis.repository,
            analysis: {
              totalCommits: analysis.totalCommits,
              authors: analysis.authors,
              languages: analysis.languages,
              dateRange: analysis.dateRange
            }
          });
        } catch (error) {
          console.error('Repository fetch failed:', error);
          return NextResponse.json(
            { 
              error: 'Failed to fetch repository. Make sure the URL is correct and the repository is public.',
              details: error instanceof Error ? error.message : 'Unknown error',
              method: isServerlessEnvironment() ? 'GitHub API' : 'git clone'
            },
            { status: 500 }
          );
        }
      }
    }

    // Handle FormData requests (file uploads)
    const formData = await request.formData();
    const file = formData.get('repository') as File;
    const repoName = formData.get('repoName') as string;
    const repoUrl = formData.get('repoUrl') as string;

    // Validate input
    const validation = uploadSchema.safeParse({
      repoName,
      repoUrl: repoUrl || undefined
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validation.error.issues },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No repository file provided' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Save uploaded file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const timestamp = Date.now();
    const fileName = `${repoName}_${timestamp}.zip`;
    const filePath = path.join(uploadsDir, fileName);
    
    await fs.writeFile(filePath, buffer);

    // Extract the repository (assuming it's a zip file)
    const extractDir = path.join(uploadsDir, `${repoName}_${timestamp}`);
    await fs.mkdir(extractDir, { recursive: true });

    // For now, we'll assume the user uploads a git repository directly
    // In a production app, you'd want to handle zip extraction here
    
    // Initialize git analyzer
    const analyzer = new GitAnalyzer(extractDir);
    
    // Analyze the repository
    const analysis = await analyzer.analyzeRepository(repoName, repoUrl);
    
    // Start background analysis of commit history
    analyzer.analyzeCommitHistory(analysis.repository.id).catch(error => {
      console.error('Background commit analysis failed:', error);
    });

    return NextResponse.json({
      success: true,
      repository: analysis.repository,
      analysis: {
        totalCommits: analysis.totalCommits,
        authors: analysis.authors,
        languages: analysis.languages,
        dateRange: analysis.dateRange
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process repository upload' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}