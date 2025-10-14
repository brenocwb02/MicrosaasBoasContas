/**
 * @OnlyCurrentDoc
 *
 * VERSÃO 3.6 - CONSULTAS EM LINGUAGEM NATURAL
 * Lida com a interpretação de mensagens e a interação com o bot do Telegram.
 */

const CACHE_EXPIRATION_SECONDS = 300; // 5 minutos

// --- FUNÇÕES DE GESTÃO DE ESTADO (MEMÓRIA DO BOT) ---
function getUserState(chatId) {
  const cacheKey = `USER_STATE_${chatId}`;
  const cached = CacheService.getScriptCache().get(cacheKey);
  return cached ? JSON.parse(cached) : null;
}
function setUserState(chatId, state) {
  const cacheKey = `USER_STATE_${chatId}`;
  CacheService.getScriptCache().put(cacheKey, JSON.stringify(state), CACHE_EXPIRATION_SECONDS);
}
function clearUserState(chatId) {
  const cacheKey = `USER_STATE_${chatId}`;
  CacheService.getScriptCache().remove(cacheKey);
}

// --- MANIPULADOR PRINCIPAL DE RESPOSTAS (CORRIGIDO) ---
function handleTextMessageResponse(sheetId, chatId, text, state) {
    if (state.type === 'editing_tx') {
      return finalizarEdicao(sheetId, chatId, state, text);
    } else if (state.type === 'editing_bill') {
      return finalizarEdicaoConta(sheetId, chatId, state, text);
    } else if (state.type === 'assisting_new_tx') {
      return continuarAssistenteComTexto(sheetId, chatId, text, state);
    } else if (state.type === 'adding_new_bill') {
      return continuarAdicaoConta(sheetId, chatId, text, state);
    } else if (state.type === 'paying_variable_bill') {
      return continuarPagamentoVariavel(sheetId, chatId, text, state);
    } else if (state.type === 'adding_to_goal') {
      return finalizarAdicaoValorMeta(sheetId, chatId, text, state);
    } else if (state.type === 'creating_new_goal') {
      return continuarCriacaoMeta(sheetId, chatId, text, state);
    } else if (state.type === 'editing_goal') {
      return finalizarEdicaoMeta(sheetId, chatId, text, state);
    }
    clearUserState(chatId);
    return { type: 'message', text: 'Ocorreu um erro de contexto. Por favor, tente novamente.' };
}

// --- FLUXOS DE CRIAÇÃO, EDIÇÃO E EXCLUSÃO DE TRANSAÇÕES ---
function interpretarMensagemGenerica(sheetId, mensagemCompleta, chatId, userName) { 
  clearUserState(chatId);
  if (!sheetId) return { type: 'message', text: 'Erro interno: ID da planilha não encontrado.' };
  try {
    const palavrasConsulta = ["quanto", "qual", "quais", "listar", "mostrar", "total"];
    if (palavrasConsulta.includes(mensagemCompleta.toLowerCase().split(' ')[0])) {
      // CHAMA A NOVA FUNÇÃO DE CONSULTA
      const resultadoConsulta = processarConsultaPorTexto(sheetId, mensagemCompleta);
      return { type: 'message', text: resultadoConsulta };
    }

    // Se não for uma consulta, continua com a lógica de novo lançamento...
    const ss = SpreadsheetApp.openById(sheetId);
    const palavrasChave = getSheetAndCreateIfNotExists(ss, SHEETS.PALAVRAS_CHAVE).getDataRange().getValues();
    const dadosContas = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS).getDataRange().getValues();
    const valor = extrairValor(mensagemCompleta);
    const tipoInfo = detectarTipoTransacao(mensagemCompleta.toLowerCase(), palavrasChave) || { tipo: 'Despesa', keyword: '' };
    const { conta, infoConta } = interpretarConta(mensagemCompleta, dadosContas, ss);
    const { categoria, subcategoria } = interpretarCategoria(mensagemCompleta, palavrasChave, ss);
    const descricao = extrairDescricao(mensagemCompleta, conta, tipoInfo.keyword, valor);
    const parcelas = extrairParcelas(mensagemCompleta);
    const metodoPagamento = obterMetodoDePagamentoPadrao(infoConta);
    const transacaoParcial = {
      data: new Date(), descricao: descricao, valor: valor, tipo: tipoInfo.tipo,
      categoria: categoria, subcategoria: subcategoria, conta: conta,
      parcelasTotais: parcelas, usuario: userName, metodoPagamento: metodoPagamento
    };
    return verificarEColetarDados(sheetId, chatId, transacaoParcial);
  } catch (e) {
    Logger.log(`[BOT ERRO FATAL] Erro em interpretarMensagemGenerica: ${e.stack}`);
    return { type: 'message', text: "Ocorreu um erro ao interpretar a sua mensagem: " + e.message };
  }
}
function verificarEColetarDados(sheetId, chatId, transacaoParcial) { 
    const ss = SpreadsheetApp.openById(sheetId);
    if (!transacaoParcial.valor) {
      return solicitarInformacaoFaltante("valor", transacaoParcial, chatId);
    }
    if (!transacaoParcial.conta) {
      const dadosContas = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS).getDataRange().getValues();
      return solicitarInformacaoFaltante("conta", transacaoParcial, chatId, dadosContas);
    }
    if (!transacaoParcial.categoria) {
      return solicitarInformacaoFaltante("categoria", transacaoParcial, chatId, ss);
    }
    return solicitarConfirmacaoLancamento(chatId, transacaoParcial);
}
function solicitarInformacaoFaltante(campo, transacaoParcial, chatId, dadosPlanilha) { 
  let mensagem = "";
  let options = [];
  const state = { type: 'assisting_new_tx', data: transacaoParcial, waitingFor: campo };

  switch (campo) {
    case 'valor':
      mensagem = `Não consegui identificar o valor para "${transacaoParcial.descricao}". Pode dizer-me qual foi?`;
      break;
    case 'conta':
      mensagem = "De qual conta ou cartão devo registar este lançamento?";
      options = dadosPlanilha.slice(1).map(row => row[0]).filter(Boolean);
      state.data.options = options;
      break;
    case 'categoria':
      mensagem = "Em qual categoria este lançamento se encaixa?";
      const categoriasSheet = getSheetAndCreateIfNotExists(dadosPlanilha, SHEETS.CATEGORIAS);
      options = [...new Set(categoriasSheet.getDataRange().getValues().slice(1).map(row => row[0]))].filter(Boolean);
      state.data.options = options;
      break;
  }
  setUserState(chatId, state);
  const teclado = { inline_keyboard: options.map((opt, i) => ([{ text: opt, callback_data: `assist_complete_${campo}_${i}` }])) };
  return { type: 'question', text: mensagem, options: JSON.stringify(teclado) };
}
function continuarAssistente(sheetId, chatId, callbackData, state) { 
    const transacaoParcial = state.data;
    const [, , campo, index] = callbackData.split('_');
    const valorSelecionado = transacaoParcial.options[parseInt(index)];
    transacaoParcial[campo] = valorSelecionado;
    return verificarEColetarDados(sheetId, chatId, transacaoParcial);
}
function continuarAssistenteComTexto(sheetId, chatId, textoResposta, state) { 
  const transacaoParcial = state.data;
  const campoEsperado = state.waitingFor;

  if (campoEsperado === 'valor') {
    const valorExtraido = extrairValor(textoResposta);
    if (valorExtraido === null) {
      setUserState(chatId, state);
      return { type: 'message', text: "Não entendi. Por favor, envie apenas o valor numérico." };
    }
    transacaoParcial.valor = valorExtraido;
  } else {
    transacaoParcial[campoEsperado] = textoResposta;
  }
  return verificarEColetarDados(sheetId, chatId, transacaoParcial);
}
function solicitarConfirmacaoLancamento(chatId, transacaoData) {
  const state = { type: 'confirming_new_tx', data: transacaoData };
  setUserState(chatId, state);

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transacaoData.valor);
  
  let texto = `Entendido! Registrado. Por favor, confirme se está tudo certo:\n\n`;
  texto += `*Tipo:* ${transacaoData.tipo || 'N/A'}\n`;
  texto += `*Descrição:* ${transacaoData.descricao || 'N/A'}\n`;
  texto += `*Valor:* ${formatter}\n`;
  texto += `*Conta:* ${transacaoData.conta || 'N/A'}\n`;
  texto += `*Método:* ${transacaoData.metodoPagamento || 'N/A'}\n`;
  texto += `*Categoria:* ${transacaoData.categoria || 'N/A'}\n`;
  if (transacaoData.subcategoria && transacaoData.subcategoria.trim() !== '') {
      texto += `*Subcategoria:* ${transacaoData.subcategoria}\n`;
  }
  if (transacaoData.parcelasTotais > 1) {
      texto += `*Parcelas:* ${transacaoData.parcelasTotais}\n`;
  }

  const teclado = {
    inline_keyboard: [[
      { text: "✅ Confirmar", callback_data: `confirm_tx_new` },
      { text: "❌ Cancelar", callback_data: `cancel_action` }
    ]]
  };

  return { type: 'question', text: texto, options: JSON.stringify(teclado) };
}
function registrarTransacaoFinal(sheetId, transacaoData) { 
  try {
    const resultado = adicionarLancamento(sheetId, transacaoData);
    if (!resultado || !resultado.transactionId) {
      return { type: 'message', text: resultado.message || "Ocorreu um erro desconhecido ao registar." };
    }

    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transacaoData.valor);
    let confirmacao = `✅ ${resultado.message}\n\n`;
    confirmacao += `*Descrição:* ${transacaoData.descricao}\n`;
    confirmacao += `*Valor:* ${formatter}\n`;
    confirmacao += `*Categoria:* ${transacaoData.categoria || 'N/A'}\n`;
    confirmacao += `*Conta:* ${transacaoData.conta}`;

    const teclado = {
      inline_keyboard: [[
        { text: "✏️ Editar", callback_data: `edit_tx_${resultado.transactionId}` },
        { text: "🗑️ Excluir", callback_data: `delete_tx_${resultado.transactionId}` }
      ]]
    };
    return { type: 'question', text: confirmacao, options: JSON.stringify(teclado) };
  } catch(e) {
      Logger.log(`ERRO CRÍTICO em registrarTransacaoFinal: ${e.stack}`);
      return { type: 'message', text: `❌ Falha ao registar o lançamento: ${e.message}`};
  }
}
function obterNomesDeContas(sheetId) { 
  const ss = SpreadsheetApp.openById(sheetId);
  const contasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS);
  if (contasSheet.getLastRow() < 2) return [];
  return contasSheet.getRange('A2:A').getValues().map(row => row[0]).filter(String);
}
function handleTransactionActionCallback(sheetId, chatId, callbackData) {
  try {
    const parts = callbackData.split('_');
    const action = parts[0];
    const type = parts[1];
    const id = parts[2];

    if (action === 'confirm' && type === 'tx' && id === 'new') {
        const state = getUserState(chatId);
        if (state && state.type === 'confirming_new_tx') {
            const resultado = registrarTransacaoFinal(sheetId, state.data);
            clearUserState(chatId);
            return resultado;
        } else {
            return { type: 'message', text: 'Esta confirmação expirou.' };
        }
    }

    const transactionId = id;

    if (action === 'delete') {
      if (transactionId === 'confirm') {
        const idToDelete = parts[3];
        const resultado = excluirLancamento(sheetId, idToDelete);
        clearUserState(chatId);
        return { type: 'message', text: resultado };
      } else {
        return { type: 'question', text: "Tem a certeza que deseja excluir?", options: JSON.stringify({ inline_keyboard: [[{ text: "✅ Sim, excluir", callback_data: `delete_tx_confirm_${transactionId}`}, { text: "❌ Não", callback_data: `cancel_action` }]]}) };
      }
    } else if (action === 'edit') {
      const step = parts[3];
      const fieldName = parts[4];
      if (!step) {
        const teclado = { inline_keyboard: [[{ text: "📝 Descrição", callback_data: `edit_tx_${transactionId}_field_Descricao` }], [{ text: "💰 Valor", callback_data: `edit_tx_${transactionId}_field_Valor` }], [{ text: "🏷️ Categoria", callback_data: `edit_tx_${transactionId}_field_Categoria` }], [{ text: "💳 Conta/Cartão", callback_data: `edit_tx_${transactionId}_field_Conta/Cartão` }], [{ text: "❌ Cancelar", callback_data: `cancel_action` }]]};
        return { type: 'question', text: "O que você gostaria de editar?", options: JSON.stringify(teclado) };
      } else if (step === 'field') {
        if (fieldName === 'Conta/Cartão') {
          const contas = obterNomesDeContas(sheetId);
          if (contas.length === 0) return { type: 'message', text: "Nenhuma conta encontrada." };
          const teclado = { inline_keyboard: contas.map(conta => ([{ text: conta, callback_data: `edit_tx_${transactionId}_update_Conta/Cartão_${conta}` }])) };
          teclado.inline_keyboard.push([{ text: "❌ Cancelar", callback_data: `cancel_action` }]);
          return { type: 'question', text: `Selecione a nova Conta/Cartão:`, options: JSON.stringify(teclado) };
        } else {
          setUserState(chatId, { type: 'editing_tx', transactionId: transactionId, fieldToEdit: fieldName, chatId: chatId });
          return { type: 'message', text: `OK. Por favor, envie o novo valor para '${fieldName}'.` };
        }
      } else if (step === 'update') {
        const novoValor = parts.slice(5).join('_');
        const resultado = editarLancamento(sheetId, transactionId, fieldName, novoValor);
        clearUserState(chatId);
        return { type: 'message', text: resultado };
      }
    } else if (action === 'cancel') {
        clearUserState(chatId);
        return { type: 'message', text: "Operação cancelada." };
    }
    return { type: 'message', text: "Ação não reconhecida." };
  } catch (e) {
    Logger.log(`ERRO em handleTransactionActionCallback: ${e.stack}`);
    return { type: 'message', text: "Ocorreu um erro." };
  }
}
function finalizarEdicao(sheetId, chatId, state, novoValor) {
  try {
    const { transactionId, fieldToEdit } = state;
    if (fieldToEdit === 'Valor') {
      const valorNumerico = extrairValor(novoValor);
      if (valorNumerico === null) return { type: 'message', text: "❌ Valor inválido." };
      novoValor = valorNumerico;
    }
    const resultado = editarLancamento(sheetId, transactionId, fieldToEdit, novoValor);
    clearUserState(chatId);
    return { type: 'message', text: resultado };
  } catch (e) {
    Logger.log(`ERRO em finalizarEdicao: ${e.stack}`);
    return { type: 'message', text: `Ocorreu um erro.` };
  }
}


// --- FLUXO DE CONTAS A PAGAR ---
function handleBillActionCallback(sheetId, chatId, callbackData) {
  try {
    const parts = callbackData.split('_'); 
    
    if (parts[0] === 'addbill') {
        if (parts[1] === 'category') return continuarAdicaoContaComCategoria(sheetId, chatId, callbackData);
        if (parts[1] === 'subcategory') return continuarAdicaoContaComSubcategoria(sheetId, chatId, callbackData);
        if (parts[1] === 'account') return finalizarAdicaoContaComConta(sheetId, chatId, callbackData);
    }

    const action = parts[1];
    const step = parts[2];
    
    if (action === 'pay' && step === 'confirm') {
        const idDaContaAPagar = parts[3];
        const valorOpcional = parseFloat(parts[4]) || null;
        const contaDePagamento = parts.slice(5).join('_');
        const resultado = pagarContaAPagar(sheetId, idDaContaAPagar, contaDePagamento, valorOpcional);
        clearUserState(chatId);
        return { type: 'message', text: resultado };

    } else if (action === 'pay') {
        const billId = step;
        const detalhesConta = obterDetalhesContaAPagar(sheetId, billId);
        if (!detalhesConta) return { type: 'message', text: "Não foi possível encontrar os detalhes desta conta." };
        const valor = parseFloat(detalhesConta.Valor || 0);
        if (valor === 0) {
            setUserState(chatId, { type: 'paying_variable_bill', billId: billId, data: detalhesConta });
            return { type: 'message', text: `A conta "${detalhesConta.Descricao}" é de valor variável. Qual o *valor a pagar* este mês?` };
        } else {
            return perguntarContaDePagamento(sheetId, chatId, billId, null);
        }
    } 
    else if (action === 'edit' && step === 'field') {
        const billId = parts[3];
        const fieldName = parts[4];
        setUserState(chatId, { type: 'editing_bill', billId: billId, fieldToEdit: fieldName, chatId: chatId });
        let promptMessage = `OK. Envie o novo valor para '${fieldName}'.`;
        if (fieldName === 'Data de Vencimento') promptMessage += " (DD/MM/AAAA)";
        return { type: 'message', text: promptMessage };
    } else if (action === 'edit') {
        const billId = step;
        const teclado = {
          inline_keyboard: [
            [{ text: "📝 Descrição", callback_data: `bill_edit_field_${billId}_Descricao` }],
            [{ text: "💰 Valor", callback_data: `bill_edit_field_${billId}_Valor` }],
            [{ text: "🗓️ Data de Vencimento", callback_data: `bill_edit_field_${billId}_Data de Vencimento` }],
            [{ text: "❌ Cancelar", callback_data: `cancel_action` }]
          ]};
        return { type: 'question', text: "O que gostaria de editar?", options: JSON.stringify(teclado) };
    }

    clearUserState(chatId);
    return { type: 'message', text: "Ação de conta desconhecida ou expirada." };

  } catch (e) {
    Logger.log(`ERRO em handleBillActionCallback: ${e.stack}`);
    clearUserState(chatId);
    return { type: 'message', text: "Ocorreu um erro ao processar a ação da conta." };
  }
}
function finalizarEdicaoConta(sheetId, chatId, state, novoValor) {
  try {
    const { billId, fieldToEdit } = state;
    const resultado = editarContaAPagar(sheetId, billId, fieldToEdit, novoValor);
    clearUserState(chatId);
    return { type: 'message', text: resultado };
  } catch (e) {
    Logger.log(`ERRO em finalizarEdicaoConta: ${e.stack}`);
    return { type: 'message', text: `Ocorreu um erro.` };
  }
}
function iniciarAdicaoConta(sheetId, chatId) {
  clearUserState(chatId);
  const novaConta = {};
  const state = { type: 'adding_new_bill', data: novaConta, step: 'Descricao' };
  setUserState(chatId, state);
  return { type: 'message', text: "Vamos adicionar uma nova conta a pagar.\n\nPrimeiro, qual é a *descrição* da conta? (ex: Netflix, Aluguel)" };
}
function continuarAdicaoConta(sheetId, chatId, resposta, state) {
  const conta = state.data;
  const stepAtual = state.step;
  if (stepAtual === 'Valor') {
    const valorNumerico = parseFloat(String(resposta).replace(',', '.'));
    if (isNaN(valorNumerico)) {
      setUserState(chatId, state);
      return { type: 'message', text: "❌ Valor inválido. Por favor, envie apenas o número (ex: 350 ou 0)." };
    }
    conta[stepAtual] = valorNumerico;
  } else if (stepAtual === 'Data de Vencimento') {
    let novaData;
    const parts = resposta.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(p => parseInt(p));
      const anoCompleto = year < 100 ? 2000 + year : year;
      novaData = new Date(anoCompleto, month - 1, day);
    } else { novaData = new Date(resposta); }
    if (isNaN(novaData.getTime())) {
      setUserState(chatId, state);
      return { type: 'message', text: "❌ Formato de data inválido. Por favor, use DD/MM/AAAA (ex: 15/12/2025)." };
    }
    conta[stepAtual] = novaData;
  } else {
    conta[stepAtual] = resposta;
  }
  
  let proximoStep = null;
  let proximaPergunta = "";
  if (stepAtual === 'Descricao') {
    proximoStep = 'Valor';
    proximaPergunta = "Qual é o *valor* da conta? (Envie 0 se for um valor variável)";
  } else if (stepAtual === 'Valor') {
    proximoStep = 'Data de Vencimento';
    proximaPergunta = "Qual é a *data de vencimento*? (DD/MM/AAAA)";
  } else if (stepAtual === 'Data de Vencimento') {
    state.step = 'Categoria';
    setUserState(chatId, state);
    const categorias = obterCategoriasDisponiveis(sheetId);
    if (categorias.length === 0) {
      clearUserState(chatId);
      return { type: 'message', text: "Não encontrei nenhuma categoria." };
    }
    const teclado = { inline_keyboard: categorias.map(cat => ([{ text: cat, callback_data: `addbill_category_${cat}` }])) };
    teclado.inline_keyboard.push([{ text: "❌ Cancelar", callback_data: `cancel_action` }]);
    return { type: 'question', text: "Selecione a *categoria* para esta conta:", options: JSON.stringify(teclado) };
  } 

  if (proximoStep) {
    state.step = proximoStep;
    setUserState(chatId, state);
    return { type: 'message', text: proximaPergunta };
  } else {
    clearUserState(chatId);
    return { type: 'message', text: "Ocorreu um erro no fluxo. Comece de novo com /novaconta." };
  }
}
function continuarAdicaoContaComCategoria(sheetId, chatId, callbackData) {
    const state = getUserState(chatId);
    if (!state || state.type !== 'adding_new_bill' || state.step !== 'Categoria') {
        return { type: 'message', text: "Esta ação expirou. Por favor, comece de novo com /novaconta." };
    }
    const conta = state.data;
    const categoriaSelecionada = callbackData.substring('addbill_category_'.length);
    conta['Categoria'] = categoriaSelecionada;
    
    const subcategorias = obterSubcategoriasPorCategoria(sheetId, categoriaSelecionada);
    if (subcategorias.length === 0) {
        conta['Subcategoria'] = 'N/A';
        state.step = 'Conta de Pagamento Sugerida';
        setUserState(chatId, state);
        return perguntarContaDePagamentoParaNovaConta(sheetId, chatId);
    } else {
        state.step = 'Subcategoria';
        setUserState(chatId, state);
        const teclado = { inline_keyboard: subcategorias.map(sub => ([{ text: sub, callback_data: `addbill_subcategory_${sub}` }])) };
        teclado.inline_keyboard.push([{ text: "Nenhuma (N/A)", callback_data: `addbill_subcategory_N/A` }]);
        teclado.inline_keyboard.push([{ text: "❌ Cancelar", callback_data: `cancel_action` }]);
        return { type: 'question', text: "Selecione a *subcategoria*:", options: JSON.stringify(teclado) };
    }
}
function continuarAdicaoContaComSubcategoria(sheetId, chatId, callbackData) {
    const state = getUserState(chatId);
    if (!state || state.type !== 'adding_new_bill' || state.step !== 'Subcategoria') {
        return { type: 'message', text: "Esta ação expirou. Por favor, comece de novo com /novaconta." };
    }
    const conta = state.data;
    const subcategoriaSelecionada = callbackData.substring('addbill_subcategory_'.length);
    conta['Subcategoria'] = subcategoriaSelecionada;
    state.step = 'Conta de Pagamento Sugerida';
    setUserState(chatId, state);
    return perguntarContaDePagamentoParaNovaConta(sheetId, chatId);
}
function perguntarContaDePagamentoParaNovaConta(sheetId, chatId){
    const contas = obterNomesDeContas(sheetId);
    if (contas.length === 0) {
      clearUserState(chatId);
      return { type: 'message', text: "Não encontrei nenhuma conta de pagamento." };
    }
    const teclado = { inline_keyboard: contas.map(c => ([{ text: c, callback_data: `addbill_account_${c}` }])) };
    teclado.inline_keyboard.push([{ text: "❌ Cancelar", callback_data: `cancel_action` }]);
    return { type: 'question', text: "Selecione a *conta sugerida para pagamento*:", options: JSON.stringify(teclado) };
}
function finalizarAdicaoContaComConta(sheetId, chatId, callbackData) {
  const state = getUserState(chatId);
  if (!state || state.type !== 'adding_new_bill' || state.step !== 'Conta de Pagamento Sugerida') {
      return { type: 'message', text: "Esta ação expirou. Por favor, comece de novo com /novaconta." };
  }
  const conta = state.data;
  conta['Conta de Pagamento Sugerida'] = callbackData.substring('addbill_account_'.length);
  const resultado = adicionarContaAPagar(sheetId, conta);
  clearUserState(chatId);
  return { type: 'message', text: resultado };
}
function perguntarContaDePagamento(sheetId, chatId, billId, valorVariavel) { 
  const contas = obterNomesDeContas(sheetId).filter(c => !c.toLowerCase().includes('fatura'));
  if (contas.length === 0) return { type: 'message', text: "Nenhuma conta de pagamento encontrada." };
  
  const valorParaCallback = valorVariavel !== null ? valorVariavel : '0';
  const teclado = {
      inline_keyboard: contas.map(conta => ([{ text: conta, callback_data: `bill_pay_confirm_${billId}_${valorParaCallback}_${conta}` }]))
  };
  teclado.inline_keyboard.push([{ text: "❌ Cancelar", callback_data: `cancel_action` }]);
  return { type: 'question', text: `De qual conta deseja pagar esta despesa?`, options: JSON.stringify(teclado) };
}
function continuarPagamentoVariavel(sheetId, chatId, textoResposta, state) {
  const valor = extrairValor(textoResposta);
  if (valor === null || valor <= 0) {
    setUserState(chatId, state);
    return { type: 'message', text: "❌ Valor inválido. Por favor, envie apenas o número (ex: 350,99)." };
  }
  return perguntarContaDePagamento(sheetId, chatId, state.billId, valor);
}

function finalizarAdicaoContaComCategoria(sheetId, chatId, callbackData) {
  const state = getUserState(chatId);
  if (!state || state.type !== 'adding_new_bill' || state.step !== 'Categoria') {
      return { type: 'message', text: "Esta ação expirou ou o contexto foi perdido. Por favor, comece de novo com /novaconta." };
  }
  const conta = state.data;
  conta['Categoria'] = callbackData.substring('addbill_category_'.length);
  const resultado = adicionarContaAPagar(sheetId, conta);
  clearUserState(chatId);
  return { type: 'message', text: resultado };
}


// --- FLUXO DE GESTÃO DE METAS (ATUALIZADO) ---

function handleGoalActionCallback(sheetId, chatId, callbackData) {
  try {
    const parts = callbackData.split('_'); 
    const action = parts[1];
    const metaNome = parts.slice(2).join('_');

    if (action === 'add') {
      setUserState(chatId, { type: 'adding_to_goal', metaNome: metaNome });
      return { type: 'message', text: `Quanto deseja adicionar à sua meta "*${metaNome}*"?` };
    } 
    else if (action === 'manage') {
      const teclado = {
        inline_keyboard: [
          [{ text: "✏️ Editar Nome", callback_data: `goal_edit_field_Nome da Meta_${metaNome}` }],
          [{ text: "💰 Editar Valor Objetivo", callback_data: `goal_edit_field_Valor Objetivo_${metaNome}` }],
          [{ text: "🗑️ Excluir Meta", callback_data: `goal_delete_${metaNome}` }],
          [{ text: "⬅️ Voltar", callback_data: `goal_cancel_manage` }]
        ]
      };
      return { type: 'question', text: `Gerenciando a meta "*${metaNome}*". O que deseja fazer?`, options: JSON.stringify(teclado) };
    }
    else if (action === 'edit' && parts[2] === 'field') {
      const campo = parts[3];
      const nomeOriginal = parts.slice(4).join('_');
      setUserState(chatId, { type: 'editing_goal', metaNomeOriginal: nomeOriginal, campo: campo });
      return { type: 'message', text: `Qual o novo valor para "*${campo}*"?` };
    }
    else if (action === 'delete' && parts[2] === 'confirm') {
      const resultado = excluirMeta(sheetId, metaNome);
      clearUserState(chatId);
      return { type: 'message', text: resultado };
    }
    else if (action === 'delete') {
      const teclado = {
        inline_keyboard: [[
          { text: "✅ Sim, excluir", callback_data: `goal_delete_confirm_${metaNome}` },
          { text: "❌ Não", callback_data: `goal_cancel_manage` }
        ]]
      };
      return { type: 'question', text: `Tem a certeza que deseja excluir a meta "*${metaNome}*"? Esta ação não pode ser desfeita.`, options: JSON.stringify(teclado) };
    }
    else if (action === 'cancel' && parts[2] === 'manage'){
      // Simplesmente remove a mensagem com os botões
      return { type: 'message', text: `Gerenciamento da meta cancelado.`};
    }

    return { type: 'message', text: "Ação de meta desconhecida." };
  } catch(e) {
    Logger.log(`ERRO em handleGoalActionCallback: ${e.stack}`);
    return { type: 'message', text: "Ocorreu um erro ao processar a ação da meta." };
  }
}

function finalizarAdicaoValorMeta(sheetId, chatId, textoResposta, state) {
  const valor = extrairValor(textoResposta);
  if (valor === null || valor <= 0) {
    setUserState(chatId, state); // Mantém o estado para a próxima tentativa
    return { type: 'message', text: "❌ Valor inválido. Por favor, envie apenas o número." };
  }

  const { metaNome } = state;
  
  // Chama a função principal para salvar o valor na planilha
  const resultado = adicionarValorMeta(sheetId, metaNome, valor);
  
  clearUserState(chatId);
  return { type: 'message', text: resultado };
}

/**
 * Adiciona valor a uma meta através do comando de atalho /adicionarmeta.
 * @param {string} sheetId O ID da folha de cálculo.
 * @param {string} textoComando O texto completo enviado pelo utilizador (ex: "/adicionarmeta 150 Viagem")
 * @returns {object} A mensagem de resultado para o utilizador.
 */
function adicionarValorMetaPorComando(sheetId, textoComando) {
    try {
        const partes = textoComando.split(' ');
        if (partes.length < 3) {
            return { type: 'message', text: "Formato inválido. Use: `/adicionarmeta <valor> <nome da meta>`\nExemplo: `/adicionarmeta 150 Viagem de Férias`" };
        }
        
        const valor = parseFloat(partes[1].replace(',', '.'));
        if (isNaN(valor) || valor <= 0) {
            return { type: 'message', text: "O valor fornecido é inválido. Por favor, use um número." };
        }

        const nomeMeta = partes.slice(2).join(' ');
        
        const resultado = adicionarValorMeta(sheetId, nomeMeta, valor);
        return { type: 'message', text: resultado };

    } catch(e) {
        Logger.log(`ERRO em adicionarValorMetaPorComando: ${e.stack}`);
        return { type: 'message', text: "Ocorreu um erro ao processar o seu comando." };
    }
}

// --- FLUXO DE CRIAR METAS ---
function iniciarCriacaoMeta(sheetId, chatId) {
  clearUserState(chatId);
  const novaMeta = {};
  const state = { type: 'creating_new_goal', data: novaMeta, step: 'Nome da Meta' };
  setUserState(chatId, state);
  return { type: 'message', text: "Vamos criar uma nova meta! 🎯\n\nPrimeiro, qual é o *nome* do seu objetivo? (ex: Viagem para a praia)" };
}

function continuarCriacaoMeta(sheetId, chatId, resposta, state) {
  const meta = state.data;
  const stepAtual = state.step;

  if (stepAtual === 'Valor Objetivo') {
    const valorNumerico = parseFloat(String(resposta).replace(',', '.'));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      setUserState(chatId, state);
      return { type: 'message', text: "❌ Valor inválido. Por favor, envie um número maior que zero." };
    }
    meta[stepAtual] = valorNumerico;
  } else if (stepAtual === 'Data Alvo') {
    if (resposta.toLowerCase() === 'não' || resposta.toLowerCase() === 'nao') {
      meta[stepAtual] = null;
    } else {
      let novaData;
      const parts = resposta.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts.map(p => parseInt(p));
        const anoCompleto = year < 100 ? 2000 + year : year;
        novaData = new Date(anoCompleto, month - 1, day);
      } else {
          novaData = new Date(resposta);
      }
      if (isNaN(novaData.getTime())) {
        setUserState(chatId, state);
        return { type: 'message', text: "❌ Formato de data inválido. Por favor, use DD/MM/AAAA ou responda 'não'." };
      }
      meta[stepAtual] = novaData;
    }
  } else {
    meta[stepAtual] = resposta;
  }
  
  let proximoStep = null;
  let proximaPergunta = "";

  if (stepAtual === 'Nome da Meta') {
    proximoStep = 'Valor Objetivo';
    proximaPergunta = "Excelente! Qual é o *valor total* que precisa de poupar para este objetivo?";
  } else if (stepAtual === 'Valor Objetivo') {
    proximoStep = 'Data Alvo';
    proximaPergunta = "Qual é a *data limite* para alcançar esta meta? (DD/MM/AAAA)\n\n_(Se não houver uma data, pode responder 'não')_";
  } else if (stepAtual === 'Data Alvo') {
    const resultado = criarNovaMeta(sheetId, meta);
    clearUserState(chatId);
    return { type: 'message', text: resultado };
  }

  if (proximoStep) {
    state.step = proximoStep;
    setUserState(chatId, state);
    return { type: 'message', text: proximaPergunta };
  } else {
    clearUserState(chatId);
    return { type: 'message', text: "Ocorreu um erro no fluxo. Comece de novo com /novameta." };
  }
}

function finalizarEdicaoMeta(sheetId, chatId, novoValor, state) {
  try {
    const { metaNomeOriginal, campo } = state;
    const resultado = editarMeta(sheetId, metaNomeOriginal, campo, novoValor);
    clearUserState(chatId);
    return { type: 'message', text: resultado };
  } catch (e) {
    Logger.log(`ERRO em finalizarEdicaoMeta: ${e.stack}`);
    return { type: 'message', text: "Ocorreu um erro ao finalizar a edição da meta." };
  }
}
