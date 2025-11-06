const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { staffTicketsLogChannelName } = require('../config.json');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({
						content: 'There was an error while executing this command!',
						flags: MessageFlags.Ephemeral,
					});
				} else {
					await interaction.reply({
						content: 'There was an error while executing this command!',
						flags: MessageFlags.Ephemeral,
					});
				}
			}
		} else if (interaction.isButton()) {
			await handleButtonInteraction(interaction);
		} else if (interaction.isStringSelectMenu()) {
			await handleSelectMenuInteraction(interaction);
		} else if (interaction.isModalSubmit()) {
			await handleModalSubmit(interaction);
		}
	},
};

// Handle button interactions
async function handleButtonInteraction(interaction) {
    if (interaction.customId === 'create_ticket') {
        // Create category select menu
        const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('ticket_category')
            .setPlaceholder('Select a ticket category')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Onboarding')
                    .setDescription('Questions about getting started')
                    .setValue('onboarding')
                    .setEmoji('👋'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Moderation')
                    .setDescription('Moderation-related issues')
                    .setValue('moderation')
                    .setEmoji('🛡️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Tournaments')
                    .setDescription('Tournament-related inquiries')
                    .setValue('tournaments')
                    .setEmoji('🏆'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Events')
                    .setDescription('Event-related questions')
                    .setValue('events')
                    .setEmoji('🎉')
            );

        const row = new ActionRowBuilder().addComponents(categorySelect);

        await interaction.reply({
            content: 'Please select a category for your ticket:',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    }
}

// Handle select menu interactions
async function handleSelectMenuInteraction(interaction) {
    if (interaction.customId === 'ticket_category') {
        const selectedCategory = interaction.values[0];

        // Create modal for ticket creation
        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${selectedCategory}`)
            .setTitle(`Create ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Ticket`);

        // Create text inputs
        const subjectInput = new TextInputBuilder({
            customId: 'ticket_subject',
            label: 'Ticket Subject',
            style: TextInputStyle.Short,
            placeholder: 'Brief description of your issue...',
            required: true,
            maxLength: 100
        });

        const contentInput = new TextInputBuilder({
            customId: 'ticket_content',
            label: 'Ticket Description',
            style: TextInputStyle.Paragraph,
            placeholder: 'Please provide detailed information about your issue...',
            required: true,
            maxLength: 1000
        });

        // Create action rows for the inputs
        const subjectRow = new ActionRowBuilder().addComponents(subjectInput);
        const contentRow = new ActionRowBuilder().addComponents(contentInput);

        // Add inputs to the modal
        modal.addComponents(subjectRow, contentRow);

        // Show the modal to the user
        await interaction.showModal(modal);
    }
}

// Handle modal submissions
async function handleModalSubmit(interaction) {
    if (interaction.customId.startsWith('ticket_modal_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // Extract category from customId
            const category = interaction.customId.replace('ticket_modal_', '');
            const categoryDisplay = category.charAt(0).toUpperCase() + category.slice(1);

            // Get emoji for category
            const categoryEmojis = {
                'onboarding': '👋',
                'moderation': '🛡️',
                'tournaments': '🏆',
                'events': '🎉'
            };
            const categoryEmoji = categoryEmojis[category] || '🎫';

            // Get the values from the modal
            const subject = interaction.fields.getTextInputValue('ticket_subject');
            const content = interaction.fields.getTextInputValue('ticket_content');
            const user = interaction.user;

            // Find or create the "Tickets" category
            let ticketsCategory = interaction.guild.channels.cache.find(
                channel => channel.name.toLowerCase() === 'tickets' && channel.type === ChannelType.GuildCategory
            );

            if (!ticketsCategory) {
                ticketsCategory = await interaction.guild.channels.create({
                    name: 'Tickets',
                    type: ChannelType.GuildCategory,
                });
            }

            // Create the ticket channel
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${user.username}`,
                type: ChannelType.GuildText,
                parent: ticketsCategory.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                ],
            });

            // Create embed for the ticket channel
            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 New Support Ticket`)
                .setDescription('A new support ticket has been created!')
                .addFields(
                    { name: '👤 Created by', value: `${user}`, inline: true },
                    { name: `${categoryEmoji} Category`, value: categoryDisplay, inline: true },
                    { name: '📝 Subject', value: subject, inline: false },
                    { name: '📄 Description', value: content, inline: false }
                )
                .setColor(0x00FF00)
                .setFooter({ text: 'Night Sky Gaming Support' })
                .setTimestamp();

            // Send the embed to the ticket channel and mention the user
            await ticketChannel.send({
                content: `${user} Your ticket has been created!`,
                embeds: [ticketEmbed]
            });

            // Log ticket creation to staff-tickets channel
            const staffTicketsLogChannel = interaction.guild.channels.cache.find(
                channel => channel.name === staffTicketsLogChannelName && channel.type === ChannelType.GuildText
            );

            if (staffTicketsLogChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📋 New Ticket Created')
                    .setDescription(`A new ticket has been created by ${user}`)
                    .addFields(
                        { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: `${categoryEmoji} Category`, value: categoryDisplay, inline: true },
                        { name: '📝 Subject', value: subject, inline: false },
                        { name: '🔗 Channel', value: `${ticketChannel}`, inline: false }
                    )
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Ticket System Log' })
                    .setTimestamp();

                await staffTicketsLogChannel.send({ embeds: [logEmbed] });
            } else {
                console.warn(`[WARNING] Channel "${staffTicketsLogChannelName}" not found for logging`);
            }

            // Confirm ticket creation to the user
            await interaction.editReply({
                content: `✅ Your ticket has been created! Please check ${ticketChannel} for more information.`
            });

        } catch (error) {
            console.error('Error creating ticket:', error);
            await interaction.editReply({
                content: '❌ There was an error creating your ticket. Please try again later.'
            });
        }
    }
}