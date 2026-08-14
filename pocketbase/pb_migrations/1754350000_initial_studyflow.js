migrate((app) => {
  const ownerRead = '@request.auth.id != "" && owner = @request.auth.id'
  const ownerCreate = '@request.auth.id != "" && @request.body.owner = @request.auth.id'
  const ownerUpdate = '@request.auth.id != "" && owner = @request.auth.id && @request.body.owner = @request.auth.id'

  // PocketBase already creates the default "users" auth collection.
  // Extend it instead of trying to create another collection with the same name.
  const users = app.findCollectionByNameOrId('users')

  users.fields.add(new TextField({
    name: 'course',
    max: 160,
  }))

  users.fields.add(new SelectField({
    name: 'year_of_study',
    values: ['1', '2', '3', '4', 'Postgraduate', 'Other'],
    maxSelect: 1,
  }))

  users.fields.add(new NumberField({
    name: 'weekly_goal_hours',
    min: 0,
    max: 168,
  }))

  users.fields.add(new SelectField({
    name: 'theme',
    values: ['light', 'dark', 'system'],
    maxSelect: 1,
  }))

  for (const name of [
    'deadline_reminders',
    'session_reminders',
    'weekly_report',
    'email_notifications',
    'browser_notifications',
    'larger_text',
    'reduced_motion',
    'high_contrast',
  ]) {
    users.fields.add(new BoolField({ name }))
  }

  app.save(users)

  const assignments = new Collection({
    type: 'base',
    name: 'assignments',
    listRule: ownerRead,
    viewRule: ownerRead,
    createRule: ownerCreate,
    updateRule: ownerUpdate,
    deleteRule: ownerRead,
    fields: [
      { name: 'owner', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'title', type: 'text', required: true, max: 240, presentable: true },
      { name: 'module_name', type: 'text', required: true, max: 160 },
      { name: 'module_code', type: 'text', max: 40 },
      { name: 'module_color', type: 'text', max: 20 },
      { name: 'description', type: 'editor', maxSize: 200000 },
      { name: 'due_at', type: 'date', required: true },
      { name: 'priority', type: 'select', required: true, values: ['High', 'Medium', 'Low'], maxSelect: 1 },
      { name: 'status', type: 'select', required: true, values: ['Not Started', 'In Progress', 'Completed', 'Overdue'], maxSelect: 1 },
      { name: 'progress', type: 'number', min: 0, max: 100 },
      { name: 'estimated_hours', type: 'number', min: 0, max: 10000 },
      { name: 'reminder', type: 'select', values: ['No reminder', '1 hour before', '1 day before', '3 days before', '1 week before'], maxSelect: 1 },
      { name: 'notes', type: 'editor', maxSize: 200000 },
      { name: 'attachments', type: 'file', maxSelect: 10, maxSize: 10485760, protected: true },
    ],
    indexes: [
      'CREATE INDEX idx_assignments_owner ON assignments (owner)',
      'CREATE INDEX idx_assignments_owner_due ON assignments (owner, due_at)',
    ],
  })
  app.save(assignments)

  const tasks = new Collection({
    type: 'base',
    name: 'assignment_tasks',
    listRule: ownerRead,
    viewRule: ownerRead,
    createRule: ownerCreate,
    updateRule: ownerUpdate,
    deleteRule: ownerRead,
    fields: [
      { name: 'owner', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'assignment', type: 'relation', required: true, maxSelect: 1, collectionId: assignments.id, cascadeDelete: true },
      { name: 'title', type: 'text', required: true, max: 240, presentable: true },
      { name: 'done', type: 'bool' },
      { name: 'sort_order', type: 'number', min: 0 },
      { name: 'completed_at', type: 'date' },
    ],
    indexes: [
      'CREATE INDEX idx_tasks_owner ON assignment_tasks (owner)',
      'CREATE INDEX idx_tasks_assignment ON assignment_tasks (assignment)',
    ],
  })
  app.save(tasks)

  const sessions = new Collection({
    type: 'base',
    name: 'study_sessions',
    listRule: ownerRead,
    viewRule: ownerRead,
    createRule: ownerCreate,
    updateRule: ownerUpdate,
    deleteRule: ownerRead,
    fields: [
      { name: 'owner', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'assignment', type: 'relation', maxSelect: 1, collectionId: assignments.id, cascadeDelete: false },
      { name: 'title', type: 'text', required: true, max: 240, presentable: true },
      { name: 'start_at', type: 'date', required: true },
      { name: 'planned_minutes', type: 'number', min: 1, max: 10080 },
      { name: 'actual_minutes', type: 'number', min: 0, max: 10080 },
      { name: 'status', type: 'select', required: true, values: ['Planned', 'In Progress', 'Completed', 'Cancelled'], maxSelect: 1 },
      { name: 'notes', type: 'text', max: 5000 },
    ],
    indexes: [
      'CREATE INDEX idx_sessions_owner ON study_sessions (owner)',
      'CREATE INDEX idx_sessions_owner_start ON study_sessions (owner, start_at)',
    ],
  })
  app.save(sessions)
}, (app) => {
  for (const name of ['study_sessions', 'assignment_tasks', 'assignments']) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (_) {}
  }

  const users = app.findCollectionByNameOrId('users')
  for (const name of [
    'course',
    'year_of_study',
    'weekly_goal_hours',
    'theme',
    'deadline_reminders',
    'session_reminders',
    'weekly_report',
    'email_notifications',
    'browser_notifications',
    'larger_text',
    'reduced_motion',
    'high_contrast',
  ]) {
    try {
      users.fields.removeByName(name)
    } catch (_) {}
  }
  app.save(users)
})
