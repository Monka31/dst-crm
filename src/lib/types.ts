export type Role = "admin" | "team_leader" | "member" | "viewer";

export type Pole = { id: string; name: string; color: string };

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  role: Role;
  pole_id: string | null;
  created_at: string;
  pole?: Pole | null;
};

export type Company = {
  id: string;
  name: string;
  website: string | null;
  website_domain: string | null;
  logo_url: string | null;
  sector: string | null;
  subsector: string | null;
  description: string | null;
  employee_count: string | null;
  revenue: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  linkedin_url: string | null;
  pole_id: string | null;
  owner_id: string | null;
  priority: "basse" | "moyenne" | "haute";
  source: string | null;
  status: string;
  refusal_reason: string | null;
  retry_next_year: boolean;
  next_action: string | null;
  next_action_at: string | null;
  last_interaction_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  pole?: Pole | null;
  owner?: Pick<Profile, "id" | "first_name" | "last_name"> | null;
  contacts?: { count: number }[];
};

export type Contact = {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  relation_type: string | null;
  relevance: number;
  is_primary: boolean;
  status: string | null;
  referred_by: string | null;
  referred_by_name: string | null;
  email_status: string;
  created_by: string | null;
  created_at: string;
  referrer?: Pick<Profile, "id" | "first_name" | "last_name"> | null;
  company?: {
    id: string; name: string; status: string;
    logo_url?: string | null; website_domain?: string | null;
  } | null;
};

export type Interaction = {
  id: string;
  company_id: string;
  contact_id: string | null;
  author_id: string | null;
  channel: string;
  outcome: string;
  occurred_at: string;
  notes: string | null;
  message_sent: string | null;
  author?: Pick<Profile, "first_name" | "last_name"> | null;
  contact?: Pick<Contact, "first_name" | "last_name"> | null;
  company?: { name: string } | null;
};

export type FollowUp = {
  id: string;
  company_id: string;
  contact_id: string | null;
  assigned_to: string | null;
  due_date: string;
  note: string | null;
  status: "a_faire" | "fait" | "annule";
  created_at: string;
  company?: { id: string; name: string } | null;
  assignee?: Pick<Profile, "first_name" | "last_name"> | null;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  company_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: "a_faire" | "en_cours" | "fait";
  for_team: boolean;
  created_by: string | null;
  created_at: string;
  company?: { id: string; name: string } | null;
  assignee?: Pick<Profile, "first_name" | "last_name"> | null;
};

export type Note = {
  id: string;
  company_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author?: Pick<Profile, "first_name" | "last_name"> | null;
};

export type Visit = {
  id: string;
  company_id: string;
  visit_date: string | null;
  start_time: string | null;
  end_time: string | null;
  address: string | null;
  max_participants: number | null;
  min_participants: number | null;
  speaker: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  language: string | null;
  visit_type: string | null;
  confirmation: "a_confirmer" | "confirmee" | "annulee";
  pole_id: string | null;
  owner_id: string | null;
};

export type Activity = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  company_id: string | null;
  label: string | null;
  created_at: string;
  actor?: Pick<Profile, "first_name" | "last_name"> | null;
};

export type Settings = {
  id: boolean;
  trip_city: string;
  trip_country: string;
  trip_start_date: string | null;
  trip_end_date: string | null;
  objective_visits: number;
  objective_companies: number;
  objective_contacted: number;
  objective_contacts: number;
  follow_up_delay_days: number;
  stale_days: number;
  gamification_enabled: boolean;
  show_member_contribution: boolean;
  show_inactivity: boolean;
};

export type Stats = {
  total: number; a_contacter: number; contactees: number; en_attente: number;
  positives: number; refus: number; visites: number; relances_du_jour: number;
  sans_contact: number; sans_activite: number; contacts: number;
  interactions: number; emails: number; linkedin: number; appels: number;
  relances_total: number;
};

export type Duplicate = {
  id: string; name: string; status: string; city: string | null; sector: string | null;
  owner_id: string | null; owner_name: string | null; website: string | null;
  last_interaction_at: string | null; similarity: number; match_reason: string;
};

export type ContactNote = {
  id: string;
  contact_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author?: Pick<Profile, "first_name" | "last_name"> | null;
};

export type MessageTemplate = {
  id: string;
  title: string;
  channel: string;
  subject: string | null;
  body_html: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitParticipant = {
  visit_id: string;
  profile_id: string;
  created_at: string;
  profile?: Pick<Profile, "id" | "first_name" | "last_name"> | null;
};

export type TemplateFile = {
  id: string;
  template_id: string;
  name: string;
  path: string;
  size_bytes: number | null;
  mime: string | null;
  created_by: string | null;
  created_at: string;
};
