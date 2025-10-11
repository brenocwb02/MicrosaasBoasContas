/**
 * @OnlyCurrentDoc
 *
 * Módulo para gestão de cache. Armazena dados frequentemente acedidos
 * para melhorar a performance e reduzir as leituras da planilha.
 * VERSÃO COM LOGS PARA DEPURAÇÃO.
 */


/**
 * Obtém os dados de uma aba, priorizando o cache.
 * @param {string} sheetId O ID da planilha do cliente.
 * @param {string} sheetName O nome da aba (usando a constante SHEETS).
 * @returns {Array<Array<any>> | null} Os dados da aba ou null se não for encontrada.
 */
function getSheetDataWithCache_(sheetId, sheetName) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `${sheetName}_${sheetId}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    Logger.log(`[CACHE HIT] Dados da aba '${sheetName}' recuperados do cache.`);
    return JSON.parse(cachedData);
  }

  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log(`Aviso: Aba '${sheetName}' não encontrada na planilha ${sheetId} para cache.`);
      return null;
    }
    
    Logger.log(`[CACHE MISS] Dados da aba '${sheetName}' lidos da planilha e armazenados em cache.`);
    const data = sheet.getDataRange().getValues();
    cache.put(cacheKey, JSON.stringify(data), CACHE_EXPIRATION_SECONDS);
    return data;
  } catch (e) {
    Logger.log(`Erro ao aceder à planilha ${sheetId} para cache: ${e.message}`);
    return null;
  }
}

/**
 * Limpa o cache para uma aba específica de um cliente.
 * Útil quando os dados são alterados (ex: nova conta adicionada).
 * @param {string} sheetId O ID da planilha do cliente.
 * @param {string} sheetName O nome da aba.
 */
function clearCacheForSheet_(sheetId, sheetName) {
   const cache = CacheService.getScriptCache();
   const cacheKey = `${sheetName}_${sheetId}`;
   cache.remove(cacheKey);
   Logger.log(`Cache limpo para '${sheetName}' na planilha ${sheetId}.`);
}

