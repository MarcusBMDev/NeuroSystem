class Api::UsersController < ApplicationController
  before_action :validar_usuario_logado!
  before_action :validar_admin!, only: [:create, :update, :destroy]

  # GET /api/users
  def index
    # Se for admin (ID 1), traz todos. Se não, traz apenas os ativos.
    if request.headers['X-User-Id'] == "1"
      users = LocalUser.order(:nome)
    else
      users = LocalUser.where("status LIKE ? OR status LIKE ?", 'active%', 'ativ%').order(:nome)
    end
    render json: users.as_json(only: [:id, :nome, :username, :department, :status])
  end

  # POST /api/users
  def create
    user = LocalUser.new(user_params)
    user.status ||= 'active'
    
    if user.save
      registrar_auditoria('CRIAR_USUARIO', "Criado usuario: #{user.username} por Admin")
      render json: user.as_json(only: [:id, :nome, :username, :department, :status]), status: :created
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PUT/PATCH /api/users/:id
  def update
    user = LocalUser.find(params[:id])
    if user.update(user_params)
      registrar_auditoria('ATUALIZAR_USUARIO', "Atualizado usuario: #{user.username} por Admin")
      render json: user.as_json(only: [:id, :nome, :username, :department, :status])
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/users/:id
  def destroy
    user = LocalUser.find(params[:id])
    if user.update(status: 'inactive')
      registrar_auditoria('DESATIVAR_USUARIO', "Desativado usuario: #{user.username} por Admin")
      render json: { mensagem: "Usuario desativado com sucesso." }
    else
      render json: { errors: ["Falha ao desativar usuario."] }, status: :unprocessable_entity
    end
  end

  private

  def user_params
    params.require(:user).permit(:nome, :username, :password, :department, :status)
  end
end
