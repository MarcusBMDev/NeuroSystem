# app/services/auditoria_service.rb
class AuditoriaService
  def self.log(request, acao, entidade, detalhes = nil)
    if request.is_a?(Hash)
      user_id   = request[:user_id]
      user_name = NeurochatService.clean_str(request[:user_name] || 'Sistema')
      setor     = NeurochatService.clean_str(request[:setor] || 'Desconhecido')
      ip        = request[:ip_address]
    else
      # Extrai informações dos headers (injetadas pelo auth.js no front)
      user_id   = request&.headers&.[]('X-User-Id')
      user_name = NeurochatService.clean_str(request&.headers&.[]('X-User-Name') || 'Sistema')
      setor     = NeurochatService.clean_str(request&.headers&.[]('X-User-Role') || 'Desconhecido')
      ip        = request&.remote_ip
    end

    # Se 'entidade' for um objeto ActiveRecord, extraímos o tipo e ID
    tipo = entidade.is_a?(String) ? entidade : entidade.class.name
    id   = entidade.is_a?(String) ? nil : (entidade.respond_to?(:id) ? entidade.id : nil)

    detalhes_clean = NeurochatService.clean_str(detalhes.is_a?(Hash) ? detalhes.to_json : detalhes.to_s)

    # Cria o registro de auditoria de forma resiliente
    attrs = {
      user_id: user_id,
      setor: setor,
      acao: acao.to_s.upcase,
      entidade_tipo: tipo,
      entidade_id: id,
      detalhes: detalhes_clean,
      ip_address: ip
    }

    # Só adiciona user_name se a coluna existir no banco
    if Auditoria.column_names.include?('user_name')
      attrs[:user_name] = user_name
    else
      # Se não existir, concatena no detalhes para não perder a informação
      attrs[:detalhes] = "[Usuário: #{user_name}] #{attrs[:detalhes]}"
    end

    Auditoria.create!(attrs)
  rescue => e
    Rails.logger.error "[AuditoriaService Error]: #{e.message}"
    # Não travamos a execução principal por erro no log
  end
end
