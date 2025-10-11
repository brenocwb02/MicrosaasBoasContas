/**
 * @OnlyCurrentDoc
 *
 * Contém funções auxiliares e de interpretação de texto que
 * são usadas por várias partes da biblioteca.
 */

// --- HELPERS DE INTERPRETAÇÃO ---

function detectarTipoTransacao(mensagemCompleta, dadosPalavras) {
  const palavrasReceitaFixas = ['recebi', 'salario', 'rendeu', 'ganhei'];
  const palavrasDespesaFixas = ['gastei', 'paguei', 'comprei', 'saida', 'débito', 'debito'];
  const palavrasTransferenciaFixas = ['transferi', 'transferir', 'movi', 'enviei'];

  for (let palavra of palavrasTransferenciaFixas) {
    if (mensagemCompleta.includes(palavra)) return { tipo: "Transferência", keyword: palavra };
  }
  for (let palavraRec of palavrasReceitaFixas) {
    if (mensagemCompleta.includes(palavraRec)) return { tipo: "Receita", keyword: palavraRec };
  }
  for (let palavraDes of palavrasDespesaFixas) {
    if (mensagemCompleta.includes(palavraDes)) return { tipo: "Despesa", keyword: palavraDes };
  }
  return null;
}

function extrairValor(text) {
  const regex = /(?:R\$\s?)?(\d+[,.]?\d*)/i;
  const match = text.match(regex);
  return match ? parseFloat(match[1].replace(',', '.')) : null;
}

function interpretarConta(text, dadosContas, ss) { 
  const lowerText = text.toLowerCase();
  const nomesContas = dadosContas.slice(1).map(row => row[0]).filter(Boolean);
  nomesContas.sort((a, b) => b.length - a.length);

  for (const nome of nomesContas) {
    if (nome && lowerText.includes(nome.toLowerCase())) {
      const infoConta = obterInfoCartao(nome, ss);
      return { conta: nome, infoConta: infoConta };
    }
  }
  return { conta: null, infoConta: null };
}

function interpretarCategoria(text, palavrasChaveData) {
  const lowerText = text.toLowerCase();
  let melhorMatch = { chave: '', valor: '' };

  for (let i = 1; i < palavrasChaveData.length; i++) {
    const [tipo, chave, valor] = palavrasChaveData[i];
    
    if (tipo === 'subcategoria' && typeof chave === 'string' && chave && lowerText.includes(chave.toLowerCase())) {
      if (chave.length > melhorMatch.chave.length) {
        melhorMatch.chave = chave;
        melhorMatch.valor = valor;
      }
    }
  }

  if (melhorMatch.valor) {
    const parts = melhorMatch.valor.split(' > ');
    return { categoria: parts[0], subcategoria: parts[1] || '' };
  }
  
  return { categoria: null, subcategoria: null };
}

function extrairDescricao(text, conta, tipoKeyword, valor) {
    let cleanText = text;

    const removeList = [];
    if (tipoKeyword) removeList.push(tipoKeyword);
    if (conta) removeList.push(conta);

    const valorRegex = /(?:R\$\s?)?(\d+[,.]?\d*)\s*(?:reais|real)?/i;
    const valorMatch = text.match(valorRegex);
    if (valorMatch) {
        removeList.push(valorMatch[0]);
    }

    removeList.sort((a, b) => b.length - a.length);

    removeList.forEach(item => {
        cleanText = cleanText.replace(new RegExp(item.trim(), 'ig'), '');
    });

    const preposicoes = ["com o", "com a", "no", "na", "em", "de", "do", "da", "com", "via"];
    preposicoes.forEach(prep => {
        cleanText = cleanText.replace(new RegExp(`\\b${prep}\\b`, 'ig'), '');
    });

    return cleanText.trim().replace(/ +/g, ' ').replace(/^,|,$/g, '').trim();
}

function extrairParcelas(texto) {
  const regex = /(\d+)\s*(?:x|vezes)/i;
  const match = texto.match(regex);
  return match ? parseInt(match[1], 10) : 1;
}

function obterMetodoDePagamentoPadrao(infoConta) {
    if (infoConta && infoConta.tipo && infoConta.tipo.toLowerCase().includes('crédito')) {
      return 'Crédito';
    }
    return 'PIX';
}

// --- UTILITÁRIOS GERAIS ---

function getSheetAndCreateIfNotExists(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if(headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    } else {
      // Cria cabeçalhos padrão se não forem fornecidos
      criarCabecalhosPadrao(sheet, sheetName);
    }
    SpreadsheetApp.flush(); 
  }
  return sheet;
}

function obterInfoCartao(nomeCartao, ss) {
  const contasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS);
  const dadosContas = contasSheet.getDataRange().getValues();
  if (dadosContas.length < 2) return null;
  
  const headers = dadosContas[0];
  const idxNome = headers.indexOf('Nome da Conta');
  const idxTipo = headers.indexOf('Tipo');
  const idxFechamento = headers.indexOf('Dia de Fechamento');
  const idxVencimento = headers.indexOf('Dia de Vencimento');
  const idxTipoFechamento = headers.indexOf('Tipo de Fechamento');

  for (let i = 1; i < dadosContas.length; i++) {
    const linha = dadosContas[i];
    if (linha[idxNome] === nomeCartao && linha[idxTipo] === 'Cartão de Crédito') {
      return {
        tipo: linha[idxTipo],
        diaFechamento: parseInt(linha[idxFechamento]),
        diaVencimento: parseInt(linha[idxVencimento]),
        tipoFechamento: linha[idxTipoFechamento] || 'fechamento-anterior' // Padrão
      };
    }
  }
  return null;
}

function obterDadosParaSidebar() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const contasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS);
    const categoriasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CATEGORIAS);
    
    let contas = [];
    if (contasSheet.getLastRow() > 1) { 
      contas = contasSheet.getRange(2, 1, contasSheet.getLastRow() - 1, 1).getValues().flat().filter(String);
    }
    
    const categorias = {};
    if (categoriasSheet.getLastRow() > 1) { 
      const categoriasData = categoriasSheet.getRange(2, 1, categoriasSheet.getLastRow() - 1, 2).getValues();
      categoriasData.forEach(row => {
        const categoria = row[0];
        const subcategoria = row[1];
        if (categoria) {
          if (!categorias[categoria]) {
            categorias[categoria] = [];
          }
          if (subcategoria) {
            categorias[categoria].push(subcategoria);
          }
        }
      });
    }
    
    return { contas: contas, categorias: categorias };
  } catch (e) {
    Logger.log('Erro ao obter dados para a sidebar: ' + e.message);
    return { contas: [], categorias: {} };
  }
}

function parseDateBR(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const dt = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    if (!isNaN(dt.getTime())) {
      return dt;
    }
  }
  return null;
}

function getCardToParentMap(ss) {
  const contasSheet = getSheetAndCreateIfNotExists(ss, SHEETS.CONTAS);
  const dadosContas = contasSheet.getDataRange().getValues();
  const map = {};
  if (dadosContas.length < 2) return map;

  const headers = dadosContas[0];
  const idxNome = headers.indexOf('Nome da Conta');
  const idxPai = headers.indexOf('Conta Pai Agrupador');

  if (idxNome === -1 || idxPai === -1) return map;

  for (let i = 1; i < dadosContas.length; i++) {
    const nomeConta = dadosContas[i][idxNome];
    const contaPai = dadosContas[i][idxPai];
    if (nomeConta && contaPai) {
      map[nomeConta] = contaPai;
    }
  }
  return map;
}

function criarCabecalhosPadrao(sheet, sheetName) {
    let headers = [];
    switch(sheetName) {
        case SHEETS.LANCAMENTOS:
            headers = ['Data', 'Descricao', 'Categoria', 'Subcategoria', 'Tipo', 'Valor', 'Metodo de Pagamento', 'Conta/Cartão', 'Parcelas Totais', 'Parcela Atual', 'Data de Vencimento', 'Usuario', 'Status', 'ID Transacao', 'Data de Registro'];
            break;
        case SHEETS.FATURAS:
            headers = ['ID Fatura', 'Cartao', 'Mes Referencia', 'Data Fechamento', 'Data Vencimento', 'Valor Total', 'Valor Pago', 'Status', 'ID Transacao Pagamento'];
            break;
        case SHEETS.CONTAS:
            headers = ['Nome da Conta', 'Tipo', 'Banco', 'Saldo Inicial', 'Saldo Atual', 'Limite', 'Dia de Vencimento', 'Status', 'Categoria', 'Dia de Fechamento', 'Tipo de Fechamento', 'Dias Antes Vencimento', 'Conta Pai Agrupador', 'Pessoa'];
            break;
        case SHEETS.CATEGORIAS:
            headers = ['Categoria', 'Subcategoria', 'Tipo', 'Tipo de Gasto'];
            break;
    }
    if (headers.length > 0) {
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
    }
}
