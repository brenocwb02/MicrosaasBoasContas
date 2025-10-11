/**
 * @OnlyCurrentDoc
 *
 * Módulo para gestão dos gatilhos (triggers) de tempo.
 */

const NOME_FUNCAO_TRIGGER = 'executarVerificacoesDiarias';

/**
 * Cria um gatilho diário para executar as verificações de notificação.
 * Remove gatilhos antigos para evitar duplicação.
 */
function criarTriggerDiario() {
  deletarTriggers(); // Garante que não haja duplicados
  
  try {
    ScriptApp.newTrigger(NOME_FUNCAO_TRIGGER)
        .timeBased()
        .everyDays(1)
        .atHour(8) // Executa todo dia às 8 da manhã (horário do servidor)
        .create();
        
    return "Lembretes diários ativados com sucesso! As verificações serão feitas todos os dias às 8h.";
  } catch (e) {
    return "Erro ao criar o lembrete: " + e.message;
  }
}

/**
 * Apaga todos os gatilhos associados a este projeto e à função específica.
 */
function deletarTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let count = 0;
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === NOME_FUNCAO_TRIGGER) {
        ScriptApp.deleteTrigger(triggers[i]);
        count++;
      }
    }
    return `${count} lembrete(s) automático(s) foram desativados.`;
  } catch (e) {
    return "Erro ao desativar os lembretes: " + e.message;
  }
}

