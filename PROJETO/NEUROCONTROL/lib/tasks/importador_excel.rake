# lib/tasks/importador_excel.rake
require 'roo'

namespace :importador do
  desc "Importa dados das planilhas legadas para o NeuroControl"
  task planilhas: :environment do
    puts "🚀 Iniciando a importação de dados..."

    planilhas_dir = Rails.root.join('planilhas')

    # Preload Convenios and Pacientes into memory for fast lookup
    convenios_map = {}
    Convenio.all.each { |c| convenios_map[c.nome.to_s.strip.upcase] = c.id }

    pacientes_map = {}
    Paciente.where(deleted_at: nil).each { |p| pacientes_map[p.nome.to_s.strip.upcase] = p.id }

    # Helper to resolve or create Convenio
    get_convenio_id = ->(nome_raw) {
      return convenios_map.values.first || 1 if nome_raw.blank?
      key = nome_raw.to_s.strip.upcase
      return convenios_map[key] if convenios_map[key]

      conv = Convenio.find_or_create_by!(nome: nome_raw.to_s.strip)
      convenios_map[key] = conv.id
      conv.id
    }

    # Helper to resolve or create Paciente
    get_paciente_id = ->(nome_raw, conv_id = nil) {
      return nil if nome_raw.blank?
      clean_name = nome_raw.to_s.split('//').first.strip
      key = clean_name.upcase
      return pacientes_map[key] if pacientes_map[key]

      pac = Paciente.find_or_create_by!(nome: clean_name) do |p|
        p.convenio_id = conv_id if conv_id
      end
      pacientes_map[key] = pac.id
      pac.id
    }

    # =========================================================================
    # 1. IMPORTAÇÃO DA TABELA DE VALORES (tabela_valores.xlsx)
    # =========================================================================
    caminho_tabela_valores = planilhas_dir.join('tabela_valores.xlsx')
    
    if File.exist?(caminho_tabela_valores)
      puts "📊 Lendo Tabela de Valores (#{File.basename(caminho_tabela_valores)})..."
      planilha_valores = Roo::Spreadsheet.open(caminho_tabela_valores.to_s)
      cabecalho_valores = planilha_valores.row(1)

      (2..planilha_valores.last_row).each do |i|
        row_data = planilha_valores.row(i)
        next if row_data.compact.empty?
        row = Hash[[cabecalho_valores, row_data].transpose]
        
        c_id = get_convenio_id.call(row['Convênio'] || row['Convenio'] || 'PARTICULAR')
        especialidade = (row['Especialidade'] || 'Geral').to_s.strip
        codigo_tuss = (row['Código TUSS'] || row['Codigo TUSS'] || '50000470').to_s.strip
        valor = (row['Valor da Sessão'] || row['Valor'] || 100.0).to_f

        NeurocontrolTabelaValor.find_or_create_by!(
          convenio_id: c_id,
          especialidade: especialidade,
          codigo_tuss: codigo_tuss
        ) do |t|
          t.valor_sessao = valor
        end
      end
      puts "✅ Tabela de Valores importada com sucesso!"
    else
      puts "⚠️ Planilha 'tabela_valores.xlsx' não encontrada na pasta 'planilhas/'."
    end

    # =========================================================================
    # 2. IMPORTAÇÃO DE GUIAS ATIVAS (guias_ativas.xlsx)
    # =========================================================================
    caminho_guias = planilhas_dir.join('guias_ativas.xlsx')
    
    if File.exist?(caminho_guias)
      puts "📋 Lendo Guias Ativas (#{File.basename(caminho_guias)})..."
      planilha_guias = Roo::Spreadsheet.open(caminho_guias.to_s)
      cabecalho_guias = planilha_guias.row(1)

      (2..planilha_guias.last_row).each do |i|
        row_data = planilha_guias.row(i)
        next if row_data.compact.empty?
        row = Hash[[cabecalho_guias, row_data].transpose]
        
        nome_paciente = row['Nome do Paciente'] || row['Paciente']
        num_guia = row['Número da Guia'] || row['Numero da Guia'] || row['Guia']
        
        next if nome_paciente.blank? || num_guia.blank?

        p_id = get_paciente_id.call(nome_paciente)

        if p_id
          guia_clean = num_guia.to_s.strip.gsub('/', '_')
          NeurocontrolGuia.find_or_create_by!(guia_numero: guia_clean) do |g|
            g.paciente_id = p_id
            g.quantidade_autorizada = (row['Quantidade Autorizada'] || row['Qtd'] || 1).to_i
            g.previsao_calculada = g.quantidade_autorizada
            g.mes_vigente = (row['Mês Vigente'] || row['Mes Vigente'] || '2026-07').to_s.strip
            g.terapia = (row['Terapia'] || 'Psico').to_s.strip
            g.data_pedido = row['Data do Pedido'] || Date.today
            g.status = 'aguardando_agendamento'
            g.criado_por = 'Importação Rake Task'
          end
        end
      end
      puts "✅ Guias Ativas importadas com sucesso!"
    else
      puts "⚠️ Planilha 'guias_ativas.xlsx' não encontrada na pasta 'planilhas/'."
    end

    puts "\n🎉 Processo de importação finalizado com sucesso!"
    puts "📊 Situação Atual do Banco de Dados:"
    puts "   - Convênios: #{Convenio.count}"
    puts "   - Pacientes: #{Paciente.count}"
    puts "   - Guias no NeuroControl: #{NeurocontrolGuia.count}"
    puts "   - NFs Particulares: #{NeurocontrolNfParticular.count}"
  end
end
