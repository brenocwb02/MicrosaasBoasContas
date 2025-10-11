/**
 * @OnlyCurrentDoc
 *
 * Funções de diagnóstico, inicialização e manutenção do sistema.
 */

function getLibraryVersion() {
  return BIBLIOTECA_VERSAO;
}

function inicializarSistema() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS);
    getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS);
    getSheetAndCreateIfNotExists(ss, SHEETS.CATEGORIAS);
    getSheetAndCreateIfNotExists(ss, SHEETS.FATURAS);
    getSheetAndCreateIfNotExists(ss, SHEETS.DASHBOARD); 
    
    return "Sistema inicializado com sucesso! Todas as abas necessárias foram criadas.";
  } catch (e) {
    Logger.log('Erro ao inicializar o sistema: ' + e.stack);
    return "Ocorreu um erro durante a inicialização: " + e.message;
  }
}

function atualizarDashboard() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const transacoesSheet = getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS);
    const dashboardSheet = getSheetAndCreateIfNotExists(ss, SHEETS.DASHBOARD);
    const transacoesData = transacoesSheet.getDataRange().getValues();

    if (transacoesData.length < 2) {
      return "Nenhuma transação para processar.";
    }

    const headers = transacoesData[0];
    const idxData = headers.indexOf('Data');
    const idxTipo = headers.indexOf('Tipo');
    const idxValor = headers.indexOf('Valor');
    const idxCategoria = headers.indexOf('Categoria'); 

    if (idxData === -1 || idxTipo === -1 || idxValor === -1 || idxCategoria === -1) {
      throw new Error("Colunas essenciais (Data, Tipo, Valor, Categoria) não encontradas na aba 'Transacoes'.");
    }

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const despesasAgrupadas = {};

    for (let i = 1; i < transacoesData.length; i++) {
      const linha = transacoesData[i];
      let dataTransacao = linha[idxData];

      if (dataTransacao && !(dataTransacao instanceof Date)) {
        dataTransacao = new Date(dataTransacao);
      }
      
      if (dataTransacao instanceof Date && !isNaN(dataTransacao) && linha[idxTipo] === 'Despesa' && dataTransacao.getMonth() === mesAtual && dataTransacao.getFullYear() === anoAtual) {
        const categoria = linha[idxCategoria];
        const valor = parseFloat(linha[idxValor]);
        
        if (categoria && valor) {
          if (!despesasAgrupadas[categoria]) {
            despesasAgrupadas[categoria] = 0;
          }
          despesasAgrupadas[categoria] += valor;
        }
      }
    }

    const outputData = [];
    for (const categoria in despesasAgrupadas) {
      outputData.push([categoria, despesasAgrupadas[categoria]]);
    }

    outputData.sort((a, b) => b[1] - a[1]);
    
    const dataAreaStartRow = 4;
    const dataAreaStartCol = 10;

    if (dashboardSheet.getLastRow() >= dataAreaStartRow) {
      dashboardSheet.getRange(dataAreaStartRow, dataAreaStartCol, dashboardSheet.getLastRow() - dataAreaStartRow + 1, 2).clearContent();
    }

    if (outputData.length > 0) {
      dashboardSheet.getRange(dataAreaStartRow, dataAreaStartCol, outputData.length, 2).setValues(outputData);
    }
    
    return "Dashboard atualizado com sucesso!";

  } catch (e) {
    Logger.log('Erro ao atualizar Dashboard: ' + e.stack);
    return 'Ocorreu um erro ao atualizar o Dashboard: ' + e.message;
  }
}

function arquivarTransacoesAntigas() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const transacoesSheet = getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS);
    const arquivoSheet = getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS_ARQUIVO, transacoesSheet.getRange(1, 1, 1, transacoesSheet.getLastColumn()).getValues()[0]);
    
    const transacoesData = transacoesSheet.getDataRange().getValues();
    if (transacoesData.length < 2) {
      return "Nenhuma transação para arquivar.";
    }
    
    const headers = transacoesData.shift(); // Remove e guarda os cabeçalhos
    const idxData = headers.indexOf('Data');
    if (idxData === -1) throw new Error("Coluna 'Data' não encontrada.");

    const doisAnosAtras = new Date();
    doisAnosAtras.setFullYear(doisAnosAtras.getFullYear() - 2);

    const transacoesParaManter = [headers];
    const transacoesParaArquivar = [];

    transacoesData.forEach(linha => {
      const dataTransacao = new Date(linha[idxData]);
      if (dataTransacao < doisAnosAtras) {
        transacoesParaArquivar.push(linha);
      } else {
        transacoesParaManter.push(linha);
      }
    });

    if (transacoesParaArquivar.length > 0) {
      // Adiciona ao arquivo
      arquivoSheet.getRange(arquivoSheet.getLastRow() + 1, 1, transacoesParaArquivar.length, transacoesParaArquivar[0].length).setValues(transacoesParaArquivar);
      
      // Limpa a folha principal e reescreve com as transações mais recentes
      transacoesSheet.clearContents();
      transacoesSheet.getRange(1, 1, transacoesParaManter.length, transacoesParaManter[0].length).setValues(transacoesParaManter);
      
      return `${transacoesParaArquivar.length} transações antigas foram arquivadas com sucesso!`;
    } else {
      return "Nenhuma transação com mais de 2 anos encontrada para arquivar.";
    }
  } catch (e) {
    Logger.log('Erro ao arquivar transações: ' + e.stack);
    return 'Ocorreu um erro durante o arquivamento: ' + e.message;
  }
}


