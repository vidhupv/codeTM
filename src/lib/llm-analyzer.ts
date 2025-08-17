import Anthropic from '@anthropic-ai/sdk';
import { db } from './database';
import { promises as fs } from 'fs';
import path from 'path';

export interface EvolutionQuery {
  question: string;
  repoId: string;
  filePath?: string;
  timeRange?: {
    from: string;
    to: string;
  };
}

export interface EvolutionResponse {
  answer: string;
  relevantCommits: string[];
  keyInsights: string[];
  patterns: string[];
  businessContext?: string;
}

export interface PatternAnalysis {
  pattern: string;
  description: string;
  introducedAt: string;
  evolution: string[];
  impact: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface ArchitecturalDecision {
  decision: string;
  rationale: string;
  commit: string;
  impact: string;
  alternatives: string[];
}

export class LLMAnalyzer {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  async analyzeEvolution(query: EvolutionQuery): Promise<EvolutionResponse> {
    console.log(`Analyzing evolution query: ${query.question}`);

    // Get repository information
    const repository = await db.getRepository(query.repoId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    // Get relevant commits and file changes
    const commits = await db.getCommits(query.repoId, 500);
    const filteredCommits = this.filterCommitsByQuery(commits, query);
    
    // Get codebase content for context
    const codebaseContent = await this.getCodebaseContent(repository.path);
    
    // Prepare enhanced context for the LLM
    const context = await this.prepareEnhancedEvolutionContext(filteredCommits, query, codebaseContent);
    
    const prompt = this.buildEvolutionPrompt(query, context);
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const analysis = this.parseEvolutionResponse(content.text);
      
      // Save analysis to database
      await db.saveAnalysis({
        repo_id: query.repoId,
        commit_id: null,
        file_path: query.filePath || null,
        analysis_type: 'evolution',
        result: JSON.stringify({
          query: query.question,
          ...analysis
        })
      });

      return analysis;
    } catch (error) {
      console.error('Error analyzing evolution:', error);
      throw new Error('Failed to analyze code evolution');
    }
  }

  async analyzePatterns(repoId: string, filePath?: string): Promise<PatternAnalysis[]> {
    console.log(`Analyzing patterns for repository ${repoId}`);
    
    // Get repository information
    const repository = await db.getRepository(repoId);
    if (!repository) {
      throw new Error('Repository not found');
    }
    
    const commits = await db.getCommits(repoId, 200);
    const codebaseContent = await this.getCodebaseContent(repository.path);
    const context = await this.prepareEnhancedPatternContext(commits, codebaseContent, filePath);
    
    const prompt = this.buildPatternPrompt(context);
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const patterns = this.parsePatternResponse(content.text);
      
      // Save analysis to database
      await db.saveAnalysis({
        repo_id: repoId,
        commit_id: null,
        file_path: filePath || null,
        analysis_type: 'pattern',
        result: JSON.stringify(patterns)
      });

      return patterns;
    } catch (error) {
      console.error('Error analyzing patterns:', error);
      throw new Error('Failed to analyze code patterns');
    }
  }

  async analyzeArchitecturalDecisions(repoId: string): Promise<ArchitecturalDecision[]> {
    console.log(`Analyzing architectural decisions for repository ${repoId}`);
    
    // Get repository information
    const repository = await db.getRepository(repoId);
    if (!repository) {
      throw new Error('Repository not found');
    }
    
    const commits = await db.getCommits(repoId, 300);
    const majorCommits = commits.filter(commit => 
      commit.files_changed > 5 || 
      commit.message.toLowerCase().includes('refactor') ||
      commit.message.toLowerCase().includes('architecture') ||
      commit.message.toLowerCase().includes('redesign') ||
      commit.message.toLowerCase().includes('breaking')
    );
    
    // Get codebase content for enhanced analysis
    const codebaseContent = await this.getCodebaseContent(repository.path);
    const context = await this.prepareEnhancedArchitecturalContext(majorCommits, codebaseContent);
    const prompt = this.buildEnhancedArchitecturalPrompt(context);
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1800,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const decisions = this.parseArchitecturalResponse(content.text);
      
      // Save analysis to database
      await db.saveAnalysis({
        repo_id: repoId,
        commit_id: null,
        file_path: null,
        analysis_type: 'architecture',
        result: JSON.stringify(decisions)
      });

      return decisions;
    } catch (error) {
      console.error('Error analyzing architectural decisions:', error);
      throw new Error('Failed to analyze architectural decisions');
    }
  }

  private filterCommitsByQuery(commits: any[], query: EvolutionQuery) {
    let filtered = commits;
    
    // Filter by time range
    if (query.timeRange) {
      const fromDate = new Date(query.timeRange.from);
      const toDate = new Date(query.timeRange.to);
      filtered = filtered.filter(commit => {
        const commitDate = new Date(commit.date);
        return commitDate >= fromDate && commitDate <= toDate;
      });
    }
    
    // Filter by file path if specified
    if (query.filePath) {
      // This would require file change data - for now we'll include all commits
      // In a more complete implementation, we'd filter by commits that touched the specific file
    }
    
    return filtered.slice(0, 100); // Limit to prevent token overflow
  }

  private async getCodebaseContent(repoPath: string): Promise<{ [filePath: string]: string }> {
    const fileContents: { [filePath: string]: string } = {};
    
    try {
      // For demo, read key files like README, package.json, main source files
      const keyFiles = ['README.md', 'package.json', 'tsconfig.json', 'src/index.ts', 'src/main.ts', 'src/app.ts', 'index.js', 'main.py', '__init__.py'];
      
      for (const file of keyFiles) {
        try {
          const fullPath = path.join(repoPath, file);
          const content = await fs.readFile(fullPath, 'utf-8');
          if (content.length < 50000) { // Limit size to prevent token overflow
            fileContents[file] = content;
          }
        } catch (error) {
          // File doesn't exist, skip
        }
      }
    } catch (error) {
      console.error('Error reading codebase content:', error);
    }
    
    return fileContents;
  }

  private async prepareEnhancedEvolutionContext(commits: any[], query: EvolutionQuery, codebaseContent: { [filePath: string]: string }): Promise<string> {
    const commitSummaries = commits.slice(0, 20).map(commit => ({
      hash: commit.hash.substring(0, 8),
      date: commit.date,
      author: commit.author,
      message: commit.message,
      filesChanged: commit.files_changed,
      insertions: commit.insertions,
      deletions: commit.deletions
    }));

    const contextData = {
      query: query.question,
      filePath: query.filePath,
      timeRange: query.timeRange,
      commits: commitSummaries,
      codebaseSnapshot: {
        keyFiles: Object.keys(codebaseContent),
        fileContents: codebaseContent
      },
      repositoryStats: {
        totalCommits: commits.length,
        timeSpan: commits.length > 0 ? `${commits[commits.length - 1]?.date} to ${commits[0]?.date}` : 'Unknown'
      }
    };

    return JSON.stringify(contextData, null, 2);
  }

  private async prepareEvolutionContext(commits: any[], query: EvolutionQuery): Promise<string> {
    const commitSummaries = commits.map(commit => ({
      hash: commit.hash.substring(0, 8),
      date: commit.date,
      author: commit.author,
      message: commit.message,
      filesChanged: commit.files_changed,
      insertions: commit.insertions,
      deletions: commit.deletions
    }));

    return JSON.stringify({
      query: query.question,
      filePath: query.filePath,
      timeRange: query.timeRange,
      commits: commitSummaries
    }, null, 2);
  }

  private async prepareEnhancedPatternContext(commits: any[], codebaseContent: { [filePath: string]: string }, filePath?: string): Promise<string> {
    const commitSummaries = commits.slice(0, 30).map(commit => ({
      hash: commit.hash.substring(0, 8),
      date: commit.date,
      message: commit.message,
      filesChanged: commit.files_changed,
      insertions: commit.insertions,
      deletions: commit.deletions
    }));

    return JSON.stringify({
      filePath,
      commits: commitSummaries,
      codebaseSnapshot: {
        keyFiles: Object.keys(codebaseContent),
        fileContents: codebaseContent
      },
      analysisTarget: filePath || 'entire repository'
    }, null, 2);
  }

  private async preparePatternContext(commits: any[], filePath?: string): Promise<string> {
    const commitSummaries = commits.map(commit => ({
      hash: commit.hash.substring(0, 8),
      date: commit.date,
      message: commit.message,
      filesChanged: commit.files_changed
    }));

    return JSON.stringify({
      filePath,
      commits: commitSummaries
    }, null, 2);
  }

  private async prepareEnhancedArchitecturalContext(commits: any[], codebaseContent: { [filePath: string]: string }): Promise<string> {
    const commitSummaries = commits.slice(0, 20).map(commit => ({
      hash: commit.hash.substring(0, 8),
      date: commit.date,
      author: commit.author,
      message: commit.message,
      filesChanged: commit.files_changed,
      insertions: commit.insertions,
      deletions: commit.deletions
    }));

    return JSON.stringify({
      majorCommits: commitSummaries,
      codebaseSnapshot: {
        keyFiles: Object.keys(codebaseContent),
        fileContents: codebaseContent
      },
      analysisTarget: 'architectural decisions in major commits',
      repositoryStats: {
        totalMajorCommits: commits.length,
        timeSpan: commits.length > 0 ? `${commits[commits.length - 1]?.date} to ${commits[0]?.date}` : 'Unknown'
      }
    }, null, 2);
  }

  private async prepareArchitecturalContext(commits: any[]): Promise<string> {
    const commitSummaries = commits.map(commit => ({
      hash: commit.hash.substring(0, 8),
      date: commit.date,
      author: commit.author,
      message: commit.message,
      filesChanged: commit.files_changed,
      insertions: commit.insertions,
      deletions: commit.deletions
    }));

    return JSON.stringify(commitSummaries, null, 2);
  }

  private buildEvolutionPrompt(query: EvolutionQuery, context: string): string {
    return `You are an expert software architect analyzing a codebase's evolution. You have access to both commit history and actual source code.

User Question: "${query.question}"

Rich Context (commits, file contents, and repository structure):
${context}

Instructions:
- Analyze the actual code content to understand the repository's purpose and architecture
- Use commit messages and timestamps to understand how the codebase evolved
- Look for patterns, refactoring, architectural decisions, and feature development
- Connect technical changes to business decisions where possible
- Be specific and cite actual file names and commit hashes

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Format your response as JSON with the following structure:
{
  "answer": "Comprehensive answer based on actual code analysis and commit history",
  "relevantCommits": ["commit1", "commit2"],
  "keyInsights": ["specific insight about the codebase evolution", "another insight"],
  "patterns": ["architectural pattern observed", "development pattern identified"],
  "businessContext": "Inferred business reasoning behind technical decisions"
}`;
  }

  private buildPatternPrompt(context: string): string {
    return `Analyze this codebase history to identify architectural and design patterns that were introduced over time.

Commit History:
${context}

Identify patterns such as:
- Design patterns (MVC, Observer, Factory, etc.)
- Architectural patterns (Microservices, Layered, Event-driven, etc.)
- Code organization patterns
- Development practices
- Technology adoption patterns

For each pattern, provide:
- Pattern name and description
- When it was likely introduced (commit hash if identifiable)
- How it evolved over time
- Impact level (high/medium/low)
- Reasoning for introduction

IMPORTANT: You must respond with ONLY valid JSON array. Do not include any text before or after the JSON.

Format as JSON array:
[
  {
    "pattern": "Pattern name",
    "description": "What this pattern is",
    "introducedAt": "Commit hash or date",
    "evolution": ["Change 1", "Change 2"],
    "impact": "high|medium|low",
    "reasoning": "Why this pattern was likely adopted"
  }
]`;
  }

  private buildEnhancedArchitecturalPrompt(context: string): string {
    return `You are an expert software architect analyzing a codebase's architectural decisions. You have access to both major commit history AND actual source code content.

Rich Context (major commits, file contents, and repository structure):
${context}

Your task is to identify key architectural decisions made in this codebase by analyzing:

1. **Source Code Analysis**: Examine the actual code structure, patterns, and technologies used
2. **Commit Messages**: Look for refactoring, architectural changes, framework adoptions
3. **File Structure**: Analyze how the codebase is organized and structured
4. **Technology Choices**: Identify frameworks, libraries, and tools adopted

Look for architectural decisions such as:
- Technology and framework choices (React vs Vue, REST vs GraphQL, etc.)
- Architectural patterns (MVC, microservices, monolith, etc.)
- Code organization decisions (folder structure, module boundaries)
- Database and storage decisions
- API design choices
- Security architecture decisions
- Performance optimization strategies
- Testing approach decisions

For each decision, provide:
- **Decision**: What specific architectural choice was made
- **Rationale**: Why this decision was likely made (inferred from code structure, commit messages, and context)
- **Commit**: Relevant commit hash where this decision was implemented
- **Impact**: How this decision affected the overall codebase architecture and development
- **Alternatives**: What other approaches could have been considered

**Important Instructions**:
- Base your analysis on ACTUAL code content, not just commit messages
- Be specific about the technologies, patterns, and architectural choices you observe
- Connect the decisions to the business/technical context when possible
- Only identify decisions that are actually evident in the codebase

IMPORTANT: You must respond with ONLY valid JSON array. Do not include any text before or after the JSON.

Format as JSON array:
[
  {
    "decision": "Specific architectural decision made",
    "rationale": "Evidence-based reasoning for why this decision was made",
    "commit": "Relevant commit hash",
    "impact": "Concrete impact on codebase architecture and development",
    "alternatives": ["Alternative approach 1", "Alternative approach 2"]
  }
]`;
  }

  private buildArchitecturalPrompt(context: string): string {
    return `Analyze these major commits to identify key architectural decisions made in this codebase.

Major Commits:
${context}

Look for decisions such as:
- Technology choices
- Architectural style changes
- Major refactorings
- Framework adoptions
- Design principle changes

For each decision, provide:
- The decision made
- Rationale (inferred from commit messages and changes)
- Impact on the codebase
- Alternative approaches that might have been considered

IMPORTANT: You must respond with ONLY valid JSON array. Do not include any text before or after the JSON.

Format as JSON array:
[
  {
    "decision": "What decision was made",
    "rationale": "Why this decision was likely made",
    "commit": "Relevant commit hash",
    "impact": "How this affected the codebase",
    "alternatives": ["Alternative 1", "Alternative 2"]
  }
]`;
  }

  private parseEvolutionResponse(response: string): EvolutionResponse {
    try {
      // Try to extract JSON from the response if it contains other text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;
      return JSON.parse(jsonString);
    } catch (error) {
      // Fallback parsing if JSON is malformed
      console.error('Failed to parse evolution response:', error);
      return {
        answer: response.length > 500 ? response.substring(0, 500) + "..." : response,
        relevantCommits: [],
        keyInsights: ["Unable to parse structured response"],
        patterns: ["Raw response provided above"],
        businessContext: "Please try asking a more specific question"
      };
    }
  }

  private parsePatternResponse(response: string): PatternAnalysis[] {
    try {
      // Try to extract JSON array from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Failed to parse pattern response:', error);
      // Return a fallback pattern analysis
      return [{
        pattern: "Analysis Error",
        description: "Unable to parse pattern analysis response",
        introducedAt: "Unknown",
        evolution: ["Raw response: " + response.substring(0, 200) + "..."],
        impact: "low",
        reasoning: "Please try the analysis again or check if there's actual commit history"
      }];
    }
  }

  private parseArchitecturalResponse(response: string): ArchitecturalDecision[] {
    try {
      // Try to extract JSON array from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Failed to parse architectural response:', error);
      // Return a fallback architectural decision
      return [{
        decision: "Analysis Error",
        rationale: "Unable to parse architectural analysis response",
        commit: "Unknown",
        impact: "Raw response: " + response.substring(0, 200) + "...",
        alternatives: ["Please try the analysis again", "Check if there's actual commit history to analyze"]
      }];
    }
  }
}