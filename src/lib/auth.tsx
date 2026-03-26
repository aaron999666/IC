/* eslint-disable react-refresh/only-export-components */
import type { Session, User } from '@supabase/supabase-js'
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { CompanyMembership } from '../types'
import { hasSupabaseClient, supabase } from './supabase'

type AuthContextValue = {
  isReady: boolean
  isConfigured: boolean
  session: Session | null
  user: User | null
  memberships: CompanyMembership[]
  selectedCompanyId: string | null
  selectedCompanyName: string | null
  selectedRole: CompanyMembership['role'] | null
  isAdmin: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setSelectedCompanyId: (companyId: string) => void
  refreshMemberships: () => Promise<void>
}

type MembershipRow = {
  company_id: string
  role: CompanyMembership['role']
  companies:
    | {
        id: string
        display_name: string
        kyb_status: string | null
      }
    | null
    | Array<{
        id: string
        display_name: string
        kyb_status: string | null
      }>
}

const ADMIN_ROLES: CompanyMembership['role'][] = ['owner', 'admin', 'ops']
const STORAGE_KEY = 'iccorehub:selected-company-id'

const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeMembershipRows(rows: MembershipRow[] | null | undefined): CompanyMembership[] {
  return (rows ?? [])
    .map((row) => {
      const company = Array.isArray(row.companies) ? row.companies[0] ?? null : row.companies

      if (!company) {
        return null
      }

      return {
        company_id: row.company_id,
        company_name: company.display_name,
        kyb_status: company.kyb_status ?? null,
        role: row.role,
      } satisfies CompanyMembership
    })
    .filter((row): row is CompanyMembership => Boolean(row))
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [memberships, setMemberships] = useState<CompanyMembership[]>([])
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(null)

  async function refreshMembershipsForUser(nextUser: User | null) {
    if (!supabase || !nextUser) {
      setMemberships([])
      setSelectedCompanyIdState(null)
      return
    }

    const { data, error } = await supabase
      .from('company_members')
      .select('company_id, role, companies(id, display_name, kyb_status)')
      .eq('user_id', nextUser.id)
      .eq('is_active', true)
      .order('accepted_at', { ascending: true, nullsFirst: false })

    if (error) {
      throw error
    }

    const normalized = normalizeMembershipRows(data as MembershipRow[])
    setMemberships(normalized)

    const persistedCompanyId = localStorage.getItem(STORAGE_KEY)
    const nextSelectedCompanyId =
      normalized.find((membership) => membership.company_id === persistedCompanyId)?.company_id ??
      normalized[0]?.company_id ??
      null

    setSelectedCompanyIdState(nextSelectedCompanyId)

    if (nextSelectedCompanyId) {
      localStorage.setItem(STORAGE_KEY, nextSelectedCompanyId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  useEffect(() => {
    const client = supabase

    if (client === null) {
      setIsReady(true)
      return
    }

    const activeClient = client
    let isMounted = true

    async function bootstrap() {
      const {
        data: { session: currentSession },
      } = await activeClient.auth.getSession()

      if (!isMounted) {
        return
      }

      setSession(currentSession)
      setUser(currentSession?.user ?? null)

      try {
        await refreshMembershipsForUser(currentSession?.user ?? null)
      } finally {
        if (isMounted) {
          setIsReady(true)
        }
      }
    }

    void bootstrap()

    const {
      data: { subscription },
    } = activeClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      void refreshMembershipsForUser(nextSession?.user ?? null).finally(() => {
        if (isMounted) {
          setIsReady(true)
        }
      })
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase auth is not configured for this environment.')
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) {
      return
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }

    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const refreshMemberships = useCallback(async () => {
    await refreshMembershipsForUser(user)
  }, [user])

  const setSelectedCompanyId = useCallback((companyId: string) => {
    setSelectedCompanyIdState(companyId)
    localStorage.setItem(STORAGE_KEY, companyId)
  }, [])

  const selectedMembership =
    memberships.find((membership) => membership.company_id === selectedCompanyId) ?? null

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      isConfigured: hasSupabaseClient,
      session,
      user,
      memberships,
      selectedCompanyId,
      selectedCompanyName: selectedMembership?.company_name ?? null,
      selectedRole: selectedMembership?.role ?? null,
      isAdmin: memberships.some((membership) => ADMIN_ROLES.includes(membership.role)),
      signInWithPassword,
      signOut,
      setSelectedCompanyId,
      refreshMemberships,
    }),
    [isReady, memberships, refreshMemberships, selectedCompanyId, selectedMembership, session, setSelectedCompanyId, signInWithPassword, signOut, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}
