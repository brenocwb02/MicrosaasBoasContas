/**
 * @OnlyCurrentDoc
 *
 * VERSÃO FINAL UNIFICADA: Contém a única e correta lógica de negócio para
 * adicionar lançamentos, usada tanto pela sidebar como pelo bot do Telegram.
 */

function adicionarLancamento(sheetId, dados) {
  if (!sheetId) throw new Error("ID da planilha não fornecido para adicionar lançamento.");
  
  const ss = SpreadsheetApp.openById(sheetId);
  const lancamentosSheet = getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const headers = lancamentosSheet.getRange(1, 1, 1, lancamentosSheet.getLastColumn()).getValues()[0];
    const dataAtual = new Date();

    const novoLancamento = {
      'Data': new Date(dados.data) || dataAtual,
      'Descricao': dados.descricao,
      'Categoria': dados.categoria,
      'Subcategoria': dados.subcategoria || '',
      'Tipo': dados.tipo,
      'Valor': parseFloat(String(dados.valor).replace(',', '.')),
      'Metodo de Pagamento': dados.metodoPagamento,
      'Conta/Cartão': dados.conta,
      'Parcelas Totais': parseInt(dados.parcelasTotais) || 1,
      'Parcela Atual': 1,
      'Data de Vencimento': '',
      'Usuario': dados.usuario || 'Bot Telegram',
      'Status': 'Ativo',
      'ID Transacao': Utilities.getUuid(),
      'Data de Registro': dataAtual
    };

    const infoCartao = obterInfoCartao(novoLancamento['Conta/Cartão'], ss);

    if (infoCartao && (novoLancamento['Metodo de Pagamento'] === 'Crédito' || novoLancamento['Metodo de Pagamento'] === 'Cartão de Crédito')) {
      const parcelasTotais = novoLancamento['Parcelas Totais'];
      const transacaoBaseId = novoLancamento['ID Transacao'];
      const descricaoBase = novoLancamento['Descricao'];

      for (let i = 1; i <= parcelasTotais; i++) {
        const lancamentoParcelado = { ...novoLancamento };
        lancamentoParcelado['Parcela Atual'] = i;
        lancamentoParcelado['ID Transacao'] = `${transacaoBaseId}-${i}`;
        if (parcelasTotais > 1) {
          lancamentoParcelado['Descricao'] = `${descricaoBase} (${i}/${parcelasTotais})`;
        }
        
        // Chamada à função de cálculo de vencimento correta
        const dataVencimento = calcularVencimentoFatura(new Date(lancamentoParcelado['Data']), infoCartao, i - 1);
        lancamentoParcelado['Data de Vencimento'] = dataVencimento;
        
        const linhaParaAdicionar = headers.map(header => lancamentoParcelado[header] || '');
        lancamentosSheet.appendRow(linhaParaAdicionar);
      }
      return parcelasTotais > 1 ? `${parcelasTotais} parcelas registadas com sucesso!` : "Lançamento no crédito registado!";
    
    } else {
      const linhaParaAdicionar = headers.map(header => novoLancamento[header] || '');
      lancamentosSheet.appendRow(linhaParaAdicionar);
      return "Lançamento registado com sucesso!";
    }

  } catch (e) {
    Logger.log(`ERRO CRÍTICO em adicionarLancamento: ${e.stack}`);
    try {
      const logsSheet = getSheetAndCreateIfNotExists(ss, 'Logs_Sistema', ['Timestamp', 'Nivel', 'Mensagem']);
      logsSheet.appendRow([new Date(), 'ERRO', `Erro ao adicionar lançamento: ${e.message}`]);
    } catch (e2) {
      Logger.log('Erro ao tentar registar o erro na planilha de logs: ' + e2.stack);
    }
    return "Ocorreu um erro ao registar o lançamento: " + e.message;
  } finally {
    lock.releaseLock();
  }
}
