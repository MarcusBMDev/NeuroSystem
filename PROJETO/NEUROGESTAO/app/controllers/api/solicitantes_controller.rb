class Api::SolicitantesController < ApplicationController
  before_action :validar_usuario_logado!
  before_action :validar_admin!, only: [:create, :destroy]

  # GET /api/solicitantes
  def index
    solicitantes = Solicitante.order(:nome)
    render json: solicitantes.as_json(only: [:id, :nome])
  end

  # POST /api/solicitantes
  def create
    solicitante = Solicitante.new(solicitante_params)
    if solicitante.save
      registrar_auditoria('CRIAR_SOLICITANTE', "Criado solicitante: #{solicitante.nome} por Admin")
      render json: solicitante, status: :created
    else
      render json: { errors: solicitante.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/solicitantes/:id
  def destroy
    solicitante = Solicitante.find(params[:id])
    if solicitante.destroy
      registrar_auditoria('DELETAR_SOLICITANTE', "Deletado solicitante: #{solicitante.nome} por Admin")
      render json: { mensagem: "Solicitante removido com sucesso." }
    else
      render json: { errors: ["Falha ao remover solicitante."] }, status: :unprocessable_entity
    end
  end

  private

  def solicitante_params
    params.require(:solicitante).permit(:nome)
  end
end
