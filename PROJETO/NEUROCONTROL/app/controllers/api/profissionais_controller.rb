module Api
  class ProfissionaisController < ApplicationController
    before_action -> { authorize!('ver_profissionais') }

    # GET /api/profissionais?q=marcus
    def index
      q = params[:q].present? ? "%#{params[:q]}%" : '%'

      profissionais = Profissional.where('nome LIKE ?', q)
                                  .order(nome: :asc)
                                  .select(
                                    'profissionais.id, profissionais.nome, profissionais.especialidade, profissionais.ativo, ' \
                                    '(SELECT COUNT(*) FROM agendamentos WHERE profissional_id = profissionais.id AND status = \'confirmado\') as total_agendamentos'
                                  )

      render json: profissionais.map { |p|
        {
          id: p.id,
          nome: p.nome,
          especialidade: p.especialidade,
          ativo: p.ativo,
          total_agendamentos: p.attributes['total_agendamentos'] || 0
        }
      }
    end
  end
end
