class NeurochatRecord < ActiveRecord::Base
  self.abstract_class = true
  connects_to database: { writing: :neurochat, reading: :neurochat }
end
