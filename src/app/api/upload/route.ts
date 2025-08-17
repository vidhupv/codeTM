import { NextRequest, NextResponse } from 'next/server';
import { GitAnalyzer } from '@/lib/git-analyzer';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { spawn } from 'child_process';

const uploadSchema = z.object({
  repoName: z.string().min(1),
  repoUrl: z.string().url().optional(),
});

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
        // Actually clone the repository
        const timestamp = Date.now();
        const uploadsDir = path.join(process.cwd(), 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        const extractDir = path.join(uploadsDir, `${repoName}_${timestamp}`);

        try {
          // Use git clone command
          
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
          console.error('Git clone failed:', error);
          return NextResponse.json(
            { error: 'Failed to clone repository. Make sure the URL is correct and the repository is public.' },
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