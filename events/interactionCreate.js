const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');

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
		} else if (interaction.isModalSubmit()) {
			await handleModalSubmit(interaction);
		}
	},
};

// Handle button interactions
async function handleButtonInteraction(interaction) {
    if (interaction.customId === 'create_ticket') {
        // Create modal for ticket creation
        const modal = new ModalBuilder()
            .setCustomId('ticket_modal')
            .setTitle('Create Support Ticket');

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
    if (interaction.customId === 'ticket_modal') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
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
                .setTitle('🎫 New Support Ticket')
                .setDescription('A new support ticket has been created!')
                .addFields(
                    { name: '👤 Created by', value: `${user}`, inline: true },
                    { name: '📝 Subject', value: subject, inline: true },
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