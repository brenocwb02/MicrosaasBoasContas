/**
 * @OnlyCurrentDoc
 *
 * Módulo responsável por verificar e enviar notificações proativas.
 */

const DIAS_ANTECEDENCIA_PADRAO = 3;

/**
 * Função principal que é chamada pelo trigger para executar todas as verificações.
 */
function executarVerificacoesDiarias() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Esta função assume que a planilha do cliente tem uma aba 'Notificacoes_Config'
  const configSheet = ss.getSheetByName('Notificacoes_Config');
  if (!configSheet) return;

  const configData = configSheet.getDataRange().getValues();
  const headers = configData.shift(); // Remove cabeçalho
  
  const idxChatId = headers.indexOf('Chat ID');
  const idxLembretesContas = headers.indexOf('Lembretes Contas a Pagar');
  const idxAlertasFatura = headers.indexOf('Alertas de Fatura');

  configData.forEach(linha => {
    const chatId = linha[idxChatId];
    if (!chatId) return; // Pula se não houver chat ID

    // Verifica se a opção está marcada como 'Sim' ou 'true'
    if (linha[idxLembretesContas] === 'Sim' || linha[idxLembretesContas] === true) {
      verificarContasAPagar(ss, chatId);
    }
    if (linha[idxAlertasFatura] === 'Sim' || linha[idxAlertasFatura] === true) {
      verificarFaturas(ss, chatId);
    }
  });
}

/**
 * Verifica as contas a pagar que estão próximas do vencimento.
 */
function verificarContasAPagar(ss, chatId) {
  const contasSheet = ss.getSheetByName('Contas_a_Pagar');
  if (!contasSheet || contasSheet.getLastRow() < 2) return;

  const data = contasSheet.getDataRange().getValues();
  const headers = data.shift();
  const idxDescricao = headers.indexOf('Descricao');
  const idxVencimento = headers.indexOf('Data de Vencimento');
  const idxStatus = headers.indexOf('Status');
  const idxValor = headers.indexOf('Valor');

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataLimite = new Date(hoje);
  dataLimite.setDate(hoje.getDate() + DIAS_ANTECEDENCIA_PADRAO);
  
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  data.forEach(linha => {
    const status = linha[idxStatus];
    const dataVencimento = new Date(linha[idxVencimento]);
    dataVencimento.setHours(0, 0, 0, 0);

    // Verifica se a conta está Pendente e dentro da janela de notificação
    if (status === 'Pendente' && dataVencimento >= hoje && dataVencimento <= dataLimite) {
      const descricao = linha[idxDescricao];
      const valor = parseFloat(linha[idxValor]);
      const diasRestantes = Math.round((dataVencimento - hoje) / (1000 * 60 * 60 * 24));
      let textoDias = diasRestantes === 0 ? "hoje" : `em ${diasRestantes} dia(s)`;

      let mensagem = `🗓️ *Lembrete de Conta a Pagar*\n\n`;
      mensagem += `*Descrição:* ${descricao}\n`;
      if(valor > 0){
         mensagem += `*Valor:* ${formatter.format(valor)}\n`;
      }
      mensagem += `*Vencimento:* ${dataVencimento.toLocaleDateString('pt-BR')} (${textoDias})`;
      
      enviarNotificacaoTelegram(chatId, mensagem);
    }
  });
}

/**
 * Verifica as faturas de cartão de crédito próximas do vencimento.
 */
function verificarFaturas(ss, chatId) {
  const faturasSheet = ss.getSheetByName('Faturas');
  if (!faturasSheet || faturasSheet.getLastRow() < 2) return;

  const data = faturasSheet.getDataRange().getValues();
  const headers = data.shift();
  const idxCartao = headers.indexOf('Cartao');
  const idxVencimento = headers.indexOf('Data Vencimento');
  const idxValor = headers.indexOf('Valor Total');
  const idxStatus = headers.indexOf('Status');

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataLimite = new Date(hoje);
  dataLimite.setDate(hoje.getDate() + DIAS_ANTECEDENCIA_PADRAO);
  
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  data.forEach(linha => {
    const status = linha[idxStatus];
    const dataVencimento = new Date(linha[idxVencimento]);
    dataVencimento.setHours(0, 0, 0, 0);

    if (status === 'Aberta' && dataVencimento >= hoje && dataVencimento <= dataLimite) {
      const cartao = linha[idxCartao];
      const valor = parseFloat(linha[idxValor]);
      const diasRestantes = Math.round((dataVencimento - hoje) / (1000 * 60 * 60 * 24));
      let textoDias = diasRestantes === 0 ? "hoje" : `em ${diasRestantes} dia(s)`;

      let mensagem = `💳 *Lembrete de Fatura*\n\n`;
      mensagem += `A fatura do seu cartão *${cartao}* no valor de *${formatter.format(valor)}* vence ${textoDias}.`;
      
      enviarNotificacaoTelegram(chatId, mensagem);
    }
  });
}

/**
 * Envia a notificação para o servidor do bot.
 * O servidor do bot é responsável por usar o token e enviar a mensagem, após validar a licença.
 */
function enviarNotificacaoTelegram(chatId, mensagem) {
  try {
    // Busca a URL do Web App das propriedades do script da biblioteca
    const webAppUrl = PropertiesService.getScriptProperties().getProperty('BOT_WEB_APP_URL');
    if (!webAppUrl) {
      Logger.log("URL do Web App do bot não configurado nas Propriedades do Script da Biblioteca.");
      return;
    }
    
    // O ID da folha é usado para verificar a licença no lado do servidor
    const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId(); 

    const url = `${webAppUrl}?action=enviarNotificacao&chatId=${encodeURIComponent(chatId)}&message=${encodeURIComponent(mensagem)}&sheetId=${encodeURIComponent(sheetId)}`;
    
    UrlFetchApp.fetch(url, { 'method': 'get', 'muteHttpExceptions': true });
    
  } catch(e) {
    Logger.log(`Erro ao tentar enviar notificação: ${e.message}`);
  }
}

