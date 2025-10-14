/**
 * @OnlyCurrentDoc
 *
 * VERSÃO FINAL: Funções relacionadas à gestão de faturas, com cálculo
 * de data de vencimento unificado e preciso.
 */

function obterInfoCartao(nomeCartao, ss) {
  const contasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS);
  const data = contasSheet.getDataRange().getValues();
  const headers = data[0];
  const idxNome = headers.indexOf('Nome da Conta');
  const idxTipo = headers.indexOf('Tipo');
  
  if (idxNome === -1 || idxTipo === -1) return null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idxNome] === nomeCartao && row[idxTipo] === 'Cartão de Crédito') {
      const info = {};
      headers.forEach((header, index) => {
        info[header] = row[index];
      });
      return info;
    }
  }
  return null;
}

/**
 * VERSÃO CORRIGIDA
 * Calcula a data de vencimento correta de uma parcela de cartão de crédito.
 * Esta função substitui a versão anterior para lidar corretamente com todos os tipos de cartões.
 *
 * @param {Date} dataCompra A data em que a compra foi realizada.
 * @param {object} infoCartao Objeto com as informações do cartão.
 * @param {number} infoCartao.diaFechamento O dia do mês em que a fatura fecha.
 * @param {number} infoCartao.diaVencimento O dia do mês em que a fatura vence.
 * @param {number} mesesAdicionais O número de meses a adicionar (para parcelas). O padrão é 0 para a primeira parcela.
 * @returns {Date} A data de vencimento calculada.
 */
function calcularVencimentoFatura(dataCompra, infoCartao, mesesAdicionais = 0) {
    const diaCompra = dataCompra.getDate();
    const mesCompra = dataCompra.getMonth();
    const anoCompra = dataCompra.getFullYear();

    let mesVencimento;
    let anoVencimento = anoCompra;

    if (infoCartao.diaVencimento > infoCartao.diaFechamento) {
        // CASO 1: Fechamento e Vencimento no mesmo mês (Ex: fecha dia 5, vence dia 11)
        if (diaCompra > infoCartao.diaFechamento) {
            // A compra cai na fatura do próximo mês.
            mesVencimento = mesCompra + 1;
        } else {
            // A compra cai na fatura do mês atual.
            mesVencimento = mesCompra;
        }
    } else {
        // CASO 2: Vencimento no mês seguinte ao fechamento (Ex: fecha dia 29, vence dia 10)
        const dataFechamentoNoMesDaCompra = new Date(anoCompra, mesCompra, infoCartao.diaFechamento);
        if (dataCompra.getTime() > dataFechamentoNoMesDaCompra.getTime()) {
            // Compra feita após o fechamento, fatura vence dois meses à frente.
            mesVencimento = mesCompra + 2;
        } else {
            // Compra feita antes do fechamento, fatura vence no próximo mês.
            mesVencimento = mesCompra + 1;
        }
    }

    // Adiciona os meses das parcelas futuras
    mesVencimento += mesesAdicionais;

    // O construtor do Date() lida automaticamente com o overflow de meses 
    // (ex: mês 12 se torna Janeiro do próximo ano) e cria a data correta.
    return new Date(anoVencimento, mesVencimento, infoCartao.diaVencimento);
}

/**
 * Percorre as transações e cria ou atualiza as faturas na aba 'Faturas'.
 */
function atualizarFaturas(sheetId) {
  if (!sheetId) throw new Error("ID da planilha não fornecido para atualizar faturas.");
  const ss = SpreadsheetApp.openById(sheetId);
  
  const transacoesSheet = getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS);
  const transacoesData = transacoesSheet.getDataRange().getValues();
  
  const faturasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.FATURAS);
  
  const headers = transacoesData[0];
  const idxVencimento = headers.indexOf('Data de Vencimento');
  const idxCartao = headers.indexOf('Conta/Cartão');
  const idxValor = headers.indexOf('Valor');

  const faturasAgrupadas = {};

  for (let i = 1; i < transacoesData.length; i++) {
    const linha = transacoesData[i];
    const dataVencimento = linha[idxVencimento] ? new Date(linha[idxVencimento]) : null;
    
    if (dataVencimento && !isNaN(dataVencimento.getTime())) {
      const cartao = linha[idxCartao];
      const valor = parseFloat(linha[idxValor] || 0);
      
      const ano = dataVencimento.getFullYear();
      const mes = dataVencimento.getMonth() + 1; // 1-12
      const faturaId = `${cartao.replace(/\s/g, '')}-${ano}${mes.toString().padStart(2, '0')}`;
      
      if (!faturasAgrupadas[faturaId]) {
        faturasAgrupadas[faturaId] = {
          cartao: cartao,
          dataVencimento: dataVencimento,
          valorTotal: 0
        };
      }
      faturasAgrupadas[faturaId].valorTotal += valor;
    }
  }

  // Limpa a aba de faturas (mantendo o cabeçalho) e reescreve com os dados atualizados
  if (faturasSheet.getLastRow() > 1) {
    faturasSheet.getRange(2, 1, faturasSheet.getLastRow() - 1, faturasSheet.getLastColumn()).clearContent();
  }

  const novasLinhas = Object.keys(faturasAgrupadas).map(faturaId => {
    const fatura = faturasAgrupadas[faturaId];
    return [
      faturaId,
      fatura.cartao,
      new Date(fatura.dataVencimento.getFullYear(), fatura.dataVencimento.getMonth(), 1), // Mês de referência
      '', // Data de fechamento (pode ser adicionada no futuro)
      fatura.dataVencimento,
      fatura.valorTotal,
      0, // Valor Pago (inicial)
      'Aberta', // Status (inicial)
      '' // ID Transação Pagamento (inicial)
    ];
  });
  
  if (novasLinhas.length > 0) {
    faturasSheet.getRange(2, 1, novasLinhas.length, novasLinhas[0].length).setValues(novasLinhas);
  }
  
  return "Faturas atualizadas com sucesso com base nas suas transações!";
}

/**
 * Devolve uma lista de faturas com status 'Aberta' para a sidebar.
 */
function obterFaturasAbertas(sheetId) {
  if (!sheetId) return [];
  const ss = SpreadsheetApp.openById(sheetId);
  const faturasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.FATURAS);
  if(faturasSheet.getLastRow() < 2) return [];

  const faturasData = faturasSheet.getDataRange().getValues();
  const headers = faturasData[0];
  const idxStatus = headers.indexOf('Status');
  
  const faturasAbertas = [];
  for (let i = 1; i < faturasData.length; i++) {
    if (faturasData[i][idxStatus] === 'Aberta') {
      let faturaObj = {};
      headers.forEach((header, index) => {
        faturaObj[header] = faturasData[i][index];
      });
      faturasAbertas.push(faturaObj);
    }
  }
  return faturasAbertas;
}

