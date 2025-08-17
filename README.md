# Codebase Time Machine

Navigate any codebase through time, understanding evolution of features and architectural decisions.

## Features

- **Git History Analysis**: Deep analysis of commit history, file changes, and contributor patterns
- **Semantic Understanding**: AI-powered analysis of code evolution using Claude
- **Pattern Recognition**: Identify architectural patterns and design decisions over time
- **Interactive Queries**: Ask questions about code evolution and get intelligent answers
- **Visual Dashboard**: See repository stats, commit history, and analysis results
- **Time Travel**: Navigate through different states of the codebase

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, SQLite database
- **AI Integration**: Anthropic Claude API for semantic analysis
- **Git Analysis**: simple-git for repository parsing
- **Database**: SQLite with custom schema for commit and analysis data

## Setup Instructions

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Anthropic Claude API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd codebase-time-machine
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy the `.env.local` file and add your Anthropic API key:
   ```bash
   cp .env.local .env.local.example
   ```
   
   Edit `.env.local`:
   ```env
   # Required: Your Anthropic Claude API key
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   
   # Optional: GitHub token for higher rate limits (recommended for production)
   GITHUB_TOKEN=your_github_personal_access_token
   
   # Optional: Database configuration
   DATABASE_URL=./codebase_time_machine.db
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=100000000
   NODE_ENV=development
   ```

4. **Get your Anthropic API key**
   - Sign up at [console.anthropic.com](https://console.anthropic.com/)
   - Create a new API key
   - Add it to your `.env.local` file

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### 1. Upload a Repository

- **Option A**: Upload a ZIP file containing a git repository
- **Option B**: Provide a GitHub URL (for public repositories)

The system will:
- Extract and analyze the git history
- Identify programming languages and contributors
- Build a database of commits and file changes
- Start background analysis of patterns and architecture

### 2. Explore the Dashboard

View repository statistics including:
- Total commits and contributors
- Programming languages used
- Recent commit history
- File change patterns

### 3. Analyze Patterns and Architecture

Use the analysis features to:
- **Patterns**: Identify when design patterns were introduced
- **Architecture**: Discover major architectural decisions
- View the reasoning behind code changes

### 4. Ask Questions

Use natural language to query the codebase:
- "Why was this pattern introduced?"
- "Show me how authentication evolved"
- "What architectural decisions were made in 2023?"
- "Who worked on the payment system?"

## API Endpoints

- `POST /api/upload` - Upload and analyze repository
- `GET /api/repositories` - Get repository information
- `GET /api/commits` - Get commit history
- `POST /api/analyze` - Analyze code evolution with custom queries
- `POST /api/patterns` - Analyze design patterns
- `POST /api/architecture` - Analyze architectural decisions

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Routes    │    │   Analysis      │
│   (React/Next)  │◄──►│   (Next.js)     │◄──►│   (Claude AI)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Git Analyzer  │◄──►│   Database      │
                       │   (simple-git)  │    │   (SQLite)      │
                       └─────────────────┘    └─────────────────┘
```

## Database Schema

- **repositories**: Repository metadata and analysis status
- **commits**: Individual commit information and statistics
- **file_changes**: File-level changes for each commit
- **analysis**: AI-generated insights and pattern analysis

## Development

### Build for production
```bash
npm run build
```

### Run tests
```bash
npm run test
```

### Lint code
```bash
npm run lint
```

## Deployment

This application is designed to be deployed on Vercel:

1. **Environment Variables**: Set these in Vercel's environment settings:
   - `ANTHROPIC_API_KEY` (required)
   - `GITHUB_TOKEN` (optional, for higher GitHub API rate limits)
2. **Database**: SQLite files will be stored in `/tmp` on Vercel (ephemeral)
3. **File Uploads**: Handled in `/tmp` directory
4. **Repository Fetching**: Uses GitHub API instead of git clone in serverless environments

For persistent storage in production, consider:
- PostgreSQL for database
- S3/Vercel Blob for file storage
- Background job processing for large repositories

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the GitHub Issues
- Review the API documentation
- Ensure your Anthropic API key is valid and has sufficient credits
