import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Octokit } from '@octokit/rest';
import { Command } from '../types/discord';

export const data = new SlashCommandBuilder()
  .setName('workflow')
  .setDescription('Manage GitHub Actions workflows')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List available workflows')
      .addStringOption(option =>
        option
          .setName('repo')
          .setDescription('Repository name (owner/repo)')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('run')
      .setDescription('Run a specific workflow')
      .addStringOption(option =>
        option
          .setName('repo')
          .setDescription('Repository name (owner/repo)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('workflow')
          .setDescription('Workflow file name or ID')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const subcommand = interaction.options.getSubcommand();
  const repo = interaction.options.getString('repo')!;
  const [owner, repository] = repo.split('/');

  if (subcommand === 'list') {
    try {
      const { data: workflows } = await octokit.actions.listRepoWorkflows({
        owner,
        repo: repository,
      });

      if (workflows.total_count === 0) {
        await interaction.reply('No workflows found in this repository.');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Available Workflows in ${repo}`)
        .setColor('#2EA043');

      workflows.workflows.forEach(workflow => {
        embed.addFields({
          name: workflow.name,
          value: `ID: ${workflow.id}\nPath: ${workflow.path}\nState: ${workflow.state}`,
        });
      });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply('Error fetching workflows.');
    }
  } else if (subcommand === 'run') {
    const workflow = interaction.options.getString('workflow')!;

    try {
      await octokit.actions.createWorkflowDispatch({
        owner,
        repo: repository,
        workflow_id: workflow,
        ref: 'main', // You might want to make this configurable
      });

      const embed = new EmbedBuilder()
        .setTitle('Workflow Triggered')
        .setDescription(`Successfully triggered workflow: ${workflow}`)
        .setColor('#2EA043')
        .addFields(
          { name: 'Repository', value: repo, inline: true },
          { name: 'Status', value: 'Queued', inline: true }
        );

      const viewButton = new ButtonBuilder()
        .setLabel('View Workflow')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://github.com/${repo}/actions`);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(viewButton);

      await interaction.reply({ 
        embeds: [embed],
        components: [row],
      });
    } catch (error) {
      console.error(error);
      await interaction.reply('Error triggering workflow.');
    }
  }
} 