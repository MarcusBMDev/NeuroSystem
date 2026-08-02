class Api::ConveniosController < ApplicationController
  before_action :validar_acesso_gestao!, except: [:index]
  def index
    convenios = Convenio.all.order(:nome)
    render json: convenios.map { |c| 
      json = c.as_json(only: [:id, :nome, :ativo, :exigencias, :especialidades_atendidas])
      json[:pacientes] = c.pacientes.ativos.order(:nome).map { |p| { id: p.id, nome: p.nome } }
      begin
        json[:documento_url] = c.documento.attached? ? rails_blob_url(c.documento, only_path: true) : nil
        json[:documento_nome] = c.documento.attached? ? c.documento.filename.to_s : nil
      rescue
        json[:documento_url] = nil
        json[:documento_nome] = nil
      end
      json
    }
  end

  def create
    convenio = Convenio.new(convenio_params)
    convenio.ativo = true
    if convenio.save
      render json: convenio_json(convenio), status: :created
    else
      render json: { errors: convenio.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    convenio = Convenio.find(params[:id])
    if convenio.update(convenio_params)
      render json: convenio_json(convenio)
    else
      render json: { errors: convenio.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    convenio = Convenio.find(params[:id])
    
    # Se não houver nenhum vínculo, podemos apagar de vez
    if convenio.pacientes.empty? && convenio.agendamentos.empty?
      convenio.destroy
      render json: { message: 'Convênio removido do sistema.' }
    else
      # Se houver vínculos, apenas inativamos para não quebrar o banco
      convenio.update(ativo: false)
      render json: { message: 'Convênio inativado devido a vínculos existentes.' }
    end
  end

  def mesclar
    id_origem = params[:id_origem]
    id_destino = params[:id_destino]

    if id_origem.blank? || id_destino.blank?
      return render json: { error: "Os convênios de origem e destino são obrigatórios." }, status: :unprocessable_entity
    end

    if id_origem == id_destino
      return render json: { error: "Os convênios de origem e destino devem ser diferentes." }, status: :unprocessable_entity
    end

    convenio_origem = Convenio.find_by(id: id_origem)
    convenio_destino = Convenio.find_by(id: id_destino)

    if convenio_origem.nil? || convenio_destino.nil?
      return render json: { error: "Convênio de origem ou destino não localizado." }, status: :not_found
    end

    begin
      Convenio.transaction do
        # 1. Atualizar convenio_id de todos os pacientes que usam o convenio_origem (incluindo inativos)
        Paciente.unscoped.where(convenio_id: id_origem).update_all(convenio_id: id_destino)

        # 2. Atualizar convenio_id de todos os agendamentos que usam o convenio_origem
        Agendamento.where(convenio_id: id_origem).update_all(convenio_id: id_destino)

        # 3. Atualizar tabela de valores vinculada se existir
        if ActiveRecord::Base.connection.table_exists?('neurocontrol_tabela_valores')
          ActiveRecord::Base.connection.execute("UPDATE neurocontrol_tabela_valores SET convenio_id = #{id_destino.to_i} WHERE convenio_id = #{id_origem.to_i}") rescue nil
        end

        # 4. Remover o convênio de origem duplicado
        convenio_origem.destroy!
      end

      # Registra em auditoria
      AuditoriaService.log(request, 'MESCLAR_CONVENIOS', convenio_destino, "Mesclou convênio #{convenio_origem.nome} (ID: #{id_origem}) para #{convenio_destino.nome} (ID: #{id_destino})")

      render json: { success: true, message: "Convênios unificados com sucesso!" }
    rescue => e
      render json: { error: "Erro ao mesclar convênios: #{e.message}" }, status: :unprocessable_entity
    end
  end

  private

  def convenio_json(c)
    json = c.as_json(only: [:id, :nome, :ativo, :exigencias, :especialidades_atendidas])
    json[:pacientes] = c.pacientes.ativos.order(:nome).map { |p| { id: p.id, nome: p.nome } }
    begin
      json[:documento_url] = c.documento.attached? ? rails_blob_url(c.documento, only_path: true) : nil
      json[:documento_nome] = c.documento.attached? ? c.documento.filename.to_s : nil
    rescue
      json[:documento_url] = nil
      json[:documento_nome] = nil
    end
    json
  end

  def convenio_params
    params.require(:convenio).permit(:nome, :exigencias, :especialidades_atendidas, :documento)
  end
end
