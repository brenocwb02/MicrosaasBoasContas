/**
 * @OnlyCurrentDoc
 *
 * VERSÃO 2.5 - CORREÇÃO FINAL DA INTELIGÊNCIA DE CONSULTA
 * Funções responsáveis por processar consultas em linguagem natural.
 */

function processarConsultaPorTexto(sheetId, textoConsulta) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const transacoesSheet = getSheetAndCreateIfNotExists(ss, SHEETS.LANCAMENTOS);
    const transacoes = transacoesSheet.getDataRange().getValues();
    if (transacoes.length < 2) return "Não há transações para consultar.";

    const consultaNormalizada = textoConsulta.toLowerCase().replace('?', '');
    const headers = transacoes[0];

    const { dataInicio, dataFim, periodoTexto } = determinarPeriodo(consultaNormalizada);
    const tipoConsulta = consultaNormalizada.includes("listar") || consultaNormalizada.includes("quais") ? "LISTAR" : "SOMAR";
    let tipoTransacaoFiltro = null;
    if (consultaNormalizada.includes("receita")) tipoTransacaoFiltro = "Receita";
    else if (consultaNormalizada.includes("despesa") || consultaNormalizada.includes("gastei")) tipoTransacaoFiltro = "Despesa";

    const filtroTexto = extrairFiltroDeTexto(consultaNormalizada);

    let transacoesEncontradas = [];
    
    const idx = {
        data: headers.indexOf('Data'),
        tipo: headers.indexOf('Tipo'),
        descricao: headers.indexOf('Descricao'),
        categoria: headers.indexOf('Categoria'),
        subcategoria: headers.indexOf('Subcategoria'),
        conta: headers.indexOf('Conta/Cartão'),
        valor: headers.indexOf('Valor')
    };

    for (let i = 1; i < transacoes.length; i++) {
      const linha = transacoes[i];
      const dataTransacao = new Date(linha[idx.data]);
      if (!dataTransacao || isNaN(dataTransacao.getTime()) || dataTransacao < dataInicio || dataTransacao > dataFim) continue;

      const tipo = linha[idx.tipo];
      if (tipoTransacaoFiltro && tipo.toLowerCase() !== tipoTransacaoFiltro.toLowerCase()) continue;

      if (filtroTexto) {
        const descricao = (linha[idx.descricao] || '').toLowerCase();
        const categoria = (linha[idx.categoria] || '').toLowerCase();
        const subcategoria = (linha[idx.subcategoria] || '').toLowerCase();
        const conta = (linha[idx.conta] || '').toLowerCase();
        if (![descricao, categoria, subcategoria, conta].some(campo => campo.includes(filtroTexto))) continue;
      }
      
      transacoesEncontradas.push({
          data: dataTransacao,
          descricao: linha[idx.descricao],
          valor: parseFloat(linha[idx.valor] || 0),
          tipo: tipo
      });
    }

    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    
    if (tipoConsulta === "SOMAR") {
      let prefixo, totalSoma;
      
      if (tipoTransacaoFiltro === 'Receita') {
        prefixo = "O total de receitas";
        totalSoma = transacoesEncontradas.filter(t => t.tipo === 'Receita').reduce((acc, t) => acc + t.valor, 0);
      } else { 
        prefixo = "O total de despesas";
        totalSoma = transacoesEncontradas.filter(t => t.tipo === 'Despesa').reduce((acc, t) => acc + t.valor, 0);
      }
      
      return `${prefixo} ${filtroTexto ? `com "${filtroTexto}"` : ""} ${periodoTexto} é de: *${formatter.format(totalSoma)}*.`;

    } else { // LISTAR
      if (transacoesEncontradas.length > 0) {
        let resposta = `*Lançamentos ${filtroTexto ? `de "${filtroTexto}"` : ""} ${periodoTexto}:*\n\n`;
        
        transacoesEncontradas.sort((a,b) => b.data - a.data);

        transacoesEncontradas.slice(0, 15).forEach(t => {
          const dataFormatada = Utilities.formatDate(t.data, Session.getScriptTimeZone(), "dd/MM");
          const tipoIcon = t.tipo === "Receita" ? "🟢" : "🔴";
          resposta += `${tipoIcon} [${dataFormatada}] ${t.descricao} - *${formatter.format(t.valor)}*\n`;
        });
        if (transacoesEncontradas.length > 15) {
          resposta += `\n...e mais ${transacoesEncontradas.length - 15} lançamentos.`;
        }
        return resposta;
      } else {
        return `Nenhum lançamento ${filtroTexto ? `com "${filtroTexto}"` : ""} encontrado ${periodoTexto}.`;
      }
    }
  } catch (e) {
    Logger.log(`Erro em processarConsultaPorTexto: ${e.stack}`);
    return "Ocorreu um erro ao processar a sua pergunta: " + e.message;
  }
}

function determinarPeriodo(texto) {
    const hoje = new Date();
    let dataInicio, dataFim, periodoTexto;

    // Coloca as frases mais longas e específicas primeiro para garantir que são apanhadas
    if (texto.includes("mês passado") || texto.includes("mes passado")) {
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1, 0, 0, 0);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59);
        periodoTexto = "no mês passado";
    } else if (texto.includes("hoje")) {
        const agora = new Date();
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
        dataFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
        periodoTexto = "hoje";
    } else if (texto.includes("ontem")) {
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        dataInicio = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 0, 0, 0);
        dataFim = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 23, 59, 59);
        periodoTexto = "ontem";
    } else {
        // Verifica os meses por nome apenas se não encontrou os outros termos
        let mesEncontrado = -1;
        periodoTexto = "este mês"; // Assume 'este mês' como padrão
        const meses = { "janeiro": 0, "fevereiro": 1, "março": 2, "abril": 3, "maio": 4, "junho": 5, "julho": 6, "agosto": 7, "setembro": 8, "outubro": 9, "novembro": 10, "dezembro": 11 };
        for (const nomeMes in meses) {
            if (texto.includes(nomeMes)) {
                mesEncontrado = meses[nomeMes];
                periodoTexto = `em ${nomeMes}`;
                break;
            }
        }
        
        if (mesEncontrado !== -1) {
            dataInicio = new Date(hoje.getFullYear(), mesEncontrado, 1, 0, 0, 0);
            dataFim = new Date(hoje.getFullYear(), mesEncontrado + 1, 0, 23, 59, 59);
        } else {
            // Se nenhum mês for encontrado, mantém o padrão 'este mês'
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0);
            dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
        }
    }
    return { dataInicio, dataFim, periodoTexto };
}

function extrairFiltroDeTexto(texto) {
    let filtro = texto;
    // 1. Remove os períodos de tempo primeiro, para não confundir
    const palavrasTemporais = [
        "no mês passado", "mês passado", "mes passado", "este mês", "esse mês", "hoje", "ontem",
        "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    palavrasTemporais.forEach(palavra => {
        filtro = filtro.replace(new RegExp(`\\b${palavra}\\b`, 'gi'), ' ');
    });

    // 2. Remove as palavras de consulta e conectores
    const palavrasDeConsulta = [
        "quanto gastei com", "listar despesas com", "qual o total de", "total de",
        "quanto recebi de", "listar receitas de", "qual o total de receitas",
        "quanto gastei", "listar despesas", "quanto recebi", "listar receitas",
        "quanto", "qual", "quais", "listar", "mostrar", "total",
        "gastei", "paguei", "comprei", "recebi",
        "despesas", "despesa", "receitas", "receita",
        "meu", "minha", "meus", "minhas",
        "com", "de", "do", "da", "em", "no", "na"
        // REMOVIDO: "o", "a", "os", "as" para não cortar palavras como "alimentação"
    ];
    
    // Ordena para remover as frases mais longas primeiro
    palavrasDeConsulta.sort((a, b) => b.length - a.length);

    palavrasDeConsulta.forEach(palavra => {
        filtro = filtro.replace(new RegExp(`\\b${palavra}\\b`, 'gi'), ' ');
    });

    // 3. Limpa o resultado final
    return filtro.trim().replace(/ +/g, ' '); 
}

// --- FUNÇÕES DE CONSULTA ---
function obterSaldoContas(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const contasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS);
    const dadosContas = contasSheet.getDataRange().getValues();
    if (dadosContas.length < 2) return "Nenhuma conta encontrada na sua folha de cálculo.";

    const headers = dadosContas[0];
    const idxSaldo = headers.indexOf('Saldo Atual');
    const idxTipo = headers.indexOf('Tipo');
    if (idxSaldo === -1 || idxTipo === -1) throw new Error("Colunas 'Saldo Atual' ou 'Tipo' não encontradas.");

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

/**
 * VERSÃO 2.1 - EXIBIÇÃO AGRUPADA COM BOTÕES
 * Busca, agrupa e formata a lista de contas a pagar, enviando mensagens interativas.
 * @param {string} sheetId O ID da folha de cálculo.
 * @returns {object[]} Uma lista de objetos de mensagem para o Telegram.
 */
function listarContasAPagar(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS_A_PAGAR);
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      return [{ type: 'message', text: "Você não tem nenhuma conta a pagar cadastrada." }];
    }

    const headers = data[0].map(h => h.trim());
    const requiredHeaders = ['ID', 'Descricao', 'Valor', 'Data de Vencimento', 'Status'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return [{ type: 'message', text: `ERRO: As seguintes colunas não foram encontradas em 'Contas_a_Pagar': ${missingHeaders.join(', ')}.` }];
    }

    const idx = {
      id: headers.indexOf('ID'),
      desc: headers.indexOf('Descricao'),
      valor: headers.indexOf('Valor'),
      venc: headers.indexOf('Data de Vencimento'),
      status: headers.indexOf('Status')
    };
    
    const contasPendentes = data.slice(1)
      .filter(row => row[idx.status] && row[idx.status].toString().trim().toLowerCase() === 'pendente')
      .map(row => ({
        id: row[idx.id],
        desc: row[idx.desc],
        valor: parseFloat(row[idx.valor] || 0),
        vencimento: new Date(row[idx.venc])
      }))
      .sort((a, b) => a.vencimento - b.vencimento);

    if (contasPendentes.length === 0) {
      return [{ type: 'message', text: "🎉 Ótima notícia! Você não tem contas pendentes para pagar." }];
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const grupos = {
      vencidas: [],
      hoje: [],
      proximos: []
    };

    contasPendentes.forEach(conta => {
      if (conta.vencimento < hoje) {
        grupos.vencidas.push(conta);
      } else if (conta.vencimento.getTime() === hoje.getTime()) {
        grupos.hoje.push(conta);
      } else {
        grupos.proximos.push(conta);
      }
    });

    const messages = [];

    const formatarEAdicionarContas = (titulo, contas) => {
      if (contas.length === 0) return;
      
      messages.push({ type: 'message', text: `\n*${titulo}*` });
      
      contas.forEach(conta => {
        const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        const valorFormatado = conta.valor > 0 ? formatter.format(conta.valor) : "A definir";
        const dataFormatada = conta.vencimento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        let icon = '🧾';
        if (conta.desc.toLowerCase().includes('luz')) icon = '💡';
        if (conta.desc.toLowerCase().includes('água')) icon = '💧';
        if (conta.desc.toLowerCase().includes('net') || conta.desc.toLowerCase().includes('internet')) icon = '🌐';
        if (conta.desc.toLowerCase().includes('aluguel')) icon = '🏠';
        if (conta.desc.toLowerCase().includes('fatura')) icon = '💳';
        
        const texto = `${icon} *${conta.desc}*\n*Vence em:* ${dataFormatada}\n*Valor:* ${valorFormatado}`;
        
        const teclado = {
          inline_keyboard: [[
            { text: "✅ Pagar", callback_data: `bill_pay_${conta.id}` },
            { text: "✏️ Editar", callback_data: `bill_edit_${conta.id}` }
          ]]
        };
        
        messages.push({ type: 'question', text: texto, options: JSON.stringify(teclado) });
      });
    };

    formatarEAdicionarContas("🔴 CONTAS VENCIDAS", grupos.vencidas);
    formatarEAdicionarContas("🟠 CONTAS QUE VENCEM HOJE", grupos.hoje);
    formatarEAdicionarContas("🔵 PRÓXIMOS VENCIMENTOS", grupos.proximos);

    if (messages.length === 0) {
        return [{ type: 'message', text: "Não encontrei contas para exibir nos grupos." }];
    }

    return messages;
    
  } catch (e) {
    Logger.log(`ERRO em listarContasAPagar: ${e.stack}`);
    return [{ type: 'message', text: `Ocorreu um erro ao buscar suas contas a pagar: ${e.message}` }];
  }
}

/**
 * FUNÇÃO DE AUTORIZAÇÃO: Execute esta função manualmente UMA VEZ.
 * Ela irá acionar o ecrã de permissões do Google para que possa 
 * autorizar o script a aceder a folhas de cálculo externas.
 */
function forcarReautorizacao() {
  Logger.log("Permissões solicitadas. Por favor, aceite a caixa de diálogo de autorização que irá aparecer.");
}

/**
 * Obtém uma lista de todas as categorias únicas da aba 'Categorias'.
 * @param {string} sheetId O ID da folha de cálculo.
 * @returns {string[]} Uma lista de nomes de categorias.
 */
function obterCategoriasDisponiveis(sheetId) {
  const ss = SpreadsheetApp.openById(sheetId);
  const categoriasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CATEGORIAS);
  if (categoriasSheet.getLastRow() < 2) return [];
  const data = categoriasSheet.getRange('A2:A').getValues();
  // Usa um Set para obter apenas categorias únicas e depois converte para array
  const categoriasUnicas = [...new Set(data.map(row => row[0]).filter(String))];
  return categoriasUnicas;
}


/**
 * Obtém uma lista de subcategorias para uma categoria específica.
 * @param {string} sheetId O ID da folha de cálculo.
 * @param {string} nomeCategoria O nome da categoria a pesquisar.
 * @returns {string[]} Uma lista de nomes de subcategorias.
 */
function obterSubcategoriasPorCategoria(sheetId, nomeCategoria) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.CATEGORIAS);
    if (sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.trim());
    const idxCat = headers.indexOf('Categoria');
    const idxSub = headers.indexOf('Subcategoria');

    if (idxCat === -1 || idxSub === -1) return [];

    const subcategorias = data
      .slice(1)
      .filter(row => row[idxCat] === nomeCategoria && row[idxSub])
      .map(row => row[idxSub]);

    // Retorna uma lista de subcategorias únicas
    return [...new Set(subcategorias)];
  } catch (e) {
    Logger.log(`ERRO em obterSubcategoriasPorCategoria: ${e.stack}`);
    return [];
  }
}

/**
 * Busca e formata a lista de metas financeiras com botão de gerenciamento.
 * @param {string} sheetId O ID da folha de cálculo.
 * @returns {object[]} Uma lista de objetos de mensagem para o Telegram.
 */
function listarMetas(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = getSheetAndCreateIfNotExists(ss, SHEETS.METAS);
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return [{ type: 'message', text: "Você ainda não tem nenhuma meta cadastrada. Use /novameta para criar a sua primeira!" }];
    }

    const headers = data[0].map(h => h.trim());
    const idx = {
      nome: headers.indexOf('Nome da Meta'),
      objetivo: headers.indexOf('Valor Objetivo'),
      salvo: headers.indexOf('Valor Salvo'),
      status: headers.indexOf('Status')
    };

    const metasAtivas = data.slice(1).filter(row => row[idx.status] === 'Em Andamento');

    if (metasAtivas.length === 0) {
      return [{ type: 'message', text: "🎉 Parabéns! Parece que você não tem metas em andamento no momento." }];
    }

    const messages = metasAtivas.map(row => {
      const nome = row[idx.nome];
      const objetivo = parseFloat(row[idx.objetivo] || 0);
      const salvo = parseFloat(row[idx.salvo] || 0);

      const percentual = objetivo > 0 ? (salvo / objetivo) * 100 : 0;
      const blocosPreenchidos = Math.round(percentual / 10);
      const barra = '🟩'.repeat(blocosPreenchidos) + '⬜️'.repeat(10 - blocosPreenchidos);

      const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
      const texto = `*${nome}*\n${formatter.format(salvo)} / ${formatter.format(objetivo)} (${percentual.toFixed(0)}%)\n[${barra}]`;
      
      const teclado = {
        inline_keyboard: [[
          { text: "➕ Adicionar Valor", callback_data: `goal_add_${nome}` },
          { text: "⚙️ Gerenciar", callback_data: `goal_manage_${nome}` }
        ]]
      };
      
      return { type: 'question', text: texto, options: JSON.stringify(teclado) };
    });
    
    messages.unshift({ type: 'message', text: `Aqui está o progresso das suas *${metasAtivas.length}* meta(s) em andamento:` });
    return messages;
    
  } catch (e) {
    Logger.log(`ERRO em listarMetas: ${e.stack}`);
    return [{ type: 'message', text: `Ocorreu um erro ao buscar suas metas: ${e.message}` }];
  }
}
