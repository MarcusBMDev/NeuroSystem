class SetorPermissao < NeurochatRecord
  self.table_name = 'setores_permissoes'
  belongs_to :setor, class_name: 'Setor', foreign_key: 'setor_id'
  belongs_to :permissao, class_name: 'Permissao', foreign_key: 'permissao_id'

  def readonly?
    true
  end
end
