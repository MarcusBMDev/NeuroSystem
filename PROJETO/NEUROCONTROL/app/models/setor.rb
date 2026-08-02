class Setor < NeurochatRecord
  self.table_name = 'setores'
  belongs_to :parent, class_name: 'Setor', foreign_key: 'parent_id', optional: true
  has_many :setor_permissoes, class_name: 'SetorPermissao', foreign_key: 'setor_id'
  has_many :permissoes, through: :setor_permissoes

  def readonly?
    true
  end
end
