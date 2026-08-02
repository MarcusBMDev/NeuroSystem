Rails.application.routes.draw do
  # ROTAS DE PRIORIDADE CRÍTICA MÁXIMA
  post '/api/pacientes/unificar_automatico', to: 'api/data_pacientes#unificar_automatico'
  post '/api/data_pacientes/unificar_automatico', to: 'api/data_pacientes#unificar_automatico'
  post '/pacientes/unificar_automatico', to: 'api/data_pacientes#unificar_automatico'
  post '/data_pacientes/unificar_automatico', to: 'api/data_pacientes#unificar_automatico'

  # API Unified Routes - PRIORIDADE MÁXIMA
  namespace :api, defaults: { format: :json } do
    
    # 1. Rota da Dashboard corrigida (agora dentro do namespace API)
    get 'dashboard/stats', to: 'dashboard#stats'

    resources :data_pacientes, controller: 'data_pacientes' do
      patch 'reativar', on: :member
      post 'mesclar', on: :collection
      post 'unificar_automatico', on: :collection
      get 'removidos', on: :collection
    end
    
    # Endpoint principal para compatibilidade no front
    post 'pacientes/unificar_automatico', to: 'data_pacientes#unificar_automatico'
    post 'data_pacientes/unificar_automatico', to: 'data_pacientes#unificar_automatico'
    get  'pacientes/removidos', to: 'data_pacientes#removidos'
    get  'pacientes', to: 'data_pacientes#index'
    post 'pacientes', to: 'data_pacientes#create'
    put  'pacientes/:id', to: 'data_pacientes#update'
    patch 'pacientes/:id', to: 'data_pacientes#update'
    delete 'pacientes/:id', to: 'data_pacientes#destroy'

    resources :profissionais do
      collection do
        get 'especialidades'
        post 'especialidades', action: :criar_especialidade
      end
      post 'share_curriculo', on: :member
    end

    resources :convenios do
      post 'mesclar', on: :collection
    end
    resources :users, only: [:index, :create, :update, :destroy]
    resources :solicitantes, only: [:index, :create, :destroy]
    resources :lista_esperas, only: [:index, :create, :update, :destroy]
    resources :auditorias, only: [:index]
    
    get 'admin/backup', to: 'backups#download'
    get 'backup_database', to: 'backups#download'
    
    post 'importar_agenda', to: 'importacoes#upload_planilha'
    
    # 2. Rota de Transferências adicionada para o backend
    resources :transferencias do
      member do
        post :aprovar
        post :rejeitar
      end
    end
    
    resources :agendamentos do
      # Rotas de coleção (sem :id do resource)
      collection do
        get  :vagas
        get  :vagas_por_especialidade
        get  :sugerir
        post :transferir
        get  'por_profissional/:id', action: :por_profissional, as: :por_profissional
        get  :historico_slot
      end
      # Rotas de membro (com :id do resource)
      member do
        post :aprovar
      end
    end
  end

  # Página de entrada e navegação
  root to: 'application#renderizar_front_end'
  get '/dashboard', to: 'application#renderizar_dashboard'
  get '/grade',     to: 'application#renderizar_grade'
  get '/equipe',    to: 'application#renderizar_equipe'
  get '/espera',    to: 'application#renderizar_espera'
  get '/pacientes', to: 'application#renderizar_pacientes'
  get '/transferencias', to: 'application#renderizar_transferencias'
  get '/convenios_view', to: 'application#renderizar_convenios'
  get '/auditoria', to: 'application#renderizar_auditoria'
  get '/primeiros', to: 'application#renderizar_primeiros'
  get '/admin',     to: 'application#renderizar_admin'
  
  post '/login', to: 'auth#login'
end