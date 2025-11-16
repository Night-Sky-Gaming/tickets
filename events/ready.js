const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { staffTicketChannelName } = require('../config.json');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		
		// Send ticket message to staff-ticket channel on startup
		try {
			// Loop through all guilds the bot is in
			for (const guild of client.guilds.cache.values()) {
				// Find the staff-ticket channel
				const staffTicketChannel = guild.channels.cache.find(
					channel => channel.name === staffTicketChannelName && channel.type === ChannelType.GuildText
				);

				if (!staffTicketChannel) {
					console.warn(`[WARNING] Channel "${staffTicketChannelName}" not found in guild: ${guild.name}`);
					continue;
				}

				// Create embed for ticket system
				const ticketEmbed = new EmbedBuilder()
					.setTitle('🎫 Ticket System')
					.setDescription('Click the button below to create a new support ticket!')
					.setColor(0x5865F2)
					.setFooter({ text: 'Andromeda Gaming Support' })
					.setTimestamp();

				// Create button
				const ticketButton = new ButtonBuilder()
					.setCustomId('create_ticket')
					.setLabel('Create Ticket')
					.setStyle(ButtonStyle.Primary)
					.setEmoji('🎫');

				const row = new ActionRowBuilder()
					.addComponents(ticketButton);

				// Send the message
				await staffTicketChannel.send({
					embeds: [ticketEmbed],
					components: [row]
				});

				console.log(`✅ Ticket system message sent to #${staffTicketChannelName} in ${guild.name}`);
			}
		} catch (error) {
			console.error('Error sending ticket message on startup:', error);
		}
	},
};