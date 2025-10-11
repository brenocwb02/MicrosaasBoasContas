/**
 * @OnlyCurrentDoc
 *
 * Funções responsáveis por processar consultas em linguagem natural,
 * como "quanto gastei com ifood este mês?".
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
    if (consultaNormalizada.includes("despesa")) tipoTransacaoFiltro = "Despesa";
    if (consultaNormalizada.includes("receita")) tipoTransacaoFiltro = "Receita";

    const filtroTexto = extrairFiltroDeTexto(consultaNormalizada);

    let totalSoma = 0;
    let transacoesEncontradas = [];
    
    const idxData = headers.indexOf('Data');
    const idxTipo = headers.indexOf('Tipo');
    const idxDescricao = headers.indexOf('Descricao');
    const idxCategoria = headers.indexOf('Categoria');
    const idxSubcategoria = headers.indexOf('Subcategoria');
    const idxConta = headers.indexOf('Conta/Cartão');
    const idxValor = headers.indexOf('Valor');

    for (let i = 1; i < transacoes.length; i++) {
      const linha = transacoes[i];
      const dataTransacao = new Date(linha[idxData]);
      if (!dataTransacao || isNaN(dataTransacao.getTime()) || dataTransacao < dataInicio || dataTransacao > dataFim) continue;

      const tipo = linha[idxTipo];
      if (tipoTransacaoFiltro && tipo.toLowerCase() !== tipoTransacaoFiltro.toLowerCase()) continue;

      if (filtroTexto) {
        const descricao = (linha[idxDescricao] || '').toLowerCase();
        const categoria = (linha[idxCategoria] || '').toLowerCase();
        const subcategoria = (linha[idxSubcategoria] || '').toLowerCase();
        const conta = (linha[idxConta] || '').toLowerCase();
        if (![descricao, categoria, subcategoria, conta].some(campo => campo.includes(filtroTexto))) continue;
      }
      
      const valor = parseFloat(linha[idxValor] || 0);
      transacoesEncontradas.push({
          data: Utilities.formatDate(dataTransacao, Session.getScriptTimeZone(), "dd/MM"),
          descricao: linha[idxDescricao],
          valor: valor,
          tipo: tipo
      });
      if(tipo.toLowerCase() === 'despesa') {
        totalSoma += valor;
      }
    }

    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    if (tipoConsulta === "SOMAR") {
      let prefixo = tipoTransacaoFiltro ? tipoTransacaoFiltro + "s" : "Gastos";
      return `O *total de ${prefixo}* ${filtroTexto ? `com "${filtroTexto}"` : ""} ${periodoTexto} é de: *${formatter.format(totalSoma)}*.`;
    } else {
      if (transacoesEncontradas.length > 0) {
        let resposta = `*Lançamentos ${filtroTexto ? `de "${filtroTexto}"` : ""} ${periodoTexto}:*\n\n`;
        transacoesEncontradas.sort((a,b) => new Date(b.data.split('/').reverse().join('-')) - new Date(a.data.split('/').reverse().join('-'))).slice(0, 15).forEach(t => {
          const tipoIcon = t.tipo === "Receita" ? "🟢" : "🔴";
          resposta += `${tipoIcon} [${t.data}] ${t.descricao} - *${formatter.format(t.valor)}*\n`;
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
    let dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    let dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
    let periodoTexto = "este mês";

    const meses = { "janeiro": 0, "fevereiro": 1, "marco": 2, "abril": 3, "maio": 4, "junho": 5, "julho": 6, "agosto": 7, "setembro": 8, "outubro": 9, "novembro": 10, "dezembro": 11 };
    for (const nomeMes in meses) {
        if (texto.includes(nomeMes)) {
            dataInicio = new Date(hoje.getFullYear(), meses[nomeMes], 1);
            dataFim = new Date(hoje.getFullYear(), meses[nomeMes] + 1, 0, 23, 59, 59);
            periodoTexto = `em ${nomeMes}`;
            break;
        }
    }
    if (texto.includes("mes passado")) {
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59);
        periodoTexto = "no mês passado";
    } else if (texto.includes("hoje")) {
        dataInicio = new Date(hoje.setHours(0,0,0,0));
        dataFim = new Date(hoje.setHours(23,59,59,999));
        periodoTexto = "hoje";
    } else if (texto.includes("ontem")) {
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        dataInicio = new Date(ontem.setHours(0,0,0,0));
        dataFim = new Date(ontem.setHours(23,59,59,999));
        periodoTexto = "ontem";
    }
    return { dataInicio, dataFim, periodoTexto };
}

function extrairFiltroDeTexto(texto) {
    let filtro = texto;
    const palavrasParaRemover = [
        "quanto gastei", "listar despesas", "total de", "quanto recebi", "listar receitas",
        "quanto", "qual", "quais", "listar", "mostrar", "total", "despesas", "receitas", "despesa", "receita",
        "meu", "minha", "meus", "minhas", "de", "do", "da", "em", "no", "na", "com", "este mês", "mês passado", "hoje", "ontem",
        "janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    palavrasParaRemover.forEach(palavra => {
        filtro = filtro.replace(new RegExp(`\\b${palavra}\\b`, 'gi'), '');
    });
    return filtro.trim().replace(/ +/g, ' ');
}
