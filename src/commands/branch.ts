import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Octokit } from '@octokit/rest';
import { Command } from '../types/discord';

export const data = new SlashCommandBuilder()
  .setName('branch')
  .setDescription('Manage GitHub repository branches')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List branches in a repository')
      .addStringOption(option =>
        option
          .setName('repository')
          .setDescription('Repository name (owner/repo)')
          .setRequired(true)
      )
      .addBooleanOption(option =>
        option
          .setName('protected')
          .setDescription('Show only protected branches')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new branch in a repository')
      .addStringOption(option =>
        option
          .setName('repository')
          .setDescription('Repository name (owner/repo)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Name for the new branch')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('from')
          .setDescription('Base branch to create from (default: repository default branch)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a branch from a repository')
      .addStringOption(option =>
        option
          .setName('repository')
          .setDescription('Repository name (owner/repo)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Name of the branch to delete')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const subcommand = interaction.options.getSubcommand();
  const repo = interaction.options.getString('repository')!;
  const [owner, repository] = repo.split('/');
  
  if (!owner || !repository) {
    return await interaction.reply({
      content: 'Please provide a valid repository name in the format `owner/repo`',
      ephemeral: true
    });
  }

  // Create a deferred reply since GitHub API interactions can be slow
  await interaction.deferReply();

  try {
    // Check if repository exists
    try {
      await octokit.repos.get({
        owner,
        repo: repository
      });
    } catch (error) {
      return await interaction.editReply(`Repository ${repo} not found. Make sure you have the correct name.`);
    }

    if (subcommand === 'list') {
      await listBranches(interaction, octokit, owner, repository);
    } else if (subcommand === 'create') {
      await createBranch(interaction, octokit, owner, repository);
    } else if (subcommand === 'delete') {
      await deleteBranch(interaction, octokit, owner, repository);
    }
  } catch (error) {
    console.error(`Error in branch ${subcommand} command:`, error);
    await interaction.editReply('Error processing your request. Make sure your GitHub token has the necessary permissions.');
  }
}

async function listBranches(interaction: ChatInputCommandInteraction, octokit: Octokit, owner: string, repository: string) {
  const protectedOnly = interaction.options.getBoolean('protected') || false;
  
  // Get repository information to know the default branch
  const { data: repoData } = await octokit.repos.get({
    owner,
    repo: repository
  });
  
  // Get list of branches
  const { data: branches } = await octokit.repos.listBranches({
    owner,
    repo: repository,
    per_page: 100
  });
  
  if (branches.length === 0) {
    return await interaction.editReply(`No branches found in repository ${owner}/${repository}.`);
  }
  
  // Filter for protected branches if requested
  const filteredBranches = protectedOnly ? branches.filter(branch => branch.protected) : branches;
  
  if (filteredBranches.length === 0) {
    return await interaction.editReply(`No protected branches found in repository ${owner}/${repository}.`);
  }
  
  // Create embed for branches
  const embed = new EmbedBuilder()
    .setTitle(`Branches in ${owner}/${repository}`)
    .setDescription(`Total branches: ${branches.length}${protectedOnly ? ` (showing ${filteredBranches.length} protected)` : ''}`)
    .setColor('#0366d6')
    .setURL(`https://github.com/${owner}/${repository}/branches`)
    .setTimestamp();
  
  // Group branches for better display
  const defaultBranch = branches.find(branch => branch.name === repoData.default_branch);
  const otherBranches = branches.filter(branch => branch.name !== repoData.default_branch);
  
  // Add default branch first if it exists
  if (defaultBranch && (!protectedOnly || defaultBranch.protected)) {
    embed.addFields({
      name: `Default: ${defaultBranch.name}${defaultBranch.protected ? ' 🔒' : ''}`,
      value: `[View](https://github.com/${owner}/${repository}/tree/${defaultBranch.name})`
    });
  }
  
  // Add other branches
  const branchesPerField = 10;
  const otherFilteredBranches = protectedOnly ? otherBranches.filter(branch => branch.protected) : otherBranches;
  
  for (let i = 0; i < otherFilteredBranches.length; i += branchesPerField) {
    const branchChunk = otherFilteredBranches.slice(i, i + branchesPerField);
    const branchText = branchChunk.map(branch => 
      `${branch.name}${branch.protected ? ' 🔒' : ''} - [View](https://github.com/${owner}/${repository}/tree/${branch.name})`
    ).join('\n');
    
    if (branchText) {
      embed.addFields({
        name: i === 0 ? 'Other Branches' : '\u200B', // Empty character for multiple field titles
        value: branchText
      });
    }
  }
  
  // Add button to view all branches on GitHub
  const viewButton = new ButtonBuilder()
    .setLabel('View All Branches on GitHub')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://github.com/${owner}/${repository}/branches`);
    
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(viewButton);
    
  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

async function createBranch(interaction: ChatInputCommandInteraction, octokit: Octokit, owner: string, repository: string) {
  const branchName = interaction.options.getString('name')!;
  let fromBranch = interaction.options.getString('from');
  
  // Get the repository's default branch if fromBranch is not specified
  if (!fromBranch) {
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo: repository
    });
    fromBranch = repoData.default_branch;
  }
  
  try {
    // Get the SHA of the latest commit on the source branch
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo: repository,
      ref: `heads/${fromBranch}`
    });
    
    const sha = ref.object.sha;
    
    // Create a new branch
    await octokit.git.createRef({
      owner,
      repo: repository,
      ref: `refs/heads/${branchName}`,
      sha: sha
    });
    
    const embed = new EmbedBuilder()
      .setTitle('Branch Created')
      .setDescription(`Successfully created branch \`${branchName}\` from \`${fromBranch}\``)
      .setColor('#2EA043')
      .addFields(
        { name: 'Repository', value: `${owner}/${repository}`, inline: true },
        { name: 'Branch', value: branchName, inline: true },
        { name: 'Base', value: fromBranch, inline: true }
      )
      .setURL(`https://github.com/${owner}/${repository}/tree/${branchName}`)
      .setTimestamp();
      
    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    if (error.status === 422) {
      await interaction.editReply(`Branch \`${branchName}\` already exists in repository ${owner}/${repository}.`);
    } else {
      console.error('Error creating branch:', error);
      await interaction.editReply(`Error creating branch: ${error.message || 'Unknown error'}`);
    }
  }
}

async function deleteBranch(interaction: ChatInputCommandInteraction, octokit: Octokit, owner: string, repository: string) {
  const branchName = interaction.options.getString('name')!;
  
  try {
    // Check if the branch exists
    try {
      await octokit.git.getRef({
        owner,
        repo: repository,
        ref: `heads/${branchName}`
      });
    } catch (error: any) {
      if (error.status === 404) {
        return await interaction.editReply(`Branch \`${branchName}\` not found in repository ${owner}/${repository}.`);
      }
      throw error;
    }
    
    // Check if it's the default branch
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo: repository
    });
    
    if (branchName === repoData.default_branch) {
      return await interaction.editReply(`Cannot delete the default branch \`${branchName}\`. Please change the default branch first.`);
    }
    
    // Delete the branch
    await octokit.git.deleteRef({
      owner,
      repo: repository,
      ref: `heads/${branchName}`
    });
    
    const embed = new EmbedBuilder()
      .setTitle('Branch Deleted')
      .setDescription(`Successfully deleted branch \`${branchName}\``)
      .setColor('#CB2431')
      .addFields(
        { name: 'Repository', value: `${owner}/${repository}`, inline: true }
      )
      .setURL(`https://github.com/${owner}/${repository}/branches`)
      .setTimestamp();
      
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error deleting branch:', error);
    await interaction.editReply('Error deleting branch. Make sure your GitHub token has the necessary permissions.');
  }
} 