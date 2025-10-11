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
 * VERSÃO FINAL E CORRIGIDA: Calcula a data de vencimento da fatura com precisão.
 * @param {Date} dataTransacao A data da compra.
 * @param {object} infoCartao Os dados do cartão da aba 'Contas'.
 * @param {number} mesesAdicionais Para compras parceladas.
 * @returns {Date} A data de vencimento correta.
 */
function calcularVencimentoFatura(dataTransacao, infoCartao, mesesAdicionais = 0) {
  const diaVencimento = parseInt(infoCartao['Dia de Vencimento']);
  if (isNaN(diaVencimento)) {
    Logger.log(`[ERRO Vencimento] Dia de vencimento inválido para '${infoCartao['Nome da Conta']}'.`);
    return new Date(); // Retorno seguro
  }

  // 1. Define a data base da transação, já considerando as parcelas
  let dataEfetiva = new Date(dataTransacao);
  if (mesesAdicionais > 0) {
    dataEfetiva.setMonth(dataEfetiva.getMonth() + mesesAdicionais);
  }
  dataEfetiva.setHours(0, 0, 0, 0);

  // 2. Define a data de vencimento do ciclo ATUAL da compra
  // (Ex: compra em Outubro -> vencimento em Novembro)
  let vencimentoCicloAtual = new Date(dataEfetiva.getFullYear(), dataEfetiva.getMonth() + 1, diaVencimento);

  // 3. Calcula a data de fechamento com base no vencimento do ciclo atual
  let dataFechamento;
  if (infoCartao['Tipo de Fechamento'] === 'fechamento-mes') {
    const diaFechamento = parseInt(infoCartao['Dia de Fechamento']);
    dataFechamento = new Date(dataEfetiva.getFullYear(), dataEfetiva.getMonth(), diaFechamento);
  } else { // 'fechamento-anterior'
    const diasAntes = parseInt(infoCartao['Dias Antes Vencimento']);
    dataFechamento = new Date(vencimentoCicloAtual);
    dataFechamento.setDate(vencimentoCicloAtual.getDate() - diasAntes);
  }
  dataFechamento.setHours(0, 0, 0, 0);

  // 4. Compara e retorna a data de vencimento correta
  if (dataEfetiva > dataFechamento) {
    // Compra feita DEPOIS do fechamento: o vencimento é no ciclo seguinte
    // (Ex: compra em Outubro -> vencimento em Dezembro)
    return new Date(vencimentoCicloAtual.getFullYear(), vencimentoCicloAtual.getMonth() + 1, diaVencimento);
  } else {
    // Compra feita ANTES do fechamento: o vencimento é no ciclo atual
    // (Ex: compra em Outubro -> vencimento em Novembro)
    return vencimentoCicloAtual;
  }
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

