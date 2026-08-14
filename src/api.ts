export interface AuthUser {
  id: string
  email: string
  name: string
  course: string
  year_of_study: string
  weekly_goal_hours: number
  theme: 'light' | 'dark' | 'system'
  deadline_reminders: boolean
  session_reminders: boolean
  weekly_report: boolean
  email_notifications: boolean
  browser_notifications: boolean
  larger_text: boolean
  reduced_motion: boolean
  high_contrast: boolean
  verified?: boolean
  [key: string]: unknown
}

export interface AuthState {
  token: string
  record: AuthUser
}

export interface PBRecord {
  id: string
  created: string
  updated: string
  [key: string]: unknown
}

export interface AssignmentRecord extends PBRecord {
  owner: string
  title: string
  module_name: string
  module_code: string
  module_color: string
  description: string
  due_at: string
  priority: 'High' | 'Medium' | 'Low'
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Overdue'
  progress: number
  estimated_hours: number
  reminder: string
  notes: string
}

export interface AssignmentTaskRecord extends PBRecord {
  owner: string
  assignment: string
  title: string
  done: boolean
  sort_order: number
  completed_at: string
}

export interface StudySessionRecord extends PBRecord {
  owner: string
  assignment: string
  title: string
  start_at: string
  planned_minutes: number
  actual_minutes: number
  status: 'Planned' | 'In Progress' | 'Completed' | 'Cancelled'
  notes: string
}

const AUTH_STORAGE_KEY = 'studyflow_auth_v1'

function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthState
  } catch {
    return null
  }
}

let authState: AuthState | null = loadAuth()

export function getAuth(): AuthState | null {
  return authState
}

function setAuth(next: AuthState | null) {
  authState = next
  if (next) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
  else localStorage.removeItem(AUTH_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('studyflow-auth-change'))
}

export function isLoggedIn(): boolean {
  return Boolean(authState?.token && authState?.record?.id)
}

export function logout() {
  setAuth(null)
}

interface RequestOptions extends RequestInit {
  authenticated?: boolean
}

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (options.authenticated !== false && authState?.token) {
    headers.set('Authorization', authState.token)
  }

  const response = await fetch(`/api${path}`, { ...options, headers })
  const text = await response.text()
  let payload: any = null
  if (text) {
    try { payload = JSON.parse(text) } catch { payload = text }
  }

  if (!response.ok) {
    const message = payload?.message || `Request failed (${response.status})`
    throw new ApiError(message, response.status, payload)
  }
  return payload as T
}

export async function register(input: {
  name: string
  email: string
  password: string
  course: string
  yearOfStudy: string
}): Promise<AuthState> {
  const email = input.email.trim().toLowerCase()
  await api<AuthUser>('/collections/users/records', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify({
      email,
      emailVisibility: false,
      password: input.password,
      passwordConfirm: input.password,
      name: input.name.trim(),
      course: input.course,
      year_of_study: input.yearOfStudy,
      weekly_goal_hours: 15,
      theme: 'light',
      deadline_reminders: true,
      session_reminders: true,
      weekly_report: true,
      email_notifications: true,
      browser_notifications: false,
      larger_text: false,
      reduced_motion: false,
      high_contrast: false,
    }),
  })
  return login(email, input.password)
}

export async function login(email: string, password: string): Promise<AuthState> {
  const result = await api<AuthState>('/collections/users/auth-with-password', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify({ identity: email.trim().toLowerCase(), password }),
  })
  setAuth(result)
  return result
}

export async function refreshAuth(): Promise<AuthState | null> {
  if (!authState?.token) return null
  try {
    const result = await api<AuthState>('/collections/users/auth-refresh', { method: 'POST' })
    setAuth(result)
    return result
  } catch {
    setAuth(null)
    return null
  }
}

export async function updateCurrentUser(changes: Partial<AuthUser> & Record<string, unknown>): Promise<AuthUser> {
  if (!authState?.record.id) throw new Error('Not signed in')
  const updated = await api<AuthUser>(`/collections/users/records/${authState.record.id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
  setAuth({ ...authState, record: updated })
  return updated
}

export async function deleteCurrentUser(): Promise<void> {
  if (!authState?.record.id) throw new Error('Not signed in')
  await api<void>(`/collections/users/records/${authState.record.id}`, { method: 'DELETE' })
  logout()
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api<void>('/collections/users/request-password-reset', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  await api<void>('/collections/users/confirm-password-reset', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify({ token, password, passwordConfirm: password }),
  })
}

function ownerId(): string {
  const id = authState?.record.id
  if (!id) throw new Error('You must be signed in')
  return id
}

interface ListResponse<T> {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  items: T[]
}

function ownerFilter(extra?: string): string {
  const base = `owner = "${ownerId()}"`
  return extra ? `${base} && (${extra})` : base
}

export async function listAssignments(): Promise<AssignmentRecord[]> {
  const query = new URLSearchParams({ perPage: '200', sort: 'due_at', filter: ownerFilter() })
  const result = await api<ListResponse<AssignmentRecord>>(`/collections/assignments/records?${query}`)
  return result.items
}

export async function getAssignment(id: string): Promise<AssignmentRecord> {
  return api<AssignmentRecord>(`/collections/assignments/records/${encodeURIComponent(id)}`)
}

export async function createAssignment(input: {
  title: string
  moduleName: string
  moduleCode: string
  moduleColor: string
  description: string
  dueAt: string
  priority: 'High' | 'Medium' | 'Low'
  estimatedHours: number
  reminder: string
  subtasks: string[]
}): Promise<AssignmentRecord> {
  const owner = ownerId()
  const assignment = await api<AssignmentRecord>('/collections/assignments/records', {
    method: 'POST',
    body: JSON.stringify({
      owner,
      title: input.title.trim(),
      module_name: input.moduleName,
      module_code: input.moduleCode,
      module_color: input.moduleColor,
      description: input.description,
      due_at: new Date(input.dueAt).toISOString(),
      priority: input.priority,
      status: 'Not Started',
      progress: 0,
      estimated_hours: input.estimatedHours || 0,
      reminder: input.reminder,
      notes: '',
    }),
  })

  const tasks = input.subtasks.map((x) => x.trim()).filter(Boolean)
  await Promise.all(tasks.map((title, index) => api<AssignmentTaskRecord>('/collections/assignment_tasks/records', {
    method: 'POST',
    body: JSON.stringify({ owner, assignment: assignment.id, title, done: false, sort_order: index, completed_at: '' }),
  })))
  return assignment
}

export async function updateAssignment(id: string, changes: Partial<AssignmentRecord>): Promise<AssignmentRecord> {
  return api<AssignmentRecord>(`/collections/assignments/records/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ owner: ownerId(), ...changes }),
  })
}

export async function deleteAssignment(id: string): Promise<void> {
  await api<void>(`/collections/assignments/records/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function listTasks(assignmentId: string): Promise<AssignmentTaskRecord[]> {
  const query = new URLSearchParams({
    perPage: '200', sort: 'sort_order', filter: ownerFilter(`assignment = "${assignmentId}"`),
  })
  const result = await api<ListResponse<AssignmentTaskRecord>>(`/collections/assignment_tasks/records?${query}`)
  return result.items
}

export async function updateTask(id: string, done: boolean): Promise<AssignmentTaskRecord> {
  return api<AssignmentTaskRecord>(`/collections/assignment_tasks/records/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ owner: ownerId(), done, completed_at: done ? new Date().toISOString() : '' }),
  })
}

export async function addTask(assignmentId: string, title: string, sortOrder: number): Promise<AssignmentTaskRecord> {
  return api<AssignmentTaskRecord>('/collections/assignment_tasks/records', {
    method: 'POST', body: JSON.stringify({ owner: ownerId(), assignment: assignmentId, title, done: false, sort_order: sortOrder, completed_at: '' }),
  })
}

export async function listStudySessions(): Promise<StudySessionRecord[]> {
  const query = new URLSearchParams({ perPage: '200', sort: 'start_at', filter: ownerFilter() })
  const result = await api<ListResponse<StudySessionRecord>>(`/collections/study_sessions/records?${query}`)
  return result.items
}

export async function createStudySession(input: {
  assignment?: string
  title: string
  startAt: string
  plannedMinutes: number
  notes?: string
}): Promise<StudySessionRecord> {
  return api<StudySessionRecord>('/collections/study_sessions/records', {
    method: 'POST',
    body: JSON.stringify({
      owner: ownerId(), assignment: input.assignment || '', title: input.title,
      start_at: new Date(input.startAt).toISOString(), planned_minutes: input.plannedMinutes,
      actual_minutes: 0, status: 'Planned', notes: input.notes || '',
    }),
  })
}

export async function updateStudySession(id: string, changes: Partial<StudySessionRecord>): Promise<StudySessionRecord> {
  return api<StudySessionRecord>(`/collections/study_sessions/records/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ owner: ownerId(), ...changes }),
  })
}

export function readableApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const data = error.data as any
    const fieldMessages = data?.data && Object.values(data.data).map((v: any) => v?.message).filter(Boolean)
    if (fieldMessages?.length) return fieldMessages.join(' ')
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
