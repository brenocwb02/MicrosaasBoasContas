/**
 * @OnlyCurrentDoc
 *
 * VERSÃO REATORADA: Este script agora passa explicitamente o ID da planilha
 * para a biblioteca, garantindo que as operações ocorram no contexto correto.
 */

// IMPORTANTE: Cole aqui o URL do Web App do seu SERVIDOR BOT
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzTRAqv5gT1oCXNHfhjLmpMQgn1pt9YxbPc7QD7m0WnoJifGVmxzQfXnzTBuCyPJKYULA/exec";


/**
 * Função executada ao abrir. Lida com a autorização inicial e mostra o menu apropriado.
 */
function onOpen() {
  try {
    // Esta chamada requer autorização. Se falhar, o bloco catch() será executado.
    const properties = PropertiesService.getUserProperties();
    const licenseStatus = properties.getProperty('LICENSE_STATUS');
    const ui = SpreadsheetApp.getUi();

    if (licenseStatus === 'ACTIVE') {
      // Menu completo para utilizadores ativados
      ui.createMenu('Boas Contas')
        .addItem('Adicionar Lançamento', 'abrirSidebarLancamento')
        .addSeparator()
        .addItem('Atualizar Faturas', 'rodarAtualizacaoFaturas')
        .addItem('Pagar Fatura', 'abrirSidebarPagarFatura')
        .addSeparator()
        .addItem('📊 Atualizar Dashboard', 'rodarAtualizacaoDashboard')
        .addSeparator()
        .addItem('🗂️ Arquivar Transações Antigas', 'rodarArquivamento')
        .addSeparator()
        .addItem('🚀 Inicializar Sistema', 'rodarInicializacao')
        .addItem('🔎 Verificar Versão', 'verificarVersaoBiblioteca')
        .addSeparator()
        .addSubMenu(ui.createMenu('⏰ Lembretes Automáticos')
            .addItem('Ativar Lembretes Diários', 'ativarLembretes')
            .addItem('Desativar Lembretes', 'desativarLembretes'))
        .addSeparator()
        .addItem('⚙️ Configurar Telegram', 'abrirSidebarTelegram')
        .addToUi();
    } else {
      // Menu limitado para ativação, para utilizadores já autorizados mas não ativados
      ui.createMenu('Boas Contas')
        .addItem('⚠️ Ativar Produto', 'showActivationSidebar')
        .addToUi();
    }
  } catch (e) {
    // Este erro acontece na primeira vez que um novo utilizador abre a planilha,
    // pois o script ainda não tem permissão para aceder às UserProperties.
    // Criamos um menu simples para que o utilizador possa autorizar o script com um clique.
    SpreadsheetApp.getUi().createMenu('Boas Contas')
      .addItem('▶️ Iniciar e Autorizar', 'authorizeAndCreateMenu')
      .addToUi();
  }
}

/**
 * Esta função é chamada pelo menu "Iniciar e Autorizar".
 * O ato de a chamar aciona o fluxo de autorização do Google.
 * Após a autorização, ela recria o menu.
 */
function authorizeAndCreateMenu() {
  // A autorização já aconteceu no momento em que esta função foi chamada.
  // Agora, simplesmente executamos a lógica onOpen() novamente.
  onOpen(); 
  SpreadsheetApp.getUi().alert("Autorização concluída! O menu de ativação está agora disponível.");
}

/**
 * FUNÇÃO DE INSTALAÇÃO: Execute esta função manualmente UMA VEZ
 * a partir do editor de scripts para garantir que o menu 'Boas Contas'
 * seja sempre criado de forma fiável ao abrir a planilha.
 */
function createOnOpenTrigger() {
  // Apaga gatilhos antigos para evitar duplicados
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'onOpen') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  // Cria o novo gatilho fiável
  ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onOpen()
    .create();
  SpreadsheetApp.getUi().alert('Gatilho de abertura instalado com sucesso! Por favor, recarregue a página da planilha.');
}


// --- Funções que chamam a BIBLIOTECA (ATUALIZADAS) ---

function getSheetId_() {
  return SpreadsheetApp.getActiveSpreadsheet().getId();
}

function rodarInicializacao() {
  const ui = SpreadsheetApp.getUi();
  const resultado = BibliotecaBoasContas.inicializarSistema(getSheetId_());
  ui.alert(resultado);
}

function verificarVersaoBiblioteca(){
  const ui = SpreadsheetApp.getUi();
  const versao = BibliotecaBoasContas.getLibraryVersion();
  ui.alert('A versão da biblioteca conectada é: ' + versao);
}

function rodarAtualizacaoFaturas() {
  const ui = SpreadsheetApp.getUi();
  ui.alert("A processar... A atualização de faturas pode demorar alguns segundos.");
  const resultado = BibliotecaBoasContas.atualizarFaturas(getSheetId_());
  ui.alert(resultado);
}

function rodarAtualizacaoDashboard() {
  const ui = SpreadsheetApp.getUi();
  ui.alert("A atualizar os dados do Dashboard...");
  const resultado = BibliotecaBoasContas.atualizarDashboard(getSheetId_());
  ui.alert(resultado);
}

function rodarArquivamento() {
  const ui = SpreadsheetApp.getUi();
  const confirmacao = ui.prompt('Tem a certeza que deseja arquivar transações com mais de 2 anos? Escreva "ARQUIVAR" para confirmar.');
  if (confirmacao.getResponseText().toUpperCase() === 'ARQUIVAR') {
    const resultado = BibliotecaBoasContas.arquivarTransacoesAntigas(getSheetId_());
    ui.alert(resultado);
  } else {
    ui.alert('Operação cancelada.');
  }
}

function ativarLembretes() {
    const ui = SpreadsheetApp.getUi();
    const resultado = BibliotecaBoasContas.criarTriggerDiario(getSheetId_());
    ui.alert(resultado);
}

function desativarLembretes() {
    const ui = SpreadsheetApp.getUi();
    const resultado = BibliotecaBoasContas.deletarTriggers(getSheetId_());
    ui.alert(resultado);
}


// --- Funções para abrir INTERFACES ---

function showActivationSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('ActivationSidebar.html')
    .setTitle('Ativação do Produto')
    .setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

function abrirSidebarLancamento() {
  const html = HtmlService.createHtmlOutputFromFile('sidebars.html')
    .setTitle('Novo Lançamento')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function abrirSidebarPagarFatura() {
  const html = HtmlService.createHtmlOutputFromFile('PagarFaturaSidebar.html')
    .setTitle('Pagar Fatura de Cartão')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function abrirSidebarTelegram() {
  const html = HtmlService.createHtmlOutputFromFile('TelegramSidebar.html')
    .setTitle('Configurar Telegram')
    .setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}


// --- Funções chamadas pelo HTML (ATUALIZADAS) ---

function getDadosIniciais() {
  return BibliotecaBoasContas.obterDadosParaSidebar(getSheetId_());
}

function getFaturasParaPagamento() {
  const faturas = BibliotecaBoasContas.obterFaturasAbertas(getSheetId_());
  const dadosSidebar = BibliotecaBoasContas.obterDadosParaSidebar(getSheetId_());
  return {
    faturasAbertas: faturas,
    contasPagamento: dadosSidebar.contas
  };
}

function processarFormularioLancamento(formData) {
  return BibliotecaBoasContas.adicionarLancamento(getSheetId_(), formData);
}

function processarPagamentoFatura(dadosPagamento) {
  return BibliotecaBoasContas.pagarFatura(getSheetId_(), dadosPagamento);
}


// --- Funções de Licença (sem alterações) ---

/**
 * Valida a chave de licença com o servidor. Chamada pela ActivationSidebar.html.
 * @param {string} licenseKey A chave inserida pelo utilizador.
 * @returns {string} Mensagem de sucesso.
 * @throws {Error} Mensagem de erro.
 */
function activateLicense(licenseKey) {
  if (!licenseKey) throw new Error("A chave de licença não pode estar vazia.");

  try {
    const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const url = `${WEB_APP_URL}?action=activateLicense&licenseKey=${encodeURIComponent(licenseKey)}&sheetId=${encodeURIComponent(sheetId)}`;
    
    const response = UrlFetchApp.fetch(url, { 'muteHttpExceptions': true });
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 200 && result.status === 'success') {
      const properties = PropertiesService.getUserProperties();
      properties.setProperty('LICENSE_KEY', licenseKey);
      properties.setProperty('LICENSE_STATUS', 'ACTIVE');
      return result.message;
    } else {
      throw new Error(result.message || "Resposta inválida do servidor.");
    }
  } catch (e) {
    Logger.log("Erro em activateLicense (cliente): " + e.stack);
    throw new Error("Ocorreu um erro ao comunicar com o servidor: " + e.message);
  }
}

/**
 * Regista o Telegram usando a chave de licença guardada. Chamada pela TelegramSidebar.html.
 * @param {object} dados O objeto com o chatId e clientName.
 * @returns {string} Mensagem de sucesso.
 * @throws {Error} Mensagem de erro.
 */
function registrarTelegram(dados) {
  try {
    const licenseKey = PropertiesService.getUserProperties().getProperty('LICENSE_KEY');
    if (!licenseKey) {
      throw new Error("Chave de licença não encontrada. Por favor, ative o produto primeiro.");
    }

    const url = `${WEB_APP_URL}?action=registerTelegram&licenseKey=${encodeURIComponent(licenseKey)}&chatId=${encodeURIComponent(dados.chatId)}&clientName=${encodeURIComponent(dados.clientName)}`;
    
    const response = UrlFetchApp.fetch(url, { 'muteHttpExceptions': true });
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 200 && result.status === 'success') {
      return result.message;
    } else {
      throw new Error(result.message || "Resposta inválida do servidor.");
    }
  } catch (e) {
    Logger.log("Erro em registrarTelegram (cliente): " + e.stack);
    throw new Error("Ocorreu um erro ao comunicar com o servidor: " + e.message);
  }
}
