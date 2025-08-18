const https = require("https");
const logger = require("../config/logger");

function formatVersionDate() {
  const d = new Date(Date.now());
  return `v${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}${
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0") +
    String(d.getSeconds()).padStart(2, "0") +
    String(d.getMilliseconds()).padStart(3, "0")
  }`;
}

class DiscordNotifier {
  constructor(webhookUrl = null) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL;
  }

  async sendOrderNotification(
    productInfo,
    status = "Purchased"
  ) {
    if (!this.webhookUrl) {
      logger.warn("Discord webhook URL not configured, skipping notification");
      return false;
    }

    try {
      const embed = this.createOrderEmbed(
        productInfo,
        status
      );
      const payload = {
        username: "SCG BOT",
        embeds: [embed],
      };

      await this.sendWebhook(payload);
      logger.info("Discord notification sent successfully");
      return true;
    } catch (error) {
      logger.error("Failed to send Discord notification:", error);
      return false;
    }
  }

  createOrderEmbed(productInfo, status) {
    const timestamp = new Date().toISOString();
    const isSuccess = status.toLowerCase().includes('purchased');

    const embed = {
      title: isSuccess ? 'SCG Success' : 'Order Failed',
      description: productInfo.url || 'Product URL not available',
      color: isSuccess ? 0x00ff00 : 0xff0000,
      fields: [
        {
          name: 'Product',
          value: productInfo.productId || productInfo.name || 'Unknown Product',
          inline: false,
        },
      ],
      footer: {
        text: `SCG BOT ${formatVersionDate()}`,
        icon_url: process.env.BOT_ICON_URL,
      },
      timestamp,
    };

    if (productInfo.price && isSuccess) {
      embed.fields.splice(1, 0, {
        name: 'Price',
        value: productInfo.price,
        inline: false,
      });
    }

    if (productInfo.quantity) {
      embed.fields.push({
        name: 'Quantity',
        value: productInfo.quantity.toString(),
        inline: true,
      });
    }

    if (productInfo.mode) {
      embed.fields.push({
        name: 'Mode',
        value: productInfo.mode,
        inline: true,
      });
    }

    if (productInfo.image) {
      embed.thumbnail = {
        url: productInfo.image,
      };
    }

    return embed;
  }

  async sendWebhook(payload) {
    return new Promise((resolve, reject) => {
      try {
        const data = JSON.stringify(payload);
        logger.debug('Sending webhook payload:', data);
        const url = new URL(this.webhookUrl);

        const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Content-Length": data.length,
          'User-Agent': 'Auto-Buy-Bot/1.0',
        },
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            reject(
              new Error(
                `Discord webhook failed with status ${res.statusCode}: ${responseData}`
              )
            );
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
      } catch (error) {
        logger.error('Error preparing webhook request:', error);
        reject(error);
      }
    });
  }
}

module.exports = DiscordNotifier;
