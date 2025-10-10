const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a ticket system message with button'),
    
    async execute(interaction) {
        // Create embed for ticket system
        const ticketEmbed = new EmbedBuilder()
            .setTitle('🎫 Ticket System')
            .setDescription('Click the button below to create a new support ticket!')
            .setColor(0x5865F2)
            .setFooter({ text: 'Night Sky Gaming Support' })
            .setTimestamp();

        // Create button
        const ticketButton = new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫');

        const row = new ActionRowBuilder()
            .addComponents(ticketButton);

        await interaction.reply({
            embeds: [ticketEmbed],
            components: [row]
        });
    },
};