Com base nos arquivos da planilha "Boas Contas - MODELO CLIENTE.xlsx", aqui está uma descrição detalhada de cada aba e suas respectivas colunas:

Abas de Configuração e Sistema:
1. ✅ Bem-vindo
Esta aba é um guia inicial para o usuário configurar a planilha.

Coluna	Descrição
Bem-vindo ao Gasto Certo! 🚀	Título de boas-vindas.
Passo 1:	Descrição do primeiro passo para ativar o produto, que é inserir a chave de licença.
Passo 2:	Instruções para inicializar o sistema após a ativação.
Passo 3:	Orientações para a configuração final e uso da planilha, incluindo a configuração de contas e do bot do Telegram.

Exportar para as Planilhas
2. Configuracoes
Armazena as configurações essenciais do sistema.

Coluna	Descrição
chave	O nome da configuração (ex: "chatId", "LOG_LEVEL").
valor	O valor associado à chave de configuração.
nomeUsuario	O nome do usuário associado à configuração (quando aplicável).
grupo	O grupo ao qual a configuração pertence (ex: "Familia", "Sistema").

Exportar para as Planilhas
3. Notificacoes_Config
Permite a personalização das notificações para cada usuário.

Coluna	Descrição
Chat ID	O ID do chat do Telegram do usuário.
Usuário	O nome do usuário.
Alertas Orçamento	Se o usuário deseja receber alertas de orçamento (Sim/Não).
Lembretes Contas a Pagar	Se o usuário deseja receber lembretes de contas a pagar (Sim/Não).
Resumo Diário	Se o usuário deseja receber um resumo diário (Sim/Não).
Hora Resumo Diário (HH:mm)	O horário para o envio do resumo diário.
Resumo Semanal	Se o usuário deseja receber um resumo semanal (Sim/Não).
Dia Resumo Semanal (0-6)	O dia da semana para o envio do resumo semanal (0 = Domingo, 6 = Sábado).
Hora Resumo Semanal (HH:mm)	O horário para o envio do resumo semanal.
Alertas de Fatura	Se o usuário deseja receber alertas de fatura (Sim/Não).

Exportar para as Planilhas
4. PalavrasChave
Mapeia palavras-chave para automatizar a categorização de transações.

Coluna	Descrição
tipo	O tipo de palavra-chave (ex: "tipo_transacao", "conta", "subcategoria").
chave	A palavra-chave a ser identificada (ex: "gastei", "itau").
valor interpretado	O valor que a palavra-chave representa (ex: "Despesa", "Itaú").
tipo_transac	O tipo de transação associado à palavra-chave.

Exportar para as Planilhas
5. LearnedCategories
Armazena o aprendizado do sistema para categorização de despesas.

Coluna	Descrição
Keyword	A palavra-chave extraída da descrição da transação.
Categoria	A categoria associada à palavra-chave.
Subcategoria	A subcategoria associada à palavra-chave.
ConfidenceScore	A pontuação de confiança da associação.
LastUpdated	A data da última atualização da associação.

Exportar para as Planilhas
6. Categorias
Define todas as categorias e subcategorias de transações.

Coluna	Descrição
Categoria	O nome da categoria principal (ex: "🛒 Alimentação").
Subcategoria	O nome da subcategoria (ex: "Supermercado").
Tipo	O tipo de transação (Despesa, Receita, Transferência).
Tipo de Gasto	Classificação do gasto (Necessidade, Desejo, Outro).
Metodo de Pagamento	O método de pagamento padrão para a subcategoria.

Exportar para as Planilhas
7. Logs_Sistema
Registra a atividade do sistema.

Coluna	Descrição
Timestamp	A data e hora em que o log foi registrado.
Nivel	O nível do log (ex: "INFO", "ERROR", "DEBUG").
Mensagem	A mensagem de log.

Exportar para as Planilhas
8. AlertasEnviados
Histórico de notificações e alertas enviados.

Coluna	Descrição
Timestamp	A data e hora em que o alerta foi enviado.
Usuario	O ID do usuário que recebeu o alerta.
Categoria	A categoria do alerta.
Subcategoria	A subcategoria do alerta.
Tipo Alerta	O tipo de alerta enviado.

Exportar para as Planilhas
Abas de Lançamentos e Controle Financeiro:
9. Transacoes
Registra todas as transações financeiras.

Coluna	Descrição
Data	A data em que a transação ocorreu.
Descricao	A descrição da transação.
Categoria	A categoria da transação.
Subcategoria	A subcategoria da transação.
Tipo	O tipo de transação (Despesa, Receita, Transferência).
Valor	O valor da transação.
Metodo de Pagamento	O método de pagamento utilizado.
Conta/Cartão	A conta ou cartão utilizado na transação.
Parcelas Totais	O número total de parcelas (para compras parceladas).
Parcela Atual	O número da parcela atual.
Data de Vencimento	A data de vencimento da transação/parcela.
Usuario	O usuário que registrou a transação.
Status	O status da transação (ex: "Ativo").
ID Transacao	Um identificador único para a transação.
Data de Registro	A data e hora em que a transação foi registrada.

Exportar para as Planilhas
10. Transacoes_Arquivo
Arquivo para transações antigas. As colunas são as mesmas da aba "Transacoes".

11. Contas
Lista todas as contas financeiras do usuário.

Coluna	Descrição
Nome da Conta	O nome da conta (ex: "Itaú", "Cartão Nubank Breno").
Tipo	O tipo de conta (Conta Corrente, Cartão de Crédito, etc.).
Banco	O nome do banco.
Saldo Inicial	O saldo inicial da conta.
Saldo Atual	O saldo atual da conta.
Limite	O limite da conta (para cartões de crédito).
Dia de Vencimento	O dia de vencimento da fatura do cartão.
Status	O status da conta (Ativo/Inativo).
Categoria	A categoria da conta (Corrente, Cartão, etc.).
Dia de Fechamento	O dia de fechamento da fatura do cartão.
Tipo de Fechamento	O tipo de fechamento da fatura.
Dias Antes Vencimento	O número de dias antes do vencimento que a fatura fecha.
Conta Pai Agrupador	A conta principal à qual esta conta está vinculada (para faturas consolidadas).
Pessoa	A pessoa associada à conta.
Fatura Pendente	Indica se há uma fatura pendente.

Exportar para as Planilhas
12. Contas_a_Pagar
Controle de contas a pagar e a receber.

Coluna	Descrição
ID	Um identificador único para a conta.
Descricao	A descrição da conta.
Categoria	A categoria da conta.
Valor	O valor da conta.
Data de Vencimento	A data de vencimento da conta.
Status	O status da conta (Pendente, Pago).
Recorrente	Se a conta é recorrente (Verdadeiro/Falso).
Conta de Pagamento Sugerida	A conta sugerida para o pagamento.
Observacoes	Observações adicionais sobre a conta.
ID Transacao Vinculada	O ID da transação vinculada ao pagamento desta conta.

Exportar para as Planilhas
13. Faturas
Consolida as informações das faturas de cartão de crédito.

Coluna	Descrição
ID Fatura	Um identificador único para a fatura.
Cartao	O nome do cartão de crédito.
Mes Referencia	O mês de referência da fatura.
Data Fechamento	A data de fechamento da fatura.
Data Vencimento	A data de vencimento da fatura.
Valor Total	O valor total da fatura.
Valor Pago	O valor já pago da fatura.
Status	O status da fatura (Aberta, Fechada, Paga).
ID Transacao Pagamento	O ID da transação de pagamento da fatura.

Exportar para as Planilhas
Abas de Planejamento e Metas:
14. Orcamento
Define o orçamento mensal para cada categoria.

Coluna	Descrição
ID Orcamento	Um identificador único para o orçamento.
Mes referencia	O mês de referência do orçamento.
Categoria	A categoria de despesa.
Valor Orcado	O valor orçado para a categoria.
Valor Gasto	O valor já gasto na categoria.
Pessoa	A pessoa a quem o orçamento se aplica.

Exportar para as Planilhas
15. PrevisaoAnual
Planejamento de longo prazo com projeções mensais.

Coluna	Descrição
Categoria	A categoria de despesa ou receita.
Subcategoria	A subcategoria.
janeiro/2025 a dezembro/2025	Colunas para cada mês do ano, com os valores previstos.
Total Geral	A soma dos valores previstos para o ano.

Exportar para as Planilhas
16. Metas
Registro e acompanhamento de metas financeiras.

Coluna	Descrição
Nome da Meta	O nome da meta (ex: "Viagem de Férias").
Valor Objetivo	O valor total a ser alcançado.
Valor Salvo	O valor já economizado para a meta.
Data Alvo	A data limite para alcançar a meta.
Status	O status da meta (Em Andamento, Atingida).

Exportar para as Planilhas
Abas de Investimentos e Patrimônio:
17. Ativos
Registra os principais ativos do usuário.

Coluna	Descrição
Descrição	A descrição do ativo (ex: "Casa", "Carro").
Tipo	O tipo do ativo (Imóvel, Veículo, Ações).
Valor	O valor do ativo.

Exportar para as Planilhas
18. Passivos
Registra as obrigações financeiras.

Coluna	Descrição
Descrição	A descrição do passivo (ex: "Financiamento Casa").
Tipo	O tipo do passivo (Financiamento, Empréstimo).
Valor	O valor do passivo.

Exportar para as Planilhas
19. Investimentos
Detalha a carteira de investimentos.

Coluna	Descrição
Ativo	O código do ativo (ex: "MXRF11", "PETR4").
Tipo	O tipo de ativo (FII, Ação/FII).
Quantidade	A quantidade de cotas/ações.
Preço Médio de Compra	O preço médio de compra do ativo.
Valor Investido	O valor total investido no ativo.
Preço Atual	O preço atual do ativo.
Valor Atual	O valor atual da posição no ativo.
Lucro/Prejuízo	O lucro ou prejuízo com o ativo.
Total de Proventos	O total de proventos recebidos do ativo.
Status	O status do investimento (ex: "Aberta").
Atualização Manual?	Indica se a atualização do preço é manual (Sim/Não).

Exportar para as Planilhas
20. PortfolioHistory
Registra o histórico do valor da carteira de investimentos.

Coluna	Descrição
Data	A data e hora do registro.
ValorTotal	O valor total da carteira de investimentos na data do registro.

Exportar para as Planilhas
Abas de Tarefas e Visualização:
21. Tarefas
Lista de tarefas do usuário.

Coluna	Descrição
ID	Um identificador único para a tarefa.
Descricao	A descrição da tarefa.
DataCriacao	A data e hora de criação da tarefa.
DataConclusao	A data e hora de conclusão da tarefa.
Status	O status da tarefa (Pendente, Concluída).
IDEventoAgenda	O ID do evento na agenda do Google, se houver.
ChatIDUsuario	O ID do chat do usuário que criou a tarefa.

Exportar para as Planilhas
22. Dashboard
Dados consolidados para o painel principal.

Coluna	Descrição
(Colunas sem nome)	Células usadas para formatação e títulos.
DADOS DO SCRIPT	Indicador de que os dados abaixo são gerados por script.
Resumo para Gráfico.	Título para a seção de resumo.
Categoria	A categoria de despesa.
Valor Gasto	O valor total gasto na categoria.
