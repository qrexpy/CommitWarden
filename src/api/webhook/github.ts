import { VercelRequest, VercelResponse } from '@vercel/node';
import { WebhookClient, EmbedBuilder } from 'discord.js';
import { createHmac } from 'crypto';
import { Octokit } from '@octokit/rest';

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Create Discord webhook client for sending notifications
const webhookClient = process.env.DISCORD_WEBHOOK_URL 
  ? new WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL })
  : null;

// Verify GitHub webhook signature
function verifySignature(payload: string, signature: string): boolean {
  if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) {
    return false;
  }

  const hmac = createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return signature === digest;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get signature from headers
  const signature = req.headers['x-hub-signature-256'] as string;
  const event = req.headers['x-github-event'] as string;
  
  // Verify webhook signature
  const rawBody = JSON.stringify(req.body);
  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process the webhook based on event type
  try {
    const payload = req.body;
    
    // Make sure we have a webhook client
    if (!webhookClient) {
      console.warn('No webhook client available, skipping notification.');
      return res.status(202).json({ message: 'Webhook received but notifications are disabled' });
    }

    switch (event) {
      case 'push':
        await handlePushEvent(payload, webhookClient);
        break;
      case 'pull_request':
        await handlePullRequestEvent(payload, webhookClient);
        break;
      case 'issues':
        await handleIssuesEvent(payload, webhookClient);
        break;
      case 'workflow_run':
        await handleWorkflowRunEvent(payload, webhookClient);
        break;
      default:
        console.log(`Unhandled event: ${event}`);
    }

    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Error processing webhook' });
  }
};

async function handlePushEvent(payload: any, webhookClient: WebhookClient) {
  const embed = new EmbedBuilder()
    .setTitle('New Push')
    .setDescription(`[${payload.repository.full_name}](${payload.repository.html_url})`)
    .setColor('#2EA043')
    .addFields(
      { name: 'Branch', value: payload.ref.split('/').pop() || 'unknown', inline: true },
      { name: 'Commits', value: payload.commits?.length.toString() || '0', inline: true },
      { name: 'Pusher', value: payload.pusher?.name || 'unknown', inline: true }
    );

  await webhookClient.send({ embeds: [embed] });
}

async function handlePullRequestEvent(payload: any, webhookClient: WebhookClient) {
  const action = payload.action;
  const pr = payload.pull_request;

  if (!pr) return;

  const embed = new EmbedBuilder()
    .setTitle(`Pull Request ${action.charAt(0).toUpperCase() + action.slice(1)}`)
    .setDescription(`[${pr.title}](${pr.html_url})`)
    .setColor(getPRColor(action))
    .addFields(
      { name: 'Repository', value: payload.repository.full_name, inline: true },
      { name: 'Author', value: pr.user?.login || 'unknown', inline: true },
      { name: 'State', value: pr.state || 'unknown', inline: true }
    );

  await webhookClient.send({ embeds: [embed] });
}

async function handleIssuesEvent(payload: any, webhookClient: WebhookClient) {
  const action = payload.action;
  const issue = payload.issue;

  if (!issue) return;

  const embed = new EmbedBuilder()
    .setTitle(`Issue ${action.charAt(0).toUpperCase() + action.slice(1)}`)
    .setDescription(`[${issue.title}](${issue.html_url})`)
    .setColor(getIssueColor(action))
    .addFields(
      { name: 'Repository', value: payload.repository.full_name, inline: true },
      { name: 'Author', value: issue.user?.login || 'unknown', inline: true },
      { name: 'State', value: issue.state || 'unknown', inline: true }
    );

  await webhookClient.send({ embeds: [embed] });
}

async function handleWorkflowRunEvent(payload: any, webhookClient: WebhookClient) {
  const workflow = payload.workflow_run;

  if (!workflow) return;

  const embed = new EmbedBuilder()
    .setTitle(`Workflow ${workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}`)
    .setDescription(`[${workflow.name}](${workflow.html_url})`)
    .setColor(getWorkflowColor(workflow.status))
    .addFields(
      { name: 'Repository', value: payload.repository.full_name, inline: true },
      { name: 'Branch', value: workflow.head_branch || 'unknown', inline: true },
      { name: 'Triggered by', value: workflow.actor?.login || 'unknown', inline: true }
    );

  await webhookClient.send({ embeds: [embed] });
}

function getPRColor(action: string): number {
  switch (action) {
    case 'opened':
      return 0x2EA043;
    case 'closed':
      return 0xCB2431;
    case 'merged':
      return 0x6F42C1;
    default:
      return 0x5865F2;
  }
}

function getIssueColor(action: string): number {
  switch (action) {
    case 'opened':
      return 0x2EA043;
    case 'closed':
      return 0xCB2431;
    case 'reopened':
      return 0xF1E05A;
    default:
      return 0x5865F2;
  }
}

function getWorkflowColor(status: string): number {
  switch (status) {
    case 'completed':
      return 0x2EA043;
    case 'in_progress':
      return 0xF1E05A;
    case 'failed':
      return 0xCB2431;
    default:
      return 0x5865F2;
  }
} 