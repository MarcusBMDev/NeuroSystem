class Permissao < NeurochatRecord
  self.table_name = 'permissoes'

  def readonly?
    true
  end
end
