class ApplicationController < ActionController::API
  attr_reader :current_user

  def authenticate_request!
    user_id = request.headers['x-user-id']

    if user_id.blank?
      render json: { error: 'Acesso não autorizado. Identificação do usuário ausente.' }, status: :unauthorized
      return false
    end

    @current_user = User.find_by(id: user_id)

    if @current_user.nil?
      render json: { error: 'Usuário não localizado no banco.' }, status: :unauthorized
      return false
    end

    true
  end

  def authorize!(*required_permissions)
    return unless authenticate_request!

    # Bypass total para Super Admin
    return true if @current_user.is_super_admin == 1 || @current_user.is_super_admin == true

    user_permissions = fetch_user_permissions(@current_user.setor_id)

    required = required_permissions.flatten.map(&:to_s)
    has_permission = (required & user_permissions).any?

    unless has_permission
      render json: {
        error: "Acesso negado. O setor '#{@current_user.department}' não possui nenhuma das permissões requeridas: [#{required.join(', ')}]."
      }, status: :forbidden
      return false
    end

    true
  end

  private

  def fetch_user_permissions(setor_id)
    return [] if setor_id.nil?

    setor = Setor.find_by(id: setor_id)
    return [] unless setor

    setor_ids = [setor.id, setor.parent_id].compact
    SetorPermissao.joins(:permissao)
                  .where(setor_id: setor_ids)
                  .pluck('permissoes.nome')
                  .uniq
  end
end
