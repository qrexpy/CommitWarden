import { WebhookClient, EmbedBuilder } from 'discord.js';
import { createHmac } from 'crypto';
import { Request, Response } from 'express';

const webhookClient = new WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL! });

export function verifyWebhook(req: Request, res: Response, next: Function) {
  const signature = req.headers['x-hub-signature-256'] as string;
  const payload = JSON.stringify(req.body);
  
  if (!signature) {
    return res.status(401).send('No signature provided');
  }

  const hmac = createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;

  if (signature !== digest) {
    return res.status(401).send('Invalid signature');
  }

  next();
}

export async function handleWebhook(req: Request, res: Response) {
  const event = req.headers['x-github-event'] as string;
  const payload = req.body;

  try {
    switch (event) {
      case 'push':
        await handlePushEvent(payload);
        break;
      case 'pull_request':
        await handlePullRequestEvent(payload);
        break;
      case 'issues':
        await handleIssuesEvent(payload);
        break;
      case 'workflow_run':
        await handleWorkflowRunEvent(payload);
        break;
      default:
        console.log(`Unhandled event: ${event}`);
    }

    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
}

async function handlePushEvent(payload: any) {
  const embed = new EmbedBuilder()
    .setTitle('New Push')
    .setDescription(`[${payload.repository.full_name}](${payload.repository.html_url})`)
    .setColor('#2EA043')
    .addFields(
      { name: 'Branch', value: payload.ref.split('/').pop()!, inline: true },
      { name: 'Commits', value: payload.commits.length.toString(), inline: true },
      { name: 'Pusher', value: payload.pusher.name, inline: true }
    );

  await webhookClient.send({ embeds: [embed] });
}

async function handlePullRequestEvent(payload: any) {
  const action = payload.action;
  const pr = payload.pull_request;

  const embed = new EmbedBuilder()
    .setTitle(`Pull Request ${action.charAt(0).toUpperCase() + action.slice(1)}`)
    .setDescription(`[${pr.title}](${pr.html_url})`)
    .setColor(getPRColor(action))
    .addFields(
      { name: 'Repository', value: payload.repository.full_name, inline: true },
      { name: 'Author', value: pr.user.login, inline: true },
      { name: 'State', value: pr.state, inline: true }
    );

  await webhookClient.send({ embeds: [embed] });
}

async function handleIssuesEvent(payload: any) {
  const action = payload.action;
  const issue = payload.issue;

  const embed = new EmbedBuilder()
    .setTitle(`Issue ${action.charAt(0).toUpperCase() + action.slice(1)}`)
    .setDescription(`[${issue.title}](${issue.html_url})`)
    .setColor(getIssueColor(action))
    .addFields(
      { name: 'Repository', value: payload.repository.full_name, inline: true },
      { name: 'Author', value: issue.user.login, inline: true },
      { name: 'State', value: issue.state, inline: true }
    );

  await webhookClient.send({ embeds: [embed] });
}

async function handleWorkflowRunEvent(payload: any) {
  const workflow = payload.workflow_run;

  const embed = new EmbedBuilder()
    .setTitle(`Workflow ${workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}`)
    .setDescription(`[${workflow.name}](${workflow.html_url})`)
    .setColor(getWorkflowColor(workflow.status))
    .addFields(
      { name: 'Repository', value: payload.repository.full_name, inline: true },
      { name: 'Branch', value: workflow.head_branch, inline: true },
      { name: 'Triggered by', value: workflow.actor.login, inline: true }
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