module Api
  class AuthController < ApplicationController
    def login
      username = params[:username]
      password = params[:password]

      if username.blank? || password.blank?
        render json: { error: 'Usuário e senha são obrigatórios.' }, status: :bad_request
        return
      end

      # Tenta buscar no banco novo (agendamentos_clinica_dev)
      user = LocalUser.find_by(username: username)

      # Se não achar, faz fallback para o banco legado (neurochat_db)
      user ||= User.find_by(username: username)

      if user.nil? || !user.autentica_senha?(password)
        render json: { success: false, error: 'Credenciais inválidas.' }, status: :unauthorized
        return
      end

      permissions = if user.is_super_admin == 1 || user.is_super_admin == true || user.is_super_admin.to_s == 'true'
                      Permissao.pluck(:nome)
                    elsif user.setor_id.present?
                      SetorPermissao.joins(:permissao)
                                    .where(setor_id: [user.setor_id, user.setor&.parent_id].compact)
                                    .pluck('permissoes.nome')
                                    .uniq
                    else
                      []
                    end

      render json: {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          department: user.respond_to?(:department) ? user.department : nil,
          is_super_admin: user.is_super_admin,
          permissions: permissions
        }
      }
    end
  end
end
