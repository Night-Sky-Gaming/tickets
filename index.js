const { Client, GatewayIntentBits, Events, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const config = require('./config.json');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ],
});

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Slash command data
const commands = [
    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a ticket system message with button'),
];

// Register slash commands
client.once(Events.ClientReady, async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        
        // Register commands globally (can take up to 1 hour to update)
        // For faster testing, you can use guild-specific commands instead
        await client.application.commands.set(commands);
        
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Handle interactions
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
    }
});

// Handle slash commands
async function handleSlashCommand(interaction) {
    if (interaction.commandName === 'ticket') {
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
    }
}

// Handle button interactions
async function handleButtonInteraction(interaction) {
    if (interaction.customId === 'create_ticket') {
        // Create modal for ticket creation
        const modal = new ModalBuilder()
            .setCustomId('ticket_modal')
            .setTitle('Create Support Ticket');

        // Create text inputs
        const subjectInput = new TextInputBuilder()
            .setCustomId('ticket_subject')
            .setLabel('Ticket Subject')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Brief description of your issue...')
            .setRequired(true)
            .setMaxLength(100);

        const contentInput = new TextInputBuilder()
            .setCustomId('ticket_content')
            .setLabel('Ticket Description')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Please provide detailed information about your issue...')
            .setRequired(true)
            .setMaxLength(1000);

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

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

// Login to Discord with your client's token
client.login(config.token);