# CommitWarden

A Discord bot that helps manage GitHub workflows, pull requests, and repository activities directly from Discord.

## Features

- List and check pull requests
- View repository statistics
- Manage GitHub workflows
- Real-time notifications for repository events
- Interactive command interface

## Prerequisites

- Node.js 18.x or higher
- A Discord bot token
- A GitHub personal access token
- A Discord server where you have administrator permissions
- A Discord webhook URL for notifications

## Local Development Setup

1. Clone this repository:
```bash
git clone https://github.com/yourusername/github-workflow-bot.git
cd github-workflow-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_discord_guild_id
DISCORD_WEBHOOK_URL=your_discord_webhook_url
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
PORT=3000
```

4. Build the project:
```bash
npm run build
```

5. Start the bot:
```bash
npm start
```

## Deploying to Vercel

1. Install the Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy the project:
```bash
vercel
```

4. Set up the environment variables in the Vercel dashboard:
   - Go to your project settings
   - Add the environment variables from your `.env` file

5. For production deployment:
```bash
vercel --prod
```

## Webhook Configuration

After deploying to Vercel, your webhook URL will be:
```
https://your-vercel-project.vercel.app/api/webhook/github
```

Set this as the payload URL in your GitHub repository webhooks settings:
1. Go to your GitHub repository
2. Click on "Settings" > "Webhooks" > "Add webhook"
3. Set the Payload URL to your Vercel deployment URL + `/api/webhook/github`
4. Set Content type to `application/json`
5. Set Secret to your `GITHUB_WEBHOOK_SECRET`
6. Select the events you want to trigger notifications for
7. Click "Add webhook"

## Available Commands

### Pull Request Management
- `/pr list [repo]` - List all open pull requests in a repository
- `/pr check [repo] [number]` - View details of a specific pull request

### Repository Information
- `/repo [repository]` - View repository statistics and information

### Workflow Management
- `/workflow list [repo]` - List available workflows in a repository
- `/workflow run [repo] [workflow]` - Trigger a specific workflow

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 