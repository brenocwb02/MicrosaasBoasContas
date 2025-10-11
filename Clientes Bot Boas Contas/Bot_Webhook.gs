// --- CONFIGURAÇÕES GLOBAIS ---
const CLIENT_SHEET_NAME = "Clientes";

// --- FUNÇÕES DE CONFIGURAÇÃO ---
function salvarConfiguracoes() {
  PropertiesService.getScriptProperties().setProperties({
    'CLIENT_DB_SHEET_ID': '1glaA2xjPxrKtChFbRD_o82W84oPAuZ1-v5r2e8RteAg',
  });
  Logger.log("Configurações salvas com sucesso!");
}

function forcarPedidoDePermissao() {
  try {
    const dbSheetId = PropertiesService.getScriptProperties().getProperty('CLIENT_DB_SHEET_ID');
    if (!dbSheetId) throw new Error("CLIENT_DB_SHEET_ID não está configurado.");
    SpreadsheetApp.openById(dbSheetId);
    Logger.log("Permissão concedida com sucesso!");
  } catch (e) {
    Logger.log("Erro ao pedir permissão: " + e.message);
  }
}

// --- ENDPOINTS PRINCIPAIS DO WEB APP ---
function doGet(e) {
  try {
    const params = e.parameter;
    const action = params.action || 'default';

    switch(action) {
      case 'activateLicense': return handleActivateLicense(params);
      case 'registerTelegram': return handleRegisterTelegram(params);
      case 'enviarNotificacao': return handleSendNotification(params);
      case 'test': return createJsonResponse({ status: 'success', message: 'Servidor Bot está online!' });
      default: throw new Error("Ação GET desconhecida.");
    }
  } catch (err) {
    Logger.log("Erro no doGet: " + err.stack);
    return createJsonResponse({ status: 'error', message: "Erro no servidor: " + err.message });
  }
}

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    
    // ATUALIZADO: Verifica primeiro por 'callback_query' (clique em botão)
    if (contents.callback_query) {
      processCallbackQuery(contents.callback_query);
    } else if (contents.message && contents.message.text) {
      processTextMessage(contents.message);
    }
  } catch (err) {
    Logger.log("Erro no doPost: " + err.stack);
  }
}

// --- LÓGICA DE GESTÃO DE LICENÇAS ---
// Nenhuma alteração necessária aqui
function handleActivateLicense(params) {
  const { licenseKey, sheetId } = params;
  if (!licenseKey || !sheetId) throw new Error("Chave de licença ou ID da planilha em falta.");
  const dbSheet = getDbSheet();
  const { rowData, rowIndex, headers } = findLicenseByKey(dbSheet, licenseKey);
  if (!rowData) {
    return createJsonResponse({ status: 'error', message: 'Chave de licença inválida.' });
  }
  const idxStatus = headers.indexOf('Status');
  const idxSheetId = headers.indexOf('ID_Folha_Calculo');
  if (rowData[idxStatus] !== 'Pendente') {
    return createJsonResponse({ status: 'error', message: 'Esta licença já foi ativada ou está inválida.' });
  }
  dbSheet.getRange(rowIndex, idxSheetId + 1).setValue(sheetId);
  dbSheet.getRange(rowIndex, idxStatus + 1).setValue('Ativa');
  return createJsonResponse({ status: 'success', message: 'Produto ativado com sucesso! Por favor, recarregue a página da planilha.' });
}

function handleRegisterTelegram(params) {
    const { licenseKey, chatId, clientName } = params;
    if (!licenseKey || !chatId || !clientName) throw new Error("Dados em falta para o registo do Telegram.");
    const dbSheet = getDbSheet();
    const { rowData, rowIndex, headers } = findLicenseByKey(dbSheet, licenseKey);
    if (!rowData) {
        return createJsonResponse({ status: 'error', message: 'Chave de licença inválida.' });
    }
    const idxStatus = headers.indexOf('Status');
    if (rowData[idxStatus] !== 'Ativa') {
        return createJsonResponse({ status: 'error', message: 'A sua licença precisa de ser ativada na planilha primeiro.' });
    }
    dbSheet.getRange(rowIndex, headers.indexOf('ID_Chat_Telegram') + 1).setValue(chatId);
    dbSheet.getRange(rowIndex, headers.indexOf('Nome_Cliente') + 1).setValue(clientName);
    CacheService.getScriptCache().remove(`SHEET_ID_${chatId}`);
    return createJsonResponse({ status: 'success', message: 'Telegram configurado com sucesso!' });
}


// --- LÓGICA DO BOT DO TELEGRAM (ATUALIZADA) ---

function processCallbackQuery(callback_query) {
    const callbackData = callback_query.data;
    const chatId = callback_query.message.chat.id;
    answerCallbackQuery(callback_query.id); // Responde ao Telegram para o botão parar de carregar

    const sheetId = getClientSheetIdByChatId(chatId);
    if (!sheetId) return;

    // NOVO: Chama a função da biblioteca para continuar o assistente
    if (callbackData.startsWith('assist_')) {
        const resultado = BibliotecaBoasContas.continuarAssistente(sheetId, chatId, callbackData);
        enviarResposta(chatId, resultado);
    }
}

function processPaymentWebhook(data) {
    const dbSheet = getDbSheet();
    const { email, name, plan, transaction_id } = data.customer_info; 
    
    const licenseKey = `BC-${Utilities.getUuid().substring(0, 4).toUpperCase()}-${Utilities.getUuid().substring(0, 4).toUpperCase()}`;
    const creationDate = new Date();
    let expirationDate = new Date();

    if (plan === 'Anual') {
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    } else if (plan === 'Mensal') {
        expirationDate.setMonth(expirationDate.getMonth() + 1);
    } else { 
        expirationDate.setFullYear(expirationDate.getFullYear() + 99);
    }
    
    dbSheet.appendRow([
        licenseKey, email, name, '', '', plan, creationDate, expirationDate, 'Pendente', transaction_id
    ]);

    MailApp.sendEmail(email, "Bem-vindo ao Boas Contas!", `Obrigado por comprar! A sua chave de licença é: ${licenseKey}`);
}

// --- LÓGICA DO BOT DO TELEGRAM ---

function processCallbackQuery(callback_query) {
    const callbackData = callback_query.data;
    const chatId = callback_query.message.chat.id;
    answerCallbackQuery(callback_query.id);

    const sheetId = getClientSheetIdByChatId(chatId);
    if (!sheetId) return;

    // NOVO: Chama a função da biblioteca para continuar o assistente
    if (callbackData.startsWith('assist_')) {
        const resultado = BibliotecaBoasContas.continuarAssistente(sheetId, chatId, callbackData);
        enviarResposta(chatId, resultado);
    }
}

function processTextMessage(message) {
    const chatId = message.chat.id;
    const text = message.text;
    const userName = message.from.first_name;

    const sheetId = getClientSheetIdByChatId(chatId);
    if (!sheetId) {
        sendMessage(chatId, "Olá! O seu utilizador do Telegram não está associado a nenhuma licença ativa do Boas Contas.");
        return;
    }

    if (text.toLowerCase().startsWith('/')) {
        handleCommand(chatId, text, sheetId);
    } else {
        sendMessage(chatId, "A processar a sua mensagem... 🧠");
        const resultado = BibliotecaBoasContas.interpretarMensagemGenerica(sheetId, text, chatId, userName);
        enviarResposta(chatId, resultado);
    }
}

function handleCommand(chatId, text, sheetId) {
    const command = text.toLowerCase().split(' ')[0];
    switch (command) {
        case "/start":
        case "/ajuda":
            const helpMessage = "Olá! Sou o assistente do Boas Contas.\n\n*Comandos:*\n`/saldo` - Mostra o saldo total.\n`/resumo` - Resumo do mês atual.\n\n*Para Perguntas:*\n`quanto gastei com mercado este mês?`\n\n*Para Lançamentos:*\n`gastei 50 no mercado com o nubank`";
            sendMessage(chatId, helpMessage);
            break;
        case "/saldo":
            sendMessage(chatId, "A calcular o seu saldo... ⌛");
            sendMessage(chatId, BibliotecaBoasContas.obterSaldoContas(sheetId));
            break;
        case "/resumo":
            sendMessage(chatId, "A gerar o seu resumo mensal... ⌛");
            sendMessage(chatId, BibliotecaBoasContas.obterResumoDoMes(sheetId));
            break;
        default:
            sendMessage(chatId, `Comando "${command}" não reconhecido. Use /ajuda.`);
            break;
    }
}

function handleSendNotification(params) {
    const { chatId, message, sheetId } = params;
    if (!chatId || !message || !sheetId) throw new Error("Parâmetros em falta para notificação.");
    
    // Verifica a licença ANTES de enviar a notificação
    const clientSheetId = getClientSheetIdByChatId(chatId);
    if (clientSheetId === sheetId) { // Garante que a notificação é para o dono legítimo da licença
      sendMessage(chatId, message);
      return createJsonResponse({ status: 'success' });
    } else {
      return createJsonResponse({ status: 'error', message: 'Licença inválida para notificação.' });
    }
}// --- FUNÇÕES AUXILIARES E DE ACESSO A DADOS ---
// Nenhuma alteração necessária aqui
function getDbSheet() {
  const dbSheetId = PropertiesService.getScriptProperties().getProperty('CLIENT_DB_SHEET_ID');
  if (!dbSheetId) throw new Error("ID da Base de Clientes não configurado.");
  const spreadsheet = SpreadsheetApp.openById(dbSheetId);
  return spreadsheet.getSheetByName(CLIENT_SHEET_NAME);
}
function findLicenseByKey(dbSheet, licenseKey, dataArray) {
  const data = dataArray || dbSheet.getDataRange().getValues();
  const headers = data[0];
  const idxLicenseKey = headers.indexOf('ID_Licenca');
  if (idxLicenseKey === -1) throw new Error("Coluna 'ID_Licenca' não encontrada.");
  for (let i = 1; i < data.length; i++) {
    if (data[i][idxLicenseKey].toString() === licenseKey) {
      return { rowData: data[i], rowIndex: i + 1, headers: headers };
    }
  }
  return { rowData: null, rowIndex: -1, headers: headers };
}
function getClientSheetIdByChatId(chatId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `SHEET_ID_${chatId}`;
  const cachedSheetId = cache.get(cacheKey);
  if (cachedSheetId) return cachedSheetId;
  const dbSheet = getDbSheet();
  const data = dbSheet.getDataRange().getValues();
  const headers = data[0];
  const idxChatId = headers.indexOf('ID_Chat_Telegram');
  const idxSheetId = headers.indexOf('ID_Folha_Calculo');
  const idxStatus = headers.indexOf('Status');
  const idxExpiration = headers.indexOf('Data_Expiracao');
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const expirationDate = new Date(row[idxExpiration]);
    if (row[idxChatId] && row[idxChatId].toString() === chatId.toString() && row[idxStatus] === 'Ativa' && expirationDate > new Date()) {
      const sheetId = row[idxSheetId];
      cache.put(cacheKey, sheetId, 21600);
      return sheetId;
    }
  }
  return null;
}
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


// --- FUNÇÕES DE COMUNICAÇÃO COM O TELEGRAM API ---

// --- FUNÇÕES DE COMUNICAÇÃO COM O TELEGRAM API (ATUALIZADA) ---

// ATUALIZADA: Agora consegue enviar teclados de botões
function enviarResposta(chatId, resultado) {
    if (!resultado) return;
    if (resultado.type === 'message') {
        sendMessage(chatId, resultado.text);
    } else if (resultado.type === 'question') {
        // A biblioteca agora envia o JSON do teclado como uma string
        sendMessage(chatId, resultado.text, { reply_markup: JSON.parse(resultado.options) });
    }
}

function sendMessage(chatId, text, options = {}) {
  const botToken = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (!botToken) return;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: String(chatId),
    text: text,
    parse_mode: 'Markdown',
    ...options
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}

function answerCallbackQuery(callbackQueryId) {
  const botToken = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (!botToken) return;
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ callback_query_id: callbackQueryId })
  });
}


