/**
 * @OnlyCurrentDoc
 *
 * VERSÃO 2.0 - COM ASSISTENTE CONVERSACIONAL
 * Lida com a interpretação de mensagens e a interação com o bot do Telegram.
 */

const CACHE_EXPIRATION_SECONDS = 300; // 5 minutos

function interpretarMensagemGenerica(sheetId, mensagemCompleta, chatId, userName) {
  if (!sheetId) return { type: 'message', text: 'Erro interno: ID da planilha não encontrado.' };
  
  try {
    const palavrasConsulta = ["quanto", "qual", "quais", "listar", "mostrar", "total"];
    const primeiraPalavra = mensagemCompleta.toLowerCase().split(' ')[0];

    if (palavrasConsulta.includes(primeiraPalavra)) {
      return { type: 'message', text: processarConsultaPorTexto(sheetId, mensagemCompleta) };
    }
    
    // --- LÓGICA DE LANÇAMENTO COM ASSISTENTE ---
    const ss = SpreadsheetApp.openById(sheetId);
    const palavrasChave = getSheetAndCreateIfNotExists(ss, SHEETS.PALAVRAS_CHAVE).getDataRange().getValues();
    const dadosContas = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS).getDataRange().getValues();
    
    const valor = extrairValor(mensagemCompleta);
    const tipoInfo = detectarTipoTransacao(mensagemCompleta.toLowerCase(), palavrasChave) || { tipo: 'Despesa', keyword: '' };
    const { conta } = interpretarConta(mensagemCompleta, dadosContas, ss);
    const { categoria, subcategoria } = interpretarCategoria(mensagemCompleta, palavrasChave);
    const descricao = extrairDescricao(mensagemCompleta, conta, tipoInfo.keyword, valor);
    const parcelas = extrairParcelas(mensagemCompleta);
    
    // Cria uma transação parcial com os dados que conseguiu extrair
    const transacaoParcial = {
      id: Utilities.getUuid().substring(0, 8),
      data: new Date(),
      descricao: descricao,
      valor: valor,
      tipo: tipoInfo.tipo,
      categoria: categoria,
      subcategoria: subcategoria,
      conta: conta,
      parcelasTotais: parcelas,
      usuario: userName
    };

    // Verifica os dados em falta e pede ao utilizador
    if (!transacaoParcial.valor) {
      return solicitarInformacaoFaltante("valor", transacaoParcial, chatId);
    }
    if (!transacaoParcial.conta) {
      return solicitarInformacaoFaltante("conta", transacaoParcial, chatId, dadosContas);
    }
    if (!transacaoParcial.categoria) {
      return solicitarInformacaoFaltante("categoria", transacaoParcial, chatId, ss);
    }
    
    // Se todos os dados estiverem presentes, regista a transação
    return registrarTransacaoFinal(sheetId, transacaoParcial);

  } catch (e) {
    Logger.log(`[BOT ERRO FATAL] Erro em interpretarMensagemGenerica: ${e.stack}`);
    return { type: 'message', text: "Ocorreu um erro ao interpretar a sua mensagem: " + e.message };
  }
}

// --- LÓGICA DE LANÇAMENTO (REFINADA) ---
function adicionarLancamentoPorTexto(sheetId, text, chatId, userName) {
    Logger.log(`[BOT] A interpretar como um novo lançamento...`);
    const ss = SpreadsheetApp.openById(sheetId);
    const palavrasChave = getSheetAndCreateIfNotExists(ss, SHEETS.PALAVRAS_CHAVE).getDataRange().getValues();
    const dadosContas = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS).getDataRange().getValues();
    
    const valor = extrairValor(text);
    Logger.log(`[BOT DADO] Valor extraído: ${valor}`);

    const tipoInfo = detectarTipoTransacao(text.toLowerCase(), palavrasChave) || { tipo: 'Despesa', keyword: '' };
    Logger.log(`[BOT DADO] Tipo detectado: ${tipoInfo.tipo} (palavra-chave: "${tipoInfo.keyword}")`);

    const { conta, infoConta } = interpretarConta(text, dadosContas, ss);
    Logger.log(`[BOT DADO] Conta interpretada: ${conta}`);
    
    const { categoria, subcategoria } = interpretarCategoria(text, palavrasChave);
    Logger.log(`[BOT DADO] Categoria: ${categoria} | Subcategoria: ${subcategoria}`);

    const descricao = extrairDescricao(text, conta, tipoInfo.keyword, valor);
    Logger.log(`[BOT DADO] Descrição calculada: "${descricao}"`);

    const parcelas = extrairParcelas(text);
    Logger.log(`[BOT DADO] Parcelas: ${parcelas}`);

    const transacaoParcial = {
      id: Utilities.getUuid().substring(0, 8), data: new Date(), descricao: descricao,
      valor: valor, tipo: tipoInfo.tipo, categoria: categoria, subcategoria: subcategoria,
      conta: conta, infoConta: infoConta, metodoPagamento: null, parcelasTotais: parcelas, usuario: userName
    };

    if (!valor) {
      Logger.log(`[BOT AÇÃO] Valor em falta. A solicitar ao utilizador.`);
      return solicitarInformacaoFaltante("valor", transacaoParcial, chatId);
    }
    if (!conta) {
      Logger.log(`[BOT AÇÃO] Conta em falta. A solicitar ao utilizador.`);
      return solicitarInformacaoFaltante("conta", transacaoParcial, chatId, dadosContas);
    }
    if (!categoria) {
      Logger.log(`[BOT AÇÃO] Categoria em falta. A solicitar ao utilizador.`);
      return solicitarInformacaoFaltante("categoria", transacaoParcial, chatId, ss);
    }
    
    Logger.log(`[BOT AÇÃO] Todos os dados foram recolhidos. A registar transação.`);
    return registrarTransacao(ss, transacaoParcial, chatId);
}

function solicitarInformacaoFaltante(campo, transacaoParcial, chatId, dadosPlanilha = null) {
  let mensagem = "";
  let options = [];
  const cacheKey = `ASSISTANT_${chatId}`;
  
  transacaoParcial.waitingFor = campo; // Guarda o que o assistente está a perguntar

  switch (campo) {
    case 'valor':
      mensagem = "Não consegui identificar o valor. Pode dizer-me qual foi?";
      // Para valor, não há botões, esperamos que o utilizador digite.
      break;
    case 'conta':
      mensagem = "De qual conta ou cartão devo registar este lançamento?";
      options = dadosPlanilha.slice(1).map(row => row[0]).filter(Boolean);
      break;
    case 'categoria':
      mensagem = "Em qual categoria este lançamento se encaixa?";
      const categoriasSheet = getSheetAndCreateIfNotExists(dadosPlanilha, SHEETS.CATEGORIAS);
      options = [...new Set(categoriasSheet.getDataRange().getValues().slice(1).map(row => row[0]))].filter(Boolean);
      break;
  }
  
  transacaoParcial.assistantOptions = options;
  CacheService.getScriptCache().put(cacheKey, JSON.stringify(transacaoParcial), CACHE_EXPIRATION_SECONDS);

  const teclado = { 
    inline_keyboard: options.map((opt, i) => ([{ text: opt, callback_data: `assist_complete_${campo}_${i}` }])) 
  };
  
  return { type: 'question', text: mensagem, options: JSON.stringify(teclado) };
}

function continuarAssistente(sheetId, chatId, callbackData) {
    const cacheKey = `ASSISTANT_${chatId}`;
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (!cached) return { type: 'message', text: "Esta ação expirou. Por favor, envie o lançamento novamente." };

    const transacaoParcial = JSON.parse(cached);
    const [, , campo, index] = callbackData.split('_');
    const valorSelecionado = transacaoParcial.assistantOptions[parseInt(index)];

    transacaoParcial[campo] = valorSelecionado; // Preenche a informação que faltava
    delete transacaoParcial.waitingFor;
    delete transacaoParcial.assistantOptions;

    const ss = SpreadsheetApp.openById(sheetId);
    
    // Verifica novamente se falta algo mais
    if (!transacaoParcial.conta) return solicitarInformacaoFaltante("conta", transacaoParcial, chatId, ss.getSheetByName(SHEETS.CONTAS).getDataRange().getValues());
    if (!transacaoParcial.categoria) return solicitarInformacaoFaltante("categoria", transacaoParcial, chatId, ss);
    
    // Se tudo estiver completo, regista a transação
    CacheService.getScriptCache().remove(cacheKey);
    return registrarTransacaoFinal(sheetId, transacaoParcial);
}

function registrarTransacao(ss, transacaoData, chatId) {
  try {
    Logger.log(`[BOT REGISTO] A iniciar o registo da transação. Dados: ${JSON.stringify(transacaoData)}`);
    const infoConta = obterInfoCartao(transacaoData.conta, ss);
    transacaoData.metodoPagamento = obterMetodoDePagamentoPadrao(infoConta);
    Logger.log(`[BOT REGISTO] Método de pagamento definido como: ${transacaoData.metodoPagamento}`);

    const formData = {
        data: transacaoData.data, descricao: transacaoData.descricao, valor: transacaoData.valor.toString(),
        tipo: transacaoData.tipo, categoria: transacaoData.categoria, subcategoria: transacaoData.subcategoria,
        conta: transacaoData.conta, metodoPagamento: transacaoData.metodoPagamento, parcelasTotais: transacaoData.parcelasTotais
    };

    // Esta é a chamada para a função em Core.gs que escreve na planilha
    adicionarLancamento(formData, transacaoData.usuario);
    Logger.log(`[BOT REGISTO] Função 'adicionarLancamento' executada com sucesso.`);

    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    let confirmacao = `✅ Lançamento registado!\n\n`;
    confirmacao += `*Descrição:* ${formData.descricao}\n`;
    confirmacao += `*Valor:* ${formatter.format(transacaoData.valor)}\n`;
    confirmacao += `*Categoria:* ${formData.categoria || 'N/A'}\n`;
    confirmacao += `*Conta:* ${formData.conta}`;
    
    Logger.log(`[BOT FIM] A enviar mensagem de confirmação.`);
    return { type: 'message', text: confirmacao };
  } catch (e) {
    Logger.log(`[BOT ERRO FATAL] Erro em registrarTransacao: ${e.stack}`);
    return { type: 'message', text: `Ocorreu um erro ao registar a sua transação: ${e.message}`};
  }
}

function registrarTransacaoFinal(sheetId, transacaoData) {
  const ss = SpreadsheetApp.openById(sheetId);
  const { conta, infoConta } = interpretarConta(transacaoData.conta, ss.getSheetByName(SHEETS.CONTAS).getDataRange().getValues(), ss);
  transacaoData.metodoPagamento = obterMetodoDePagamentoPadrao(infoConta);

  adicionarLancamento(sheetId, transacaoData);

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  let confirmacao = `✅ Lançamento registado!\n\n`;
  confirmacao += `*Descrição:* ${transacaoData.descricao}\n`;
  confirmacao += `*Valor:* ${formatter.format(transacaoData.valor)}\n`;
  confirmacao += `*Categoria:* ${transacaoData.categoria || 'N/A'}\n`;
  confirmacao += `*Conta:* ${transacaoData.conta}`;
  
  return { type: 'message', text: confirmacao };
}


function obterSaldoContas(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const contasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS);
    const dadosContas = contasSheet.getDataRange().getValues();

    if (dadosContas.length < 2) {
      return "Nenhuma conta encontrada na sua folha de cálculo.";
    }

    const headers = dadosContas[0];
    const idxSaldo = headers.indexOf('Saldo Atual');
    const idxTipo = headers.indexOf('Tipo');

    if (idxSaldo === -1 || idxTipo === -1) {
      throw new Error("Não foi possível encontrar as colunas 'Saldo Atual' ou 'Tipo' na aba 'Contas'.");
    }

    let saldoTotal = 0;
    for (let i = 1; i < dadosContas.length; i++) {
      const tipo = dadosContas[i][idxTipo];
      const saldo = parseFloat(dadosContas[i][idxSaldo] || 0);
      if (tipo !== 'Cartão de Crédito' && tipo !== 'Fatura Consolidada' && !isNaN(saldo)) {
        saldoTotal += saldo;
      }
    }

    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    return `💰 *Saldo Total em Contas:*\n${formatter.format(saldoTotal)}`;
  } catch (e) {
    Logger.log(`Erro em obterSaldoContas para sheetId ${sheetId}: ` + e.stack);
    return "Não foi possível calcular o seu saldo.";
  }
}

function obterResumoDoMes(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const transacoesSheet = getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS);
    const transacoesData = transacoesSheet.getDataRange().getValues();

    if (transacoesData.length < 2) {
      return "Nenhuma transação encontrada este mês.";
    }
    
    const headers = transacoesData[0];
    const idxData = headers.indexOf('Data');
    const idxTipo = headers.indexOf('Tipo');
    const idxValor = headers.indexOf('Valor');
    
    if (idxData === -1 || idxTipo === -1 || idxValor === -1) {
      throw new Error("Não foi possível encontrar as colunas 'Data', 'Tipo' ou 'Valor' na aba 'Transacoes'.");
    }

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    let totalReceitas = 0;
    let totalDespesas = 0;

    for (let i = 1; i < transacoesData.length; i++) {
      const linha = transacoesData[i];
      let dataTransacao = linha[idxData];

      if (dataTransacao && !(dataTransacao instanceof Date)) {
        dataTransacao = new Date(dataTransacao);
      }
      
      if (dataTransacao instanceof Date && !isNaN(dataTransacao) && dataTransacao.getMonth() === mesAtual && dataTransacao.getFullYear() === anoAtual) {
        const tipo = linha[idxTipo];
        const valor = parseFloat(linha[idxValor] || 0);
        
        if (tipo === 'Receita') {
          totalReceitas += valor;
        } else if (tipo === 'Despesa') {
          totalDespesas += valor;
        }
      }
    }

    const saldoMes = totalReceitas - totalDespesas;
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    let resumo = `📊 *Resumo de ${hoje.toLocaleString('pt-BR', { month: 'long' })}:*\n\n`;
    resumo += `🟢 *Receitas:* ${formatter.format(totalReceitas)}\n`;
    resumo += `🔴 *Despesas:* ${formatter.format(totalDespesas)}\n`;
    resumo += `--------------------\n`;
    resumo += `⚖️ *Saldo do Mês:* ${formatter.format(saldoMes)}`;

    return resumo;

  } catch (e) {
    Logger.log(`Erro em obterResumoDoMes para sheetId ${sheetId}: ` + e.stack);
    return "Não foi possível gerar o seu resumo mensal.";
  }
}

