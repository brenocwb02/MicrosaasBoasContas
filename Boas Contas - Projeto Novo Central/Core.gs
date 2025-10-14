/**
 * @OnlyCurrentDoc
 *
 * VERSÃO 3.4 - CORREÇÃO DO REGISTO /NOVACONTA
 * Contém a lógica de negócio completa, incluindo CRUD para transações e contas.
 */


/**
 * Função auxiliar para atualizar o saldo de uma conta na aba 'Contas'.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss O objeto da planilha.
 * @param {string} nomeConta O nome da conta a ser atualizada.
 * @param {number} valor O valor da transação.
 * @param {string} tipoTransacao 'Despesa' ou 'Receita'.
 */
function _atualizarSaldoDaConta(ss, nomeConta, valor, tipoTransacao) {
  if (!nomeConta || !valor || !tipoTransacao) return;

  const contasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS);
  const data = contasSheet.getDataRange().getValues();
  const headers = data[0].map(h => h.trim());

  const idxNome = headers.indexOf('Nome da Conta');
  const idxTipo = headers.indexOf('Tipo');
  const idxSaldo = headers.indexOf('Saldo Atual');

  if (idxNome === -1 || idxTipo === -1 || idxSaldo === -1) {
    Logger.log("AVISO: Colunas essenciais ('Nome da Conta', 'Tipo', 'Saldo Atual') não encontradas na aba 'Contas'. O saldo não será atualizado.");
    return;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][idxNome] === nomeConta) {
      const tipoConta = data[i][idxTipo];
      const saldoAtual = parseFloat(data[i][idxSaldo] || 0);
      let novoSaldo = saldoAtual;

      if (tipoTransacao === 'Despesa') {
        if (tipoConta === 'Cartão de Crédito') {
          novoSaldo += valor; // Aumenta a dívida no cartão
        } else { // Conta Corrente, Dinheiro, etc.
          novoSaldo -= valor; // Diminui o saldo da conta
        }
      } else if (tipoTransacao === 'Receita') {
         if (tipoConta === 'Cartão de Crédito') {
          novoSaldo -= valor; // Diminui a dívida (ex: estorno)
        } else {
          novoSaldo += valor; // Aumenta o saldo da conta
        }
      }
      
      contasSheet.getRange(i + 1, idxSaldo + 1).setValue(novoSaldo);
      Logger.log(`Saldo da conta '${nomeConta}' atualizado de ${saldoAtual} para ${novoSaldo}.`);
      return; 
    }
  }
  Logger.log(`AVISO: A conta '${nomeConta}' não foi encontrada na aba 'Contas'. O saldo não foi atualizado.`);
}


/**
 * VERSÃO REESTRUTURADA
 * Adiciona um novo lançamento, tratando corretamente casos simples e parcelados.
 */
function adicionarLancamento(sheetId, dados) {
  if (!sheetId) throw new Error("ID da planilha não fornecido.");
  
  const ss = SpreadsheetApp.openById(sheetId);
  const lancamentosSheet = getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const headers = lancamentosSheet.getRange(1, 1, 1, lancamentosSheet.getLastColumn()).getValues()[0];
    const dataAtual = new Date();
    const transactionId = dados.idTransacaoVinculada || Utilities.getUuid();
    const parcelasTotais = parseInt(dados.parcelasTotais) || 1;
    const infoCartao = obterInfoCartao(dados.conta, ss);
    const isCreditCardPurchase = infoCartao && (dados.metodoPagamento === 'Crédito' || dados.metodoPagamento === 'Cartão de Crédito');

    // Lógica para compras parceladas no cartão de crédito
    if (isCreditCardPurchase && parcelasTotais > 1) {
      const valorParcela = parseFloat(String(dados.valor).replace(',', '.'));
      const valorTotalCompra = valorParcela * parcelasTotais;
      const descricaoBase = dados.descricao;

      _atualizarSaldoDaConta(ss, dados.conta, valorTotalCompra, 'Despesa');

      for (let i = 1; i <= parcelasTotais; i++) {
        const lancamentoParcelado = {
          'Data': new Date(dados.data) || dataAtual,
          'Descricao': `${descricaoBase} (${i}/${parcelasTotais})`,
          'Categoria': dados.categoria,
          'Subcategoria': dados.subcategoria || '',
          'Tipo': 'Despesa',
          'Valor': valorParcela,
          'Metodo de Pagamento': dados.metodoPagamento,
          'Conta/Cartão': dados.conta,
          'Parcelas Totais': parcelasTotais,
          'Parcela Atual': i,
          'Data de Vencimento': calcularVencimentoFatura(new Date(dados.data), infoCartao, i - 1),
          'Usuario': dados.usuario || 'Bot Telegram',
          'Status': 'Ativo',
          'ID Transacao': `${transactionId}-${i}`,
          'Data de Registro': dataAtual
        };
        const linhaParaAdicionar = headers.map(header => lancamentoParcelado[header] || '');
        lancamentosSheet.appendRow(linhaParaAdicionar);
      }
      return { transactionId: transactionId, message: `${parcelasTotais} parcelas registadas!` };
    
    } else {
      // Lógica para lançamentos únicos
      const valorLancamento = parseFloat(String(dados.valor).replace(',', '.'));
      
      if (isNaN(valorLancamento) || valorLancamento < 0) {
         throw new Error(`O valor fornecido '${dados.valor}' é inválido.`);
      }

      const novoLancamento = {
        'Data': new Date(dados.data) || dataAtual,
        'Descricao': dados.descricao,
        'Categoria': dados.categoria,
        'Subcategoria': dados.subcategoria || '',
        'Tipo': dados.tipo,
        'Valor': valorLancamento,
        'Metodo de Pagamento': dados.metodoPagamento,
        'Conta/Cartão': dados.conta,
        'Parcelas Totais': 1,
        'Parcela Atual': 1,
        'Data de Vencimento': isCreditCardPurchase ? calcularVencimentoFatura(new Date(dados.data), infoCartao, 0) : '',
        'Usuario': dados.usuario || 'Bot Telegram',
        'Status': 'Ativo',
        'ID Transacao': transactionId,
        'Data de Registro': dataAtual
      };
      
      const linhaParaAdicionar = headers.map(header => novoLancamento[header] || '');
      lancamentosSheet.appendRow(linhaParaAdicionar);

      _atualizarSaldoDaConta(ss, novoLancamento['Conta/Cartão'], novoLancamento['Valor'], novoLancamento['Tipo']);

      return { transactionId: transactionId, message: "Lançamento registado com sucesso!" };
    }
  } catch (e) {
    Logger.log(`ERRO CRÍTICO em adicionarLancamento: ${e.stack}`);
    return { transactionId: null, message: `Ocorreu um erro ao registar o lançamento: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function excluirLancamento(sheetId, transactionId) {
  if (!sheetId || !transactionId) throw new Error("ID da planilha ou da transação não fornecido.");
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColIndex = headers.indexOf('ID Transacao');
    const valorColIndex = headers.indexOf('Valor');
    const contaColIndex = headers.indexOf('Conta/Cartão');
    const tipoColIndex = headers.indexOf('Tipo');
    const parcelasTotaisColIndex = headers.indexOf('Parcelas Totais');

    if (idColIndex === -1) throw new Error("Coluna 'ID Transacao' não encontrada.");

    let linhasExcluidas = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      const rowId = data[i][idColIndex];
      if (rowId && rowId.startsWith(transactionId)) {
        
        const valor = parseFloat(data[i][valorColIndex]);
        const conta = data[i][contaColIndex];
        const tipo = data[i][tipoColIndex];
        const parcelasTotais = parseInt(data[i][parcelasTotaisColIndex]);

        if(parcelasTotais > 1 && linhasExcluidas === 0){
          _atualizarSaldoDaConta(ss, conta, valor * parcelasTotais, tipo === 'Despesa' ? 'Receita' : 'Despesa');
        } else if (parcelasTotais <= 1){
          _atualizarSaldoDaConta(ss, conta, valor, tipo === 'Despesa' ? 'Receita' : 'Despesa');
        }

        sheet.deleteRow(i + 1);
        linhasExcluidas++;
      }
    }
    return linhasExcluidas > 0 ? "✅ Lançamento excluído e saldo revertido!" : "⚠️ Lançamento não encontrado.";
  } catch (e) {
    Logger.log(`ERRO em excluirLancamento: ${e.stack}`);
    return `Ocorreu um erro ao tentar excluir: ${e.message}`;
  } finally {
    lock.releaseLock();
  }
}

function editarLancamento(sheetId, transactionId, campo, novoValor) {
  // ATENÇÃO: A lógica de edição pode precisar de ajustes para recalcular saldos.
  // Por agora, mantém-se a alteração simples do dado.
  if (!sheetId || !transactionId || !campo || novoValor === undefined) {
    throw new Error("Dados insuficientes para editar lançamento.");
  }
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColIndex = headers.indexOf('ID Transacao');
    const campoColIndex = headers.indexOf(campo);
    if (idColIndex === -1) throw new Error("Coluna 'ID Transacao' não encontrada.");
    if (campoColIndex === -1) throw new Error(`Coluna '${campo}' não encontrada.`);

    if (campo === 'Valor') {
      const valorNumerico = parseFloat(String(novoValor).replace(',', '.'));
      if (isNaN(valorNumerico)) throw new Error("Valor inválido.");
      novoValor = valorNumerico;
    }
    let linhasEditadas = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColIndex] && data[i][idColIndex].startsWith(transactionId)) {
        sheet.getRange(i + 1, campoColIndex + 1).setValue(novoValor);
        linhasEditadas++;
      }
    }
    if (linhasEditadas > 0) {
      return `✅ Lançamento atualizado!`;
    } else {
      return "⚠️ Lançamento não encontrado para edição.";
    }
  } catch (e) {
    Logger.log(`ERRO em editarLancamento: ${e.stack}`);
    return `Ocorreu um erro ao editar: ${e.message}`;
  } finally {
    lock.releaseLock();
  }
}


function pagarContaAPagar(sheetId, billId, contaDePagamento) {
  if (!sheetId || !billId || !contaDePagamento) {
    throw new Error("Dados insuficientes para pagar a conta.");
  }
  const ss = SpreadsheetApp.openById(sheetId);
  const contasAPagarSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS_A_PAGAR);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const data = contasAPagarSheet.getDataRange().getValues();
    const headers = data[0].map(h => h.trim());
    const idCol = headers.indexOf('ID');
    const statusCol = headers.indexOf('Status');
    const idTransacaoCol = headers.indexOf('ID Transacao Vinculada');
    
    // Procura pela coluna Subcategoria (opcional)
    const subcategoriaCol = headers.indexOf('Subcategoria');

    if (idCol === -1 || statusCol === -1) {
      throw new Error("Colunas 'ID' ou 'Status' não encontradas em 'Contas_a_Pagar'.");
    }
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol].toString() === billId.toString()) {
        const contaInfo = {
          descricao: data[i][headers.indexOf('Descricao')],
          valor: parseFloat(data[i][headers.indexOf('Valor')] || 0),
          categoria: data[i][headers.indexOf('Categoria')],
          // Lê a subcategoria se a coluna existir
          subcategoria: subcategoriaCol !== -1 ? data[i][subcategoriaCol] : ''
        };
        
        if (contaInfo.valor <= 0) {
          throw new Error("O valor da conta a pagar é zero. O pagamento não pode ser registado.");
        }
        const infoContaPagamento = obterInfoCartao(contaDePagamento, ss) || {};
        const metodoPagamento = obterMetodoDePagamentoPadrao(infoContaPagamento);
        const novoIdTransacao = Utilities.getUuid();
        const dadosLancamento = {
          data: new Date(),
          descricao: contaInfo.descricao,
          valor: contaInfo.valor,
          categoria: contaInfo.categoria,
          subcategoria: contaInfo.subcategoria, // Passa a subcategoria para o novo lançamento
          tipo: 'Despesa',
          conta: contaDePagamento,
          metodoPagamento: metodoPagamento,
          idTransacaoVinculada: novoIdTransacao
        };
        adicionarLancamento(sheetId, dadosLancamento);
        contasAPagarSheet.getRange(i + 1, statusCol + 1).setValue('Pago');
        if (idTransacaoCol !== -1) {
          contasAPagarSheet.getRange(i + 1, idTransacaoCol + 1).setValue(novoIdTransacao);
        }
        return `✅ Conta "${contaInfo.descricao}" paga com sucesso!`;
      }
    }
    return `⚠️ Conta com ID "${billId}" não encontrada ou já paga.`;
  } catch (e) {
    Logger.log(`ERRO em pagarContaAPagar: ${e.stack}`);
    return `❌ Ocorreu um erro ao pagar a conta: ${e.message}`;
  } finally {
    lock.releaseLock();
  }
}

function editarContaAPagar(sheetId, billId, campo, novoValor) {
  if (!sheetId || !billId || !campo || novoValor === undefined) {
    throw new Error("Dados insuficientes para editar a conta.");
  }

  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS_A_PAGAR);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.trim());
    const idCol = headers.indexOf('ID');
    const campoCol = headers.indexOf(campo);

    if (idCol === -1) throw new Error("Coluna 'ID' não encontrada em 'Contas_a_Pagar'.");
    if (campoCol === -1) throw new Error(`Coluna '${campo}' não encontrada para edição.`);

    // Validação e formatação do novo valor
    if (campo === 'Valor') {
      const valorNumerico = parseFloat(String(novoValor).replace(',', '.'));
      if (isNaN(valorNumerico)) {
        throw new Error("O novo valor fornecido não é um número válido.");
      }
      novoValor = valorNumerico;
    } else if (campo === 'Data de Vencimento') {
      let novaData = new Date(novoValor);
      if (isNaN(novaData.getTime())) {
          const parts = novoValor.split('/');
          if (parts.length === 3) {
              const [day, month, year] = parts;
              novaData = new Date(year, month - 1, day);
              if (isNaN(novaData.getTime())) {
                  throw new Error("Formato de data inválido. Use AAAA-MM-DD ou DD/MM/AAAA.");
              }
          } else {
              throw new Error("Formato de data inválido. Use AAAA-MM-DD ou DD/MM/AAAA.");
          }
      }
      novoValor = novaData;
    }

    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol].toString() === billId.toString()) {
        sheet.getRange(i + 1, campoCol + 1).setValue(novoValor);
        return `✅ Conta atualizada com sucesso! O campo '${campo}' foi alterado.`;
      }
    }

    return `⚠️ Conta com ID "${billId}" não encontrada.`;

  } catch (e) {
    Logger.log(`ERRO em editarContaAPagar: ${e.stack}`);
    return `❌ Ocorreu um erro ao editar a conta: ${e.message}`;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Adiciona uma nova conta a pagar na respectiva aba.
 * @param {string} sheetId O ID da folha de cálculo.
 * @param {object} dadosConta O objeto com os dados da nova conta.
 * @returns {string} Uma mensagem de confirmação ou erro.
 */
function adicionarContaAPagar(sheetId, dadosConta) {
  if (!sheetId || !dadosConta) {
    throw new Error("Dados insuficientes para adicionar a conta.");
  }

  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS_A_PAGAR);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.trim());
    const idUnico = Utilities.getUuid().substring(0, 8);

    const novaLinha = headers.map(header => {
      switch (header) {
        case 'ID': return idUnico;
        case 'Descricao': return dadosConta.Descricao;
        case 'Valor': return dadosConta.Valor;
        case 'Data de Vencimento': return dadosConta['Data de Vencimento'];
        case 'Categoria': return dadosConta.Categoria;
        case 'Subcategoria': return dadosConta.Subcategoria || '';
        case 'Conta de Pagamento Sugerida': return dadosConta['Conta de Pagamento Sugerida'] || '';
        case 'Status': return 'Pendente';
        case 'Recorrente': return dadosConta.Recorrente || 'Falso';
        default: return '';
      }
    });

    sheet.appendRow(novaLinha);

    // Formata a célula da data para não mostrar a hora
    const lastRow = sheet.getLastRow();
    const dateColIndex = headers.indexOf('Data de Vencimento');
    if (dateColIndex !== -1) {
        sheet.getRange(lastRow, dateColIndex + 1).setNumberFormat("dd/MM/yyyy");
    }

    return `✅ Nova conta a pagar "${dadosConta.Descricao}" adicionada com sucesso!`;

  } catch (e) {
    Logger.log(`ERRO em adicionarContaAPagar: ${e.stack}`);
    return `❌ Ocorreu um erro ao adicionar a nova conta: ${e.message}`;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Adiciona um valor a uma meta específica na aba 'Metas'.
 * @param {string} sheetId O ID da folha de cálculo.
 * @param {string} metaNome O nome da meta a ser atualizada.
 * @param {number} valorParaAdicionar O valor a ser adicionado ao 'Valor Salvo'.
 * @returns {string} Uma mensagem de confirmação ou erro.
 */
function adicionarValorMeta(sheetId, metaNome, valorParaAdicionar) {
  if (!sheetId || !metaNome || !valorParaAdicionar) {
    throw new Error("Dados insuficientes para adicionar valor à meta.");
  }

  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.METAS);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.trim());
    const idxNome = headers.indexOf('Nome da Meta');
    const idxSalvo = headers.indexOf('Valor Salvo');

    if (idxNome === -1 || idxSalvo === -1) {
      throw new Error("Colunas 'Nome da Meta' ou 'Valor Salvo' não encontradas na aba 'Metas'.");
    }

    // Procura pela meta, ignorando maiúsculas/minúsculas e espaços extra
    const metaNomeNormalizado = metaNome.trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const nomeNaPlanilha = (data[i][idxNome] || '').trim().toLowerCase();
      if (nomeNaPlanilha.includes(metaNomeNormalizado)) {
        const valorAtual = parseFloat(data[i][idxSalvo] || 0);
        const novoValor = valorAtual + valorParaAdicionar;
        
        sheet.getRange(i + 1, idxSalvo + 1).setValue(novoValor);
        
        const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        return `✅ Valor adicionado! O novo total salvo para "*${data[i][idxNome]}*" é de *${formatter.format(novoValor)}*.`;
      }
    }

    return `⚠️ A meta contendo "${metaNome}" não foi encontrada.`;

  } catch (e) {
    Logger.log(`ERRO em adicionarValorMeta: ${e.stack}`);
    return `❌ Ocorreu um erro ao atualizar a sua meta: ${e.message}`;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cria uma nova meta na aba 'Metas'.
 * @param {string} sheetId O ID da folha de cálculo.
 * @param {object} dadosMeta Objeto com os dados da nova meta.
 * @returns {string} Uma mensagem de confirmação ou erro.
 */
function criarNovaMeta(sheetId, dadosMeta) {
  if (!sheetId || !dadosMeta || !dadosMeta['Nome da Meta'] || !dadosMeta['Valor Objetivo']) {
    throw new Error("Dados insuficientes para criar a meta.");
  }

  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.METAS);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.trim());
    
    const novaLinha = headers.map(header => {
      switch (header) {
        case 'Nome da Meta': return dadosMeta['Nome da Meta'];
        case 'Valor Objetivo': return dadosMeta['Valor Objetivo'];
        case 'Valor Salvo': return 0; // Começa sempre com 0
        case 'Data Alvo': return dadosMeta['Data Alvo'] || ''; // Opcional
        case 'Status': return 'Em Andamento';
        default: return '';
      }
    });

    sheet.appendRow(novaLinha);
    return `✅ Nova meta "*${dadosMeta['Nome da Meta']}*" criada com sucesso!`;

  } catch (e) {
    Logger.log(`ERRO em criarNovaMeta: ${e.stack}`);
    return `❌ Ocorreu um erro ao criar a nova meta: ${e.message}`;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Edita um campo específico de uma meta.
 * @param {string} sheetId O ID da folha de cálculo.
 * @param {string} nomeMetaOriginal O nome original da meta a ser editada.
 * @param {string} campo O campo a ser editado ('Nome da Meta', 'Valor Objetivo', 'Data Alvo').
 * @param {string} novoValor O novo valor para o campo.
 * @returns {string} Uma mensagem de confirmação ou erro.
 */
function editarMeta(sheetId, nomeMetaOriginal, campo, novoValor) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.METAS);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.trim());
    const idxNome = headers.indexOf('Nome da Meta');
    const idxCampo = headers.indexOf(campo);

    if (idxNome === -1 || idxCampo === -1) throw new Error(`Coluna 'Nome da Meta' ou '${campo}' não encontrada.`);

    for (let i = 1; i < data.length; i++) {
      if (data[i][idxNome] === nomeMetaOriginal) {
        sheet.getRange(i + 1, idxCampo + 1).setValue(novoValor);
        return `✅ Meta atualizada com sucesso! O campo '${campo}' foi alterado.`;
      }
    }
    return `⚠️ Meta "${nomeMetaOriginal}" não encontrada.`;
  } catch (e) {
    Logger.log(`ERRO em editarMeta: ${e.stack}`);
    return `❌ Ocorreu um erro ao editar a meta: ${e.message}`;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Exclui uma meta da folha de cálculo.
 * @param {string} sheetId O ID da folha de cálculo.
 * @param {string} nomeMeta O nome da meta a ser excluída.
 * @returns {string} Uma mensagem de confirmação ou erro.
 */
function excluirMeta(sheetId, nomeMeta) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.METAS);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.trim());
    const idxNome = headers.indexOf('Nome da Meta');

    if (idxNome === -1) throw new Error("Coluna 'Nome da Meta' não encontrada.");

    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][idxNome] === nomeMeta) {
        sheet.deleteRow(i + 1);
        return `✅ Meta "*${nomeMeta}*" excluída com sucesso!`;
      }
    }
    return `⚠️ Meta "${nomeMeta}" não encontrada.`;
  } catch (e) {
    Logger.log(`ERRO em excluirMeta: ${e.stack}`);
    return `❌ Ocorreu um erro ao excluir a meta: ${e.message}`;
  } finally {
    lock.releaseLock();
  }
}

