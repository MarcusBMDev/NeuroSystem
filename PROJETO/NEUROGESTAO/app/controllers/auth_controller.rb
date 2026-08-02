class AuthController < ApplicationController
  def login
    # Tenta buscar no banco novo (agendamentos_clinica_dev)
    usuario = LocalUser.find_by(username: params[:username])

    # Se não achar, faz fallback para o banco legado (neurochat_db)
    unless usuario
      usuario = User.find_by(username: params[:username])
    end

    # Usa o método para validar o hash do Bcrypt / texto puro
    if usuario && usuario.autentica_senha?(params[:password])
      
      # Define o nível de acesso baseado no departamento/setor
      nivel_acesso = definir_nivel_de_acesso(usuario)

      render json: {
        autenticado: true,
        usuario: {
           id: usuario.id,
          nome: usuario.username,
          username: usuario.username,
          departamento: usuario.department,
          nivel_acesso: nivel_acesso,
          is_super_admin: usuario.is_super_admin
        }
      }, status: :ok
    else
      render json: { erro: "Usuário ou senha inválidos" }, status: :unauthorized
    end
  end

  private

  def definir_nivel_de_acesso(usuario)
    # Se for super_admin (seja local ou do neurochat), é admin total
    return "admin" if usuario.is_super_admin

    if usuario.is_a?(User)
      # Usuários do Neurochat normais (não super admin) sempre têm nível "neurochat"
      "neurochat"
    else
      # Usuários locais do banco agendamentos_clinica_dev
      setores_admin = ["Diretoria Geral", "Recepção", "Agendamento/Recepção", "TI", "Administração", "Administracao"]
      dept = usuario.department.to_s.downcase
      if setores_admin.any? { |s| dept.include?(s.downcase) || s.downcase.include?(dept) }
        "admin"
      else
        "profissional"
      end
    end
  end
end