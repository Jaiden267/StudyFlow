migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const ownerRead = '@request.auth.id != "" && owner = @request.auth.id'
  const ownerCreate = '@request.auth.id != "" && @request.body.owner = @request.auth.id'
  const ownerUpdate = '@request.auth.id != "" && owner = @request.auth.id && @request.body.owner = @request.auth.id'

  const modules = new Collection({
    type: 'base',
    name: 'modules',
    listRule: ownerRead,
    viewRule: ownerRead,
    createRule: ownerCreate,
    updateRule: ownerUpdate,
    deleteRule: ownerRead,
    fields: [
      { name: 'owner', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'name', type: 'text', required: true, max: 160, presentable: true },
      { name: 'code', type: 'text', required: true, max: 40 },
      { name: 'color', type: 'text', required: true, max: 20 },
    ],
    indexes: [
      'CREATE INDEX idx_modules_owner ON modules (owner)',
      'CREATE INDEX idx_modules_owner_name ON modules (owner, name)',
    ],
  })

  app.save(modules)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('modules'))
  } catch (_) {}
})
