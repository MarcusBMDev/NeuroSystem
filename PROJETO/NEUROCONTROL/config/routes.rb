Rails.application.routes.draw do
  namespace :api do
    # 1. Autenticação
    post 'auth/login', to: 'auth#login'

    # 2. Cálculo
    get 'calc/previsao', to: 'calc#previsao'

    # 3. Guias
    get    'guias/pacientes', to: 'guias#buscar_pacientes'
    post   'guias/pacientes/novo', to: 'guias#cadastrar_novo_paciente'
    get    'guias/convenios', to: 'guias#convenios'
    get    'guias', to: 'guias#index'
    post   'guias', to: 'guias#create'
    put    'guias/:id', to: 'guias#update'
    delete 'guias/:id', to: 'guias#destroy'
    put    'guias/:id/status', to: 'guias#atualizar_status'
    post   'guias/:id/contato', to: 'guias#registrar_contato'
    post   'guias/:id/confirmar-agendamento', to: 'guias#confirmar_agendamento'

    # 4. Protocolos
    post 'protocolos/gerar', to: 'protocolos#gerar'
    get  'protocolos', to: 'protocolos#index'
    get  'protocolos/:id', to: 'protocolos#show'
    post 'protocolos/auditar', to: 'protocolos#auditar'

    # 5. Recepção
    get  'recepcao/hoje', to: 'recepcao#hoje'
    post 'recepcao/assinar-sessao', to: 'recepcao#assinar_sessao'
    post 'recepcao/sinalizar-problema', to: 'recepcao#sinalizar_problema'
    get  'recepcao/alertas', to: 'recepcao#alertas'
    post 'recepcao/alertas/resolver', to: 'recepcao#resolver_alerta'

    # 6. Financeiro
    get    'financeiro/convenios', to: 'financeiro#listar_convenios'
    post   'financeiro/convenios', to: 'financeiro#criar_convenio'
    put    'financeiro/convenios/:id', to: 'financeiro#atualizar_convenio'
    delete 'financeiro/convenios/:id', to: 'financeiro#excluir_convenio'
    get    'financeiro/tabela', to: 'financeiro#listar_tabela'
    post   'financeiro/tabela', to: 'financeiro#salvar_tabela'
    get    'financeiro/negociacoes', to: 'financeiro#listar_negociacoes'
    post   'financeiro/negociacoes', to: 'financeiro#salvar_negociacao'

    # 7. NFs Particulares
    get    'nf-particulares', to: 'nf_particulares#index'
    post   'nf-particulares', to: 'nf_particulares#create'
    put    'nf-particulares/:id/nf', to: 'nf_particulares#atualizar_nf'
    delete 'nf-particulares/:id', to: 'nf_particulares#destroy'

    # 8. Central de Permissões
    post 'alteracoes/solicitar', to: 'alteracoes#solicitar'
    get  'alteracoes', to: 'alteracoes#index'
    post 'alteracoes/:id/aprovar', to: 'alteracoes#aprovar'
    post 'alteracoes/:id/rejeitar', to: 'alteracoes#rejeitar'

    # 9. Gerencial
    get 'gerencial/kpis', to: 'gerencial#kpis'
    get 'gerencial/producao-convenio', to: 'gerencial#producao_convenio'
    get 'gerencial/excecoes', to: 'gerencial#excecoes'
    get 'gerencial/exportar-excecoes', to: 'gerencial#exportar_excecoes'
    get 'gerencial/exportar-faturamento', to: 'gerencial#exportar_faturamento'
    get 'gerencial/historico-paciente', to: 'gerencial#historico_paciente'
    get 'gerencial/fechamento', to: 'gerencial#fechamento'
    get 'gerencial/visao-consolidada', to: 'gerencial#visao_consolidada'
    get 'gerencial/pendencias-recepcao', to: 'gerencial#pendencias_recepcao'

    # 10. Profissionais
    get 'profissionais', to: 'profissionais#index'
  end
end
