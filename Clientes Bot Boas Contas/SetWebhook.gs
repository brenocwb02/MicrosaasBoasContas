// --- SCRIPT DE CONFIGURAÇÃO (EXECUTAR APENAS UMA VEZ) ---

// 1. SUBSTITUA pelo token que obteve do BotFather
const BOT_TOKEN = "7355401077:AAEHoBfMNKK6ikDXS9HML7KZHzFK3F7Shzw";

// 2. SUBSTITUA pelo URL do seu Web App implementado
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzTRAqv5gT1oCXNHfhjLmpMQgn1pt9YxbPc7QD7m0WnoJifGVmxzQfXnzTBuCyPJKYULA/exec";

/**
 * Esta função regista o URL do seu Web App no Telegram.
 * Execute-a manualmente UMA VEZ após implementar o Web App.
 */
function setWebhook() {
  // Armazena o token para ser usado pelo bot
  PropertiesService.getScriptProperties().setProperty('BOT_TOKEN', BOT_TOKEN);

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEB_APP_URL}`;
  const response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

/**
 * (Opcional) Use esta função para apagar o webhook se precisar de reconfigurar.
 */
function deleteWebhook() {
  const botToken = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (!botToken) {
    Logger.log("Token não encontrado para apagar.");
    return;
  }
  const url = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
  const response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}
